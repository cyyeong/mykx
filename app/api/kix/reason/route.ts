// Kix on the child's "Why do you think so?" reason, after an answer is marked. Muse Spark (Standard, structured)
// reads the question, its worked steps and the pack's method (claim, evidence, reasoning), with the child's choice
// and their own words, and says kindly what is right or missing in THEIR reason. When the answer was right it also
// gives a better reason in a child's words; when it was wrong it never gives the answer away (the retry is theirs).
// Narration only: the stars were already decided in code (lib/domain/reason.ts, rule 5). Without a model, or if it
// fails, the same check in code answers with the item's worked steps (rule 7). The prompt is the Kix Tutor's
// "Reason feedback" instructions (editable in Under the hood) and their fixed guardrails (lib/agents).
import { z } from "zod";
import { instructionsFor } from "@/lib/agents/runtime";
import { requireFamily } from "@/lib/auth/guard";
import { reasonSystem, tutorVars } from "@/lib/kix/tutor-prompt";
import { fail, ok, readBody } from "@/lib/auth/http";
import { checkWords } from "@/lib/guardian/words";
import { packNotes } from "@/lib/kix/homework";
import { fallbackCoach, reasonCoachSchema, said } from "@/lib/kix/reason-coach";
import { itemForKid } from "@/lib/learn/subjects";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { logRunsFor } from "@/lib/runs/log";
import { getStore } from "@/lib/auth/context";
import { refreshSkillOverrides } from "@/lib/skills/overrides";

const body = z.strictObject({
  itemId: z.string().min(1).max(100),
  /** The option chosen (1-based) or the typed answer. */
  choice: z.union([z.number().int().min(1).max(6), z.string().max(200), z.null()]),
  reason: z.string().max(500),
  correct: z.boolean(),
});

export async function POST(request: Request) {
  const family = await requireFamily(request, "tutor", 30);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  logRunsFor("tutor", family.householdId, kid.id);
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  // Only an item from the kid's own level's packs (lib/learn/subjects.ts).
  const access = itemForKid(kid.level, input.itemId);
  if (!access.ok) return access.reason === "other-level" ? fail(403, "not-allowed") : fail(404, "not-found");
  const { item, subject } = access;
  // A word card has no reason to coach, and a written answer is compared with Kix's model answer instead.
  if (item.type === "card" || item.type === "open") return ok({ coach: null });
  // A reason with distress words was already answered with care when the attempt landed (rule 12).
  if (checkWords(input.reason).distress) return ok({ coach: null });
  const fallback = fallbackCoach(item, input.reason, input.correct);
  if (!hasMetaApiKey() || !input.reason.trim()) return ok({ coach: fallback, source: "code" });
  await refreshSkillOverrides(getStore()); // the pack's published version (lib/skills/overrides.ts)

  const right = item.type === "mcq" && typeof item.answer === "number" ? (item.options?.[item.answer - 1] ?? "") : String(item.answer);
  const head = await instructionsFor("tutor", tutorVars(kid, { correct: input.correct }), { part: "reason" });
  const system = reasonSystem({ kid, item, correct: input.correct, right, pack: subject.id, notes: packNotes(subject.id) }, head);
  try {
    const { data } = await sparkStructured(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${kid.nickname} chose: ${said(item, input.choice)}\n${kid.nickname}'s reason: ${input.reason.trim()}` },
        ],
        schema: reasonCoachSchema,
        schemaName: "reason_coach",
        reasoningEffort: "low",
      },
      { timeoutMs: 15_000, signal: request.signal },
    );
    // The rules hold whatever the model says: no better reason after a wrong answer.
    return ok({ coach: { ...data, better: input.correct ? data.better : null }, source: "spark" });
  } catch {
    return ok({ coach: fallback, source: "code" });
  }
}
