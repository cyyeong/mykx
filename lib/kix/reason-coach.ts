// Kix's feedback on a child's reason (app/api/kix/reason): the structured shape Muse Spark answers in, and the
// same feedback from code when the model can't answer (from the reason check and the item's worked steps).
import { z } from "zod";
import { checkReason, modelReason } from "../domain/reason.ts";
import type { SkillItem } from "../types.ts";

const text = (n: number) => z.string().trim().min(1).max(n);
export const reasonCoachSchema = z.strictObject({
  /** good: the reason explains the science; partly: on the right track but missing a step; not-yet: off-topic, wrong idea, or empty. */
  verdict: z.enum(["good", "partly", "not-yet"]),
  /** To the child, about their REASON only (the app says whether the answer was right): starts "Your reason…",
   *  says what works and what is wrong or missing. Two short sentences at most. */
  feedback: text(240),
  /** A better reason in a 9-year-old's words (claim, evidence, reasoning). Null when the answer was wrong. */
  better: text(260).nullable(),
});
export type ReasonCoach = z.infer<typeof reasonCoachSchema>;

/** The answer in words: the chosen option's text, or what they typed. */
export const said = (item: SkillItem, choice: number | string | null) => (typeof choice === "number" ? (item.options?.[choice - 1] ?? "") : (choice ?? ""));

/** The same feedback from code, when the model can't answer. */
export function fallbackCoach(item: SkillItem, reason: string, correct: boolean): ReasonCoach {
  const r = checkReason(item, reason);
  const better = correct ? modelReason(item) : null;
  if (r.quality === "on-topic")
    return { verdict: "partly", feedback: `Your reason uses the right ideas (${r.used.slice(0, 3).join(", ")}). ${correct ? "Compare it with the stronger reason below." : "Check it against what you know, then try again."}`, better };
  const quoted = reason.trim() ? `Your reason, "${reason.trim().slice(0, 60)}", doesn't explain it yet.` : "You didn't give a reason yet.";
  return { verdict: "not-yet", feedback: `${quoted} A good reason says why, using what you know about this topic.`, better };
}

