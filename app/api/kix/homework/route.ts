// Ask Kix (homework help). The kid sends a typed question or a photo of it (already checked on the device for
// faces, shrunk and stripped of metadata), and a stage: hint, steps or full. Muse Spark (Standard) reads it and
// answers with a validated explanation spec drawn by trusted components. The photo is read once and never stored
// or logged; only the question text is kept, like any words to Kix. Distress words take the caring path instead.
import { z } from "zod";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { notebookNotes } from "@/lib/notebook/notebook";
import { enforceStage, explanationSchema, packsForLevel, sampleExplanation, STAGES, systemPrompt, teachingNotes } from "@/lib/kix/homework";
import { updateNotes } from "@/lib/knowledge/knowledge";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { getStore } from "@/lib/auth/context";
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
  const remembered = notebookNotes(kid.nickname, (await store?.notebook.pages(family.householdId, kid.id).catch(() => [])) ?? []);
  const notes = [teachingNotes(kid.level), updateNotes(published), remembered].filter(Boolean).join("\n\n");
  try {
    const { data } = await sparkStructured(
      {
        messages: [
          { role: "system", content: systemPrompt({ nickname: kid.nickname, level: kid.level, band: kid.band, stage: input.stage, notes }) },
          { role: "user", content: userParts },
        ],
        schema: explanationSchema,
        schemaName: "kix_homework",
        reasoningEffort: "low",
      },
      { timeoutMs: 45_000, signal: request.signal },
    );
    return ok({ care: null, explanation: enforceStage(data, input.stage), sample: false });
  } catch {
    // A slow or failed call never leaves the child stuck: the cached sample, labelled as one.
    return ok({ care: null, explanation: sampleExplanation(input.stage), sample: true });
  }
}
