// Ask Kix (homework help). The kid sends a typed question or a photo of it (already checked on the device for
// faces, shrunk and stripped of metadata), and a stage: hint, steps or full. Muse Spark (Standard) reads it and
// answers with a validated explanation spec drawn by trusted components. The photo is read once and never stored
// or logged; only the question text is kept, like any words to Kix. Distress words take the caring path instead.
// The lesson prompt starts with Ask Kix's published instructions (editable in Under the hood) and its guardrails.
import { z } from "zod";
import { instructionsFor } from "@/lib/agents/runtime";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { notebookNotes } from "@/lib/notebook/notebook";
import { askKixVars, enforceStage, explanationSchema, packsForLevel, sampleExplanation, STAGES, systemPrompt, teachingNotes } from "@/lib/kix/homework";
import { updateNotes } from "@/lib/knowledge/knowledge";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured, sparkTools } from "@/lib/meta/spark";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { cleanTitle, packsForChild, publicTrace, readSection, runSkillAgent } from "@/lib/skills/runtime";
import { getStore } from "@/lib/auth/context";
import type { NotebookPage } from "@/lib/auth/store";
import { logRunsFor } from "@/lib/runs/log";

/** About 2.2 MB of JPEG as a data URL: the browser sends at most 1600 px on the long side. */
const MAX_IMAGE_CHARS = 3_000_000;

const body = z.strictObject({
  stage: z.enum(STAGES),
  text: z.string().trim().max(800).optional(),
  image: z
    .string()
    .max(MAX_IMAGE_CHARS)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  /** Later stages send back what Kix read the first time, so the photo is never sent twice. */
  question: z.string().trim().max(500).optional(),
  figure: z.string().trim().max(300).optional(),
  /** And the pack sections Kix chose then (ids like p6-maths/heuristics#2), re-read by code instead of researched again. */
  sections: z.array(z.string().max(80)).max(4).optional(),
});

export async function POST(request: Request) {
  const family = await requireFamily(request, "homework", 8);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  logRunsFor("ask-kix", family.householdId, kid.id);
  const input = await readBody(request, body);
  if (!input || (!input.text && !input.image && !input.question)) return fail(400, "invalid");

  const said = input.text ?? input.question ?? "";
  const store = getStore();
  await refreshSkillOverrides(store); // the packs' published versions (lib/skills/overrides.ts)
  if (said) {
    const check = checkWords(said);
    await store?.guardian.saveMessage(family.householdId, kid.id, { at: new Date().toISOString(), text: said.slice(0, 500), source: "talk", ...check }).catch(() => undefined);
    if (check.distress) return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES }, explanation: null, sample: false });
  }

  if (!hasMetaApiKey()) return ok({ care: null, explanation: sampleExplanation(input.stage), sample: true });
  const userParts: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] = [];
  if (input.question) userParts.push({ type: "text", text: `The question (as you read it before): ${input.question}${input.figure ? `\nThe figure: ${input.figure}` : ""}` });
  if (input.text) userParts.push({ type: "text", text: `${kid.nickname} asks: ${input.text}` });
  if (input.image) userParts.push({ type: "text", text: "Here is a photo of the question." }, { type: "image_url", image_url: { url: input.image } });
  // The packs' notes, plus what the knowledge agent has published for this level (newest exam patterns).
  const prefix = packsForLevel(kid.level)[0]?.split("-")[0] ?? "";
  const published = ((await store?.knowledge.updates().catch(() => [])) ?? []).filter((u) => prefix && u.pack.startsWith(`${prefix}-`));
  // The Skill Engine's research step (lib/skills/runtime.ts): Kix loads the one pack the question belongs to and
  // reads the sections that teach its method. Later stages re-read the same sections by code. If research fails,
  // every pack's method notes for the level stand in, as before.
  const pages = (await store?.notebook.pages(family.householdId, kid.id).catch(() => [])) ?? [];
  const remembered = notebookNotes(kid.nickname, pages);
  const research = await researchSkills({ level: kid.level, sections: input.sections, userParts, pages, signal: request.signal });
  if (research.events.length) {
    const at = new Date().toISOString();
    await store?.skills.log(research.events.map((e) => ({ ...e, at, householdId: family.householdId, profileId: kid.id }))).catch(() => undefined);
  }
  const packNotesText = research.reads.length ? `## What Kix read in the ${research.loaded.join(" and ")} pack\n${research.reads.map((r) => r.text).join("\n\n")}` : teachingNotes(kid.level);
  const notes = [packNotesText, updateNotes(published), remembered].filter(Boolean).join("\n\n");
  const skills = { loaded: research.loaded, read: research.reads.map((r) => cleanTitle(r.title)), sections: research.reads.map((r) => r.id) };
  const asked = { nickname: kid.nickname, level: kid.level, band: kid.band, stage: input.stage };
  const head = await instructionsFor("ask-kix", askKixVars(asked), { store });
  try {
    const { data } = await sparkStructured(
      {
        messages: [
          { role: "system", content: systemPrompt({ ...asked, notes }, head) },
          { role: "user", content: userParts },
        ],
        schema: explanationSchema,
        schemaName: "kix_homework",
        reasoningEffort: "low",
      },
      { timeoutMs: 45_000, signal: request.signal },
    );
    return ok({ care: null, explanation: enforceStage(data, input.stage), sample: false, skills });
  } catch {
    // A slow or failed call never leaves the child stuck: the cached sample, labelled as one.
    return ok({ care: null, explanation: sampleExplanation(input.stage), sample: true });
  }
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** Picks and reads the pack sections for this question: by id when a later stage sends them back, otherwise by
 *  letting Muse Spark load the right pack and read what it needs. Never throws. */
async function researchSkills(o: { level: string | null; sections?: string[]; userParts: Part[]; pages: NotebookPage[]; signal: AbortSignal }) {
  const allowed = packsForChild(o.level);
  if (o.sections?.length) {
    const reads = o.sections.filter((id) => allowed.includes(id.split("/")[0])).flatMap((id) => {
      const r = readSection(id);
      return r ? [{ id, title: r.section.title, text: r.text }] : [];
    });
    return { loaded: [...new Set(reads.map((r) => r.id.split("/")[0]))], reads, events: [] };
  }
  try {
    const run = await runSkillAgent({
      agent: "ask-kix",
      level: o.level,
      autoPack: null,
      notebook: o.pages,
      system: [
        `You are the research step of Kix's homework help (Singapore ${o.level ?? "primary"}). Do not answer the question here.`,
        `1. Load the ONE pack for this question's subject with load_skill (the child's packs: ${allowed.join(", ")}).`,
        "2. Read the one or two sections that teach the method this question needs, with read_reference and ids from the section list you get back.",
        "3. Then reply with one short line: the subject and the method.",
      ].join("\n"),
      user: { role: "user", content: o.userParts },
      call: (req) => sparkTools({ ...req, reasoningEffort: "minimal", maxCompletionTokens: 1200 }, { timeoutMs: 15_000, signal: o.signal }),
    });
    const trace = publicTrace(run.state);
    return { loaded: trace.loaded, reads: run.state.reads, events: run.state.events };
  } catch {
    return { loaded: [], reads: [], events: [] };
  }
}
