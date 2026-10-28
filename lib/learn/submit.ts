// Submitting an answer: mark deterministically, store the attempt, recompute
// mastery and pay the ledger (HANDOFF task 2). Server only. The route at
// app/api/attempts authenticates and parses; this module does the work so
// tests can run it against the demo store.
import { randomUUID } from "node:crypto";
import type { AuthStore, StoredAttempt } from "../auth/store.ts";
import { familyOf, subskillKey, type AttemptEvent } from "../domain/attempts.ts";
import { markItem } from "../domain/marking.ts";
import { describeMastery, recompute } from "../domain/mastery.ts";
import { awardsFor, pointsOnDay, DAILY_CAP, type LedgerEntry } from "../domain/rewards.ts";
import { sgDate } from "../domain/time.ts";
import { FROG_QUEST, loadFrogItems } from "./frog-quest.ts";
import { caringReply, checkWords, HELPLINES } from "../guardian/words.ts";
import type { SkillItem } from "../types.ts";

export interface AttemptInput {
  itemId: string;
  /** Option number for mcq, text otherwise. */
  response: number | string | null;
  /** The child's own explanation, if they gave one (FR10: the player asks). */
  explanation: string | null;
  hintsUsed: number;
  /** The answer was shown before submitting. Never mastery evidence. */
  revealed: boolean;
  /** Client-generated per submission; a resend lands once (J17). */
  key: string;
  /** Time from the question showing to this submission, for the guardian's focus signal only. */
  durationMs?: number | null;
}

export interface SubmitResult {
  attemptId: string;
  correct: boolean | null;
  marks: number | null;
  maxMarks: number;
  firstTry: boolean;
  /** Honest mastery label for the item's subskill, e.g. "57/100; limited evidence: two families". */
  mastery: string;
  /** Kix's kind explanation for a wrong answer (the matched distractor, else a generic line). */
  note: string | null;
  /** Worked solution, only on a revealed "show me how" submit. */
  working: string[] | null;
  /** What this submission paid (rules, amounts, cap notes). */
  awards: { rule: LedgerEntry["rule"]; amount: number; note?: string }[];
  starsToday: number;
  /** This submission hit the 15-a-day cap. Learning still counts. */
  capReached: boolean;
  /** The child's reason held distress or safety words: Kix's caring reply and the helplines (rule 12). */
  care: { reply: string; helplines: typeof HELPLINES } | null;
}

const nowIso = () => new Date().toISOString();

function findItem(itemId: string): SkillItem | null {
  return loadFrogItems().find((i) => i.id === itemId) ?? null;
}

/**
 * Marks one submission and records it. Unknown items throw "unknown-item";
 * non-objective types throw "needs-review" (open items need a parent or
 * admin to confirm the rubric before mastery may move). Resubmits with the
 * same key return recomputed state without writing twice.
 */
