// Submitting an answer: mark deterministically, store the attempt, recompute
// mastery and pay the ledger (HANDOFF task 2). Server only. The route at
// app/api/attempts authenticates and parses; this module does the work so
// tests can run it against the demo store.
//
// Any reviewed item from the kid's own level's packs may be answered (lib/learn/subjects.ts); an item from another
// level's pack is refused. Multiple choice and short answers are marked by code. A word card becomes a question
// code can mark (lib/learn/cards.ts). A written (open) answer is saved as practice: code can't mark it, so it is
// never mastery evidence until a grown-up confirms a score (PRD FR04-05), and Kix's model answer is shown once the
// kid's own answer is in.
import { randomUUID } from "node:crypto";
import type { AuthStore, StoredAttempt } from "../auth/store.ts";
import { familyOf, subskillKey, type AttemptEvent } from "../domain/attempts.ts";
import { markItem } from "../domain/marking.ts";
import { checkReason, modelReason, type ReasonCheck, type ReasonQuality } from "../domain/reason.ts";
import { describeMastery, recompute } from "../domain/mastery.ts";
import { awardsFor, pointsOnDay, DAILY_CAP, type LedgerEntry } from "../domain/rewards.ts";
import { sgDate } from "../domain/time.ts";
import { caringReply, checkWords, HELPLINES } from "../guardian/words.ts";
import type { SkillItem } from "../types.ts";
import { cardQuestion, cardResponse, type CardQuestion } from "./cards.ts";
import { itemForKid, type Subject } from "./subjects.ts";

