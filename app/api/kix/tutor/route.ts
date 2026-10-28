// Kix Tutor in the question player. The kid asks for a hint or asks "why?" (typed or by voice); Muse Spark
// (Standard) answers in a sentence or two and never gives the answer away. It runs as a Skill Engine agent
// (lib/skills/runtime.ts): the quest's pack is loaded, and Kix calls tools to read the section it needs, find a
// similar practice question, check one by code or load another of the child's packs; every load and tool call is
// logged as a skill event. Every ask counts as a hint, so a helped answer is never mastery evidence (rule 5).
// Without a model, or if the agent fails, the item's own next hint answers instead (rule 7).
import { z } from "zod";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { getStore } from "@/lib/auth/context";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { FROG_QUEST, loadFrogItems } from "@/lib/learn/frog-quest";
import { notebookNotes } from "@/lib/notebook/notebook";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkTools } from "@/lib/meta/spark";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { loadPack, publicTrace, runSkillAgent } from "@/lib/skills/runtime";
import { logRunsFor } from "@/lib/runs/log";

const body = z.strictObject({
  itemId: z.string().min(1).max(100),
  /** The hint number the kid is now on (1-based), for the cached fallback. */
  hint: z.number().int().min(1).max(10),
  /** The kid's own question ("why is it the tadpole?"), typed or transcribed. */
  ask: z.string().trim().max(300).optional(),
});

const SKILL = `${FROG_QUEST.skill}@${FROG_QUEST.version}`;

function textReply(text: string, source: string, skill = SKILL, trace: unknown = null): Response {
  const headers: Record<string, string> = { "content-type": "text/plain; charset=utf-8", "x-kix-skill": skill, "x-kix-source": source, "cache-control": "no-store" };
  if (trace) headers["x-kix-trace"] = encodeURIComponent(JSON.stringify(trace));
  return new Response(text, { headers });
}

export async function POST(request: Request) {
  const family = await requireFamily(request, "tutor", 20);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  logRunsFor("tutor", family.householdId, kid.id);
  await refreshSkillOverrides(getStore()); // the packs' published versions (lib/skills/overrides.ts)
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  const item = loadFrogItems().find((i) => i.id === input.itemId);
  if (!item) return fail(404, "not-found");

  if (input.ask) {
    const check = checkWords(input.ask);
    await getStore()?.guardian.saveMessage(family.householdId, kid.id, { at: new Date().toISOString(), text: input.ask, source: "talk", ...check }).catch(() => undefined);
    if (check.distress) return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES } });
  }

  const hints = item.hints ?? [];
  const choices = item.options ?? [];
  const cached = hints[Math.min(input.hint, hints.length) - 1] ?? "Read the question again slowly. What is it really asking?";
  if (!hasMetaApiKey()) return textReply(cached, "cached");

  const store = getStore();
  const pages = (await store?.notebook.pages(family.householdId, kid.id).catch(() => [])) ?? [];
  const remembered = notebookNotes(kid.nickname, pages);
  const options = choices.length ? `\nOptions: ${choices.map((o, i) => `(${i + 1}) ${o}`).join("  ")}` : "";
  const system = [
    `You are Kix, ${kid.nickname}'s friendly study sidekick (Singapore ${kid.level ?? "P3"}). You are helping with one question during a quest.`,
    "Answer in at most two short sentences a 9-year-old can read aloud. Warm, concrete, no baby talk.",
    "NEVER say the answer, which option is right, or the final word or number. Point to the thinking: what to notice, what to compare, the next small step.",
    "Use the pack's method (e.g. claim, evidence, reasoning for science explanations).",
    "If the child asks something off-topic or unsafe, kindly bring them back to the question.",
    "",
    `# The question\n${item.stem}${options}`,
    `# The worked steps (for you only; never repeat the conclusion)\n${(item.working ?? []).join("\n")}`,
    `# The item's own hints, in order\n${hints.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
    `This question is item ${item.id}. You may never check_answer it: the child submits their own answer.`,
    remembered,
  ]
    .filter(Boolean)
    .join("\n");
  const user = input.ask ? `${kid.nickname} asks: ${input.ask}` : `Give hint ${input.hint}: a nudge that builds on the earlier hints.`;

  try {
    const run = await runSkillAgent({
      agent: "tutor",
      level: kid.level,
      autoPack: FROG_QUEST.skill,
      currentItemId: item.id,
      notebook: pages,
      system,
      user: { role: "user", content: user },
      call: (req) => sparkTools({ ...req, reasoningEffort: "minimal", maxCompletionTokens: 1500 }, { timeoutMs: 12_000, signal: request.signal }),
    });
    const at = new Date().toISOString();
    await store?.skills.log(run.state.events.map((e) => ({ ...e, at, householdId: family.householdId, profileId: kid.id }))).catch(() => undefined);
    const text = run.text.trim();
    if (!text) return textReply(cached, "cached");
    const skills = run.state.loaded.map((id) => `${id}@${loadPack(id)?.version ?? "1.0.0"}`).join(", ") || SKILL;
    return textReply(text, "muse-spark-1.3", skills, publicTrace(run.state));
  } catch {
    return textReply(cached, "cached");
  }
}
