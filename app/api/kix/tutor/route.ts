// Kix Tutor in the question player. The kid asks for a hint or asks "why?" (typed or by voice); Muse Spark
// (Standard) answers in a sentence or two and never gives the answer away. It runs as a Skill Engine agent
// (lib/skills/runtime.ts): the item's own pack is loaded (one of the kid's level's packs; another level's item is
// refused, lib/learn/subjects.ts), and Kix calls tools to read the section it needs, find a
// similar practice question, check one by code or load another of the child's packs; every load and tool call is
// logged as a skill event. Every ask counts as a hint, so a helped answer is never mastery evidence (rule 5).
// Without a model, or if the agent fails, the item's own next hint answers instead (rule 7). The prompt starts with
// the tutor's published instructions (editable in Under the hood) and its fixed guardrails (lib/agents).
import { z } from "zod";
import { instructionsFor } from "@/lib/agents/runtime";
import { hintSystem, tutorVars } from "@/lib/kix/tutor-prompt";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { getStore } from "@/lib/auth/context";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { itemForKid } from "@/lib/learn/subjects";
import { loadTender } from "@/lib/guardian/load";
import { toneNote } from "@/lib/kix/today";
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

function textReply(text: string, source: string, skill: string, trace: unknown = null): Response {
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
  // Only an item from the kid's own level's packs (lib/learn/subjects.ts).
  const access = itemForKid(kid.level, input.itemId);
  if (!access.ok) return access.reason === "other-level" ? fail(403, "not-allowed") : fail(404, "not-found");
  const { item, subject } = access;
  const SKILL = `${subject.id}@${subject.version}`;

  if (input.ask) {
    const check = checkWords(input.ask);
    await getStore()?.guardian.saveMessage(family.householdId, kid.id, { at: new Date().toISOString(), text: input.ask, source: "talk", ...check }).catch(() => undefined);
    if (check.distress) return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES } });
  }

  const hints = item.hints ?? [];
  const cached = hints[Math.min(input.hint, hints.length) - 1] ?? "Read the question again slowly. What is it really asking?";
  if (!hasMetaApiKey()) return textReply(cached, "cached", SKILL);

  const store = getStore();
  const pages = (await store?.notebook.pages(family.householdId, kid.id).catch(() => [])) ?? [];
  // A hard day yesterday makes today's hints gentler (lib/kix/today.ts); Kix never says why.
  const tender = store ? await loadTender(store, family.householdId, kid).catch(() => null) : null;
  const remembered = [notebookNotes(kid.nickname, pages), toneNote(tender)].filter(Boolean).join("\n\n");
  const system = hintSystem({ kid, item, remembered }, await instructionsFor("tutor", tutorVars(kid), { part: "hint", store }));
  const user = input.ask ? `${kid.nickname} asks: ${input.ask}` : `Give hint ${input.hint}: a nudge that builds on the earlier hints.`;

  try {
    const run = await runSkillAgent({
      agent: "tutor",
      level: kid.level,
      autoPack: subject.id,
      currentItemId: item.id,
      notebook: pages,
      system,
      user: { role: "user", content: user },
      call: (req) => sparkTools({ ...req, reasoningEffort: "minimal", maxCompletionTokens: 1500 }, { timeoutMs: 12_000, signal: request.signal }),
    });
    const at = new Date().toISOString();
    await store?.skills.log(run.state.events.map((e) => ({ ...e, at, householdId: family.householdId, profileId: kid.id }))).catch(() => undefined);
    const text = run.text.trim();
    if (!text) return textReply(cached, "cached", SKILL);
    const skills = run.state.loaded.map((id) => `${id}@${loadPack(id)?.version ?? "1.0.0"}`).join(", ") || SKILL;
    return textReply(text, "muse-spark-1.3", skills, publicTrace(run.state));
  } catch {
    return textReply(cached, "cached", SKILL);
  }
}