export interface AttemptInput {
  itemId: string;
  /** Option number for mcq (and a word card's meaning), text otherwise. */
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

export type AnswerKind = "marked" | "card" | "written";

export interface SubmitResult {
  attemptId: string;
  /** Null for a written answer: code doesn't mark it. */
  correct: boolean | null;
  marks: number | null;
  maxMarks: number;
  firstTry: boolean;
  /** Honest mastery label for the item's subskill, e.g. "57/100; limited evidence: two families". */
  mastery: string;
  /** Kix's kind explanation for a wrong answer (the matched distractor, else a generic line). */
  note: string | null;
  /** Worked solution: on a revealed "show me how" submit, and after a written answer. */
  working: string[] | null;
  /** What this submission paid (rules, amounts, cap notes). */
  awards: { rule: LedgerEntry["rule"]; amount: number; note?: string }[];
  starsToday: number;
  /** This submission hit the 15-a-day cap. Learning still counts. */
  capReached: boolean;
  /** The child's reason held distress or safety words: Kix's caring reply and the helplines (rule 12). */
  care: { reply: string; helplines: typeof HELPLINES } | null;
  /** The reason, checked in code: only an on-topic reason earns the explanation stars. `better` is a model reason
   *  from the worked steps, given once the answer is right or shown (never before, so a retry isn't spoiled). */
  reason: { quality: ReasonQuality; used: string[]; better: string | null };
  /** The right answer (option number or text), once it's reached or shown; never before, so a retry is theirs.
   *  For a written answer: Kix's model answer, once the kid's own is in. */
  answer: number | string | null;
  /** Marked by code, a word card marked by code, or a written answer saved as practice (never mastery evidence). */
  kind: AnswerKind;
  /** A written answer's key ideas (the pack's keywords), to compare with the kid's own. */
  keyIdeas: string[] | null;
}

const nowIso = () => new Date().toISOString();

/** A word card's question, rebuilt exactly as the player built it (same card, same deck, same options). */
export function cardFor(item: SkillItem, subject: Pick<Subject, "items">): CardQuestion {
  return cardQuestion(
    item,
    subject.items.filter((i) => i.type === "card"),
  );
}

const kindOf = (item: Pick<SkillItem, "type">): AnswerKind => (item.type === "card" ? "card" : item.type === "open" ? "written" : "marked");

/**
 * Marks one submission and records it. Unknown items throw "unknown-item"; an item from another level's pack
 * throws "other-level"; a written answer with no words (and not a "show me") throws "invalid". Resubmits with the
 * same key return recomputed state without writing twice.
 */
export async function submitAttempt(
  store: AuthStore,
  householdId: string,
  kidId: string,
  input: AttemptInput,
): Promise<SubmitResult> {
  const kid = await store.kid(householdId, kidId);
  const access = itemForKid(kid?.level ?? null, input.itemId);
  if (!access.ok) throw new Error(access.reason === "other-level" ? "other-level" : "unknown-item");
  const { item, subject } = access;
  const kind = kindOf(item);
  const card = kind === "card" ? cardFor(item, subject) : null;
  const writtenText = kind === "written" && typeof input.response === "string" ? input.response.trim().slice(0, 500) : "";
  if (kind === "written" && !input.revealed && !writtenText) throw new Error("invalid");

  // An offline resend with a spent key returns the stored result's state and
  // mints nothing: the first submission already paid out (or not).
  const prior = await store.learn.attemptByKey(householdId, kidId, input.key);
  if (prior) return submitState(store, householdId, kidId, prior, item);

  const before = await store.learn.attempts(householdId, kidId);
  const firstTry = !before.some((a) => a.itemId === item.id);
  const mark = card ? markItem(card.markable, cardResponse(card.mode, input.response)) : markItem(item, input.response);
  // A written answer is its own explanation; a word card has none (it never asks why).
  const explanationText = kind === "card" ? null : kind === "written" ? writtenText || null : input.explanation?.trim() ? input.explanation.trim() : null;
  const reason: ReasonCheck = kind === "card" ? { quality: "none", used: [] } : checkReason(item, explanationText);
  // Only a real reason (three words or more, using the question's ideas) counts as the child's explanation (FR10).
  const counted = reason.quality === "on-topic";
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
    // A written answer is never confirmed here: it is practice until a grown-up confirms a score.
    confirmed: mark.confirmed,
    ...(counted ? { explanation: true } : {}),
    // A retry's fresh explanation is the revised one (the player asks the
    // child to say it again in their own words); copying a reveal never pays.
    ...(!firstTry && counted && !input.revealed && kind === "marked" ? { explanationRevised: true } : {}),
    ...(typeof input.durationMs === "number" ? { durationMs: Math.max(0, Math.round(input.durationMs)) } : {}),
  };
  const note = mark.correct || kind === "written" ? null : card ? "Not quite. Have another look and try again." : wrongNote(item, input.response);
  // A written answer gets Kix's working once the kid's own answer is in (there's no retry to spoil).
  const working = input.revealed || kind === "written" ? (item.working ?? []) : null;
  const stored: StoredAttempt = {
    ...attempt,
    idempotencyKey: input.key,
    answer: input.response,
    explanationText,
    skillVersion: subject.version,
  };
  await store.learn.saveAttempt(householdId, kidId, stored);
  // The reason is the child's own words to Kix: the guardian's safety check runs on it like any message.
  const words = explanationText ? checkWords(explanationText) : null;
  if (explanationText && words) {
    // Never lets the guardian's record stop an answer from landing (the caring reply below still shows).
    await store.guardian.saveMessage(householdId, kidId, { at, text: explanationText.slice(0, 500), source: "reason", ...words }).catch(() => undefined);
  }
  const care = words?.distress ? { reply: caringReply(kid?.nickname ?? "friend"), helplines: HELPLINES } : null;

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
  const reached = Boolean(mark.correct) || input.revealed;
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
    reason: { quality: reason.quality, used: reason.used, better: kind === "marked" && reached ? modelReason(item) : null },
    answer: kind === "written" ? item.answer : reached ? (card ? card.markable.answer : item.answer) : null,
    kind,
    keyIdeas: kind === "written" ? (item.keywords ?? null) : null,
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
async function submitState(store: AuthStore, householdId: string, kidId: string, attempt: AttemptEvent, item: SkillItem): Promise<SubmitResult> {
  const attempts = await store.learn.attempts(householdId, kidId);
  const ledger = await store.learn.ledger(householdId, kidId);
  const key = subskillKey({ skill: attempt.skill, topic: attempt.topic, subskill: attempt.subskill });
  const mine = attempts.filter((a) => subskillKey(a) === key);
  const mastery = describeMastery(recompute(mine, attempt.at));
  const day = sgDate(attempt.at);
  const starsToday = pointsOnDay(ledger, day);
  const kind = kindOf(item);
  return {
    attemptId: attempt.id,
    correct: kind === "written" ? null : attempt.marks >= attempt.maxMarks,
    marks: kind === "written" ? null : attempt.marks,
    maxMarks: attempt.maxMarks,
    firstTry: attempt.firstTry,
    mastery,
    note: null,
    working: null,
    awards: [],
    starsToday,
    capReached: starsToday >= DAILY_CAP,
    care: null, // the first submission already answered with care; a resend doesn't repeat it
    reason: { quality: attempt.explanation ? "on-topic" : "none", used: [], better: null },
    answer: kind === "written" ? item.answer : null,
    kind,
    keyIdeas: kind === "written" ? (item.keywords ?? null) : null,
  };
}
