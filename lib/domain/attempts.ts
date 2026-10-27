// The learner record's attempt event and question families (PRD §6).
//
// A *question family* groups items that test the same thing in the same way: variants with
// other numbers, and the subparts (a), (b), (c) of one question. Only the earliest eligible
// attempt in a family is mastery evidence; later variants and retries count as practice.
//
// The item schema (lib/types.ts) has no explicit family field yet, so `familyOf` derives one:
// an explicit `family` if a caller supplies it, else the item id with a trailing subpart letter
// removed ("p3math-mock-02-m2-c22b" → "p3math-mock-02-m2-c22").
import type { ItemType, SkillItem } from "../types.ts";
import type { Iso } from "./time.ts";

/** A parent's or admin's score correction. The latest one (by time) wins; recompute replays. */
export interface ScoreRevision {
  marks: number;
  at: Iso;
  by?: "parent" | "admin" | "system";
}

/** One submitted answer, as the app records it (a superset of the `attempts` row). */
export interface AttemptEvent {
  id: string;
  itemId: string;
  /** Question family; variants share it. */
  family: string;
  /** Subparts of one question share this (defaults to `itemId`) and add up to one family contribution. */
  question?: string;
  skill: string;
  topic: string;
  subskill: string;
  at: Iso;
  marks: number;
  maxMarks: number;
  /** The learner's first submission on this item (not a retry). */
  firstTry: boolean;
  /** Hints opened before this submission. */
  hintsBeforeSubmit: number;
  /** The answer was shown before this submission. Never mastery evidence. */
  revealed: boolean;
  /**
   * The score is final: objective items are confirmed when marked; open items only when a
   * parent or admin confirms the rubric score. Self-checks are never confirmed.
   */
  confirmed: boolean;
  revisions?: ScoreRevision[];
  /** The child gave their own explanation with this answer (FR10). */
  explanation?: boolean;
  /** On a retry: the child changed their explanation (FR10). */
  explanationRevised?: boolean;
}

/** The item fields the domain code needs, plus an optional explicit family. */
export type PracticeItem = Pick<SkillItem, "id" | "skill" | "topic" | "subskill" | "difficulty" | "marks" | "type" | "status"> & {
  family?: string;
};

/** Item types that deterministic marking can score, so they can move mastery straight away. */
export const OBJECTIVE_TYPES: readonly ItemType[] = ["mcq", "short"];

const SUBPART = /^(.*\d)([a-z])$/;

/** The question an item belongs to: its id without a trailing subpart letter. */
export function questionOf(item: Pick<SkillItem, "id">): string {
  const m = SUBPART.exec(item.id);
  return m ? m[1] : item.id;
}

/** The subpart letter ("a", "b"…) or null for a single-part question. */
export function partOf(item: Pick<SkillItem, "id">): string | null {
  return SUBPART.exec(item.id)?.[2] ?? null;
}

/** The item's question family: an explicit `family`, else its question. */
export function familyOf(item: Pick<SkillItem, "id"> & { family?: string }): string {
  return item.family ?? questionOf(item);
}

/** One key per enrolment subskill: mastery is kept separately for each. */
export function subskillKey(x: { skill: string; topic: string; subskill: string }): string {
  return `${x.skill}/${x.topic}/${x.subskill}`;
}

/** The marks that count for an attempt: the latest score revision if there is one. */
export function effectiveMarks(e: Pick<AttemptEvent, "marks" | "revisions">): number {
  if (!e.revisions?.length) return e.marks;
  let latest = e.revisions[0];
  for (const r of e.revisions) if (Date.parse(r.at) >= Date.parse(latest.at)) latest = r;
  return latest.marks;
}

/** Full marks after revisions, no hints, no reveal, confirmed: an independent success. */
export function isIndependentSuccess(e: AttemptEvent): boolean {
  return e.confirmed && !e.revealed && e.hintsBeforeSubmit <= 0 && effectiveMarks(e) >= e.maxMarks;
}

/** A confirmed answer below full marks, or one whose answer was revealed. */
export function isError(e: AttemptEvent): boolean {
  return e.revealed || (e.confirmed && effectiveMarks(e) < e.maxMarks);
}