export async function submitAttempt(
  store: AuthStore,
  householdId: string,
  kidId: string,
  input: AttemptInput,
): Promise<SubmitResult> {
  const item = findItem(input.itemId);
  if (!item) throw new Error("unknown-item");
  if (item.type !== "mcq" && item.type !== "short") throw new Error("needs-review");

  // An offline resend with a spent key returns the stored result's state and
  // mints nothing: the first submission already paid out (or not).
  const prior = await store.learn.attemptByKey(householdId, kidId, input.key);
  if (prior) return submitState(store, householdId, kidId, prior);

  const before = await store.learn.attempts(householdId, kidId);
  const firstTry = !before.some((a) => a.itemId === item.id);
  const mark = markItem(item, input.response);
  const explanationText = input.explanation?.trim() ? input.explanation.trim() : null;
  const at = nowIso();
  const attempt: AttemptEvent = {
    id: randomUUID(),
    itemId: item.id,
    family: familyOf({ id: item.id }),
    skill: item.skill,
    topic: item.topic,
    subskill: item.subskill,
    at,
    marks: mark.marks ?? 0,
    maxMarks: mark.maxMarks,
    firstTry,
    hintsBeforeSubmit: Math.max(0, Math.floor(input.hintsUsed)),
    revealed: input.revealed,
    confirmed: mark.confirmed,
    ...(explanationText ? { explanation: true } : {}),
    // A retry's fresh explanation is the revised one (the player asks the
    // child to say it again in their own words); copying a reveal never pays.
    ...(!firstTry && explanationText && !input.revealed ? { explanationRevised: true } : {}),
    ...(typeof input.durationMs === "number" ? { durationMs: Math.max(0, Math.round(input.durationMs)) } : {}),
  };
  const note = mark.correct ? null : wrongNote(item, input.response);
  const working = input.revealed ? (item.working ?? []) : null;
  const stored: StoredAttempt = {
    ...attempt,
    idempotencyKey: input.key,
    answer: input.response,
    explanationText,
    skillVersion: FROG_QUEST.version,
  };
  await store.learn.saveAttempt(householdId, kidId, stored);
  // The reason is the child's own words to Kix: the guardian's safety check runs on it like any message.
  const words = explanationText ? checkWords(explanationText) : null;
  if (explanationText && words) {
    // Never lets the guardian's record stop an answer from landing (the caring reply below still shows).
    await store.guardian.saveMessage(householdId, kidId, { at, text: explanationText.slice(0, 500), source: "reason", ...words }).catch(() => undefined);
  }
  const care = words?.distress ? { reply: caringReply((await store.kid(householdId, kidId))?.nickname ?? "friend"), helplines: HELPLINES } : null;

  const attempts = await store.learn.attempts(householdId, kidId);
  const ledger = await store.learn.ledger(householdId, kidId);
  const fresh = awardsFor({ type: "attempt", attempt }, { ledger, attempts });
  await store.learn.saveLedgerEntries(householdId, kidId, fresh);
  const ledgerAfter = await store.learn.ledger(householdId, kidId);

  const key = subskillKey(item);
  const mine = attempts.filter((a) => subskillKey(a) === key);
  const mastery = describeMastery(recompute(mine, at));
  const day = sgDate(at);
  const starsToday = pointsOnDay(ledgerAfter, day);
  return {
    attemptId: attempt.id,
    correct: mark.correct,
    marks: mark.marks,
    maxMarks: mark.maxMarks,
    firstTry,
    mastery,
    note,
    working,
    awards: fresh.map((e) => ({ rule: e.rule, amount: e.amount, ...(e.note ? { note: e.note } : {}) })),
    starsToday,
    capReached: starsToday >= DAILY_CAP,
    care,
  };
}

/** Kix explains a wrong answer kindly: the matched distractor, else a generic line. Never the answer. */
function wrongNote(item: SkillItem, response: number | string | null): string {
  const key = String(response ?? "").trim();
  const matched = item.distractors?.[key];
  if (matched) return `${matched} Try again.`;
  return "Not quite. Have another look and try again.";
}

/** Recomputed state for a resubmitted key: same result, no new awards. */
async function submitState(store: AuthStore, householdId: string, kidId: string, attempt: AttemptEvent): Promise<SubmitResult> {
  const attempts = await store.learn.attempts(householdId, kidId);
  const ledger = await store.learn.ledger(householdId, kidId);
  const key = subskillKey({ skill: attempt.skill, topic: attempt.topic, subskill: attempt.subskill });
  const mine = attempts.filter((a) => subskillKey(a) === key);
  const mastery = describeMastery(recompute(mine, attempt.at));
  const day = sgDate(attempt.at);
  const starsToday = pointsOnDay(ledger, day);
  return {
    attemptId: attempt.id,
    correct: attempt.marks >= attempt.maxMarks,
    marks: attempt.marks,
    maxMarks: attempt.maxMarks,
    firstTry: attempt.firstTry,
    mastery,
    note: null,
    working: null,
    awards: [],
    starsToday,
    capReached: starsToday >= DAILY_CAP,
    care: null, // the first submission already answered with care; a resend doesn't repeat it
  };
}
