// Mastery index per enrolment subskill, exactly as PRD §6 specifies:
//
//   recompute(events):
//     eligible = confirmed first attempts, excluding answer-revealed attempts
//     eligible = earliest attempt per question_family, using latest score revision
//     m = 0.5
//     for e in latest_10(eligible, chronological):
//       q = clamp(e.marks/e.max_marks - 0.2*min(e.hints_before_submit,2), 0, 1)
//       if e.hints_before_submit > 0: q = min(q,m)  # assisted success cannot raise m
//       m = 0.7*m + 0.3*q
//     return m, distinct_family_count, dates, last_practised
//
// m is an uncalibrated index, not a probability of exam success. Subparts of the family's
// earliest question add up to one contribution. Score corrections are handled by recomputing
// from the full event list (replay). Models never call this with invented scores (rule 5).
import { type AttemptEvent, effectiveMarks } from "./attempts.ts";
import { type Iso, clamp, daysBetween, sgDate, toMs } from "./time.ts";

export const PRIOR = 0.5;
export const WINDOW = 10;
export const ALPHA = 0.3;
export const HINT_PENALTY = 0.2;
export const MAX_PENALISED_HINTS = 2;
export const LIMITED_BELOW_FAMILIES = 5;
export const LIMITED_BELOW_DATES = 2;
export const STALE_AFTER_DAYS = 14;

export type Confidence = "none" | "limited" | "developing";

/** One family's evidence: its earliest eligible question, all of that question's parts summed. */
export interface FamilyContribution {
  family: string;
  question: string;
  itemIds: string[];
  at: Iso;
  /** Singapore date of `at`. */
  date: string;
  marks: number;
  maxMarks: number;
  /** Most hints opened on any part (the penalty caps at two anyway). */
  hints: number;
}

export interface MasteryStep {
  family: string;
  at: Iso;
  q: number;
  before: number;
  after: number;
  assisted: boolean;
}

export interface MasteryState {
  /** The index, 0–1; null until there is evidence (the .5 prior is never shown). */
  m: number | null;
  /** Distinct families behind m (at most WINDOW). */
  families: number;
  /** Every eligible family ever seen for this subskill. */
  totalFamilies: number;
  /** Distinct Singapore dates behind m. */
  dates: string[];
  lastPractised: Iso | null;
  confidence: Confidence;
  stale: boolean;
  /** Whole days since lastPractised, or null. */
  daysSincePractice: number | null;
  /** Completion counts, shown separately from mastery: every submission, including retries and reveals. */
  completion: { attempts: number; firstAttempts: number; retries: number; revealed: number; fullMarks: number };
  steps: MasteryStep[];
}

function valid(e: AttemptEvent): boolean {
  const m = effectiveMarks(e);
  return Number.isFinite(m) && Number.isFinite(e.maxMarks) && e.maxMarks > 0 && Number.isFinite(toMs(e.at));
}

function hintsOf(e: AttemptEvent): number {
  const h = Number(e.hintsBeforeSubmit);
  return Number.isFinite(h) && h > 0 ? Math.floor(h) : 0;
}

function byTime(a: { at: Iso; id?: string }, b: { at: Iso; id?: string }): number {
  return toMs(a.at) - toMs(b.at) || (a.id ?? "").localeCompare(b.id ?? "");
}

/**
 * The evidence the mastery index reads, oldest first: confirmed, unrevealed first attempts; the
 * earliest per family; that question's parts summed. Pass one subskill's events for mastery, or
 * every event to count independent successes across subjects.
 */
export function familyContributions(events: readonly AttemptEvent[]): FamilyContribution[] {
  const eligible = events.filter((e) => e.confirmed && e.firstTry && !e.revealed && valid(e)).sort(byTime);
  // One first attempt per item: a duplicate "first try" (a double submit) never counts twice.
  const firstPerItem = new Map<string, AttemptEvent>();
  for (const e of eligible) if (!firstPerItem.has(e.itemId)) firstPerItem.set(e.itemId, e);

  const byFamily = new Map<string, AttemptEvent[]>();
  for (const e of firstPerItem.values()) {
    const list = byFamily.get(e.family);
    if (list) list.push(e);
    else byFamily.set(e.family, [e]);
  }

  const out: FamilyContribution[] = [];
  for (const [family, list] of byFamily) {
    const earliest = list[0]; // list is in time order
    const question = earliest.question ?? earliest.itemId;
    const parts = list.filter((e) => (e.question ?? e.itemId) === question);
    let marks = 0;
    let maxMarks = 0;
    let hints = 0;
    for (const p of parts) {
      marks += clamp(effectiveMarks(p), 0, p.maxMarks);
      maxMarks += p.maxMarks;
      hints = Math.max(hints, hintsOf(p));
    }
    out.push({ family, question, itemIds: parts.map((p) => p.itemId), at: earliest.at, date: sgDate(earliest.at), marks, maxMarks, hints });
  }
  return out.sort((a, b) => toMs(a.at) - toMs(b.at) || a.family.localeCompare(b.family));
}

/** The update rule for one contribution. */
export function step(m: number, c: Pick<FamilyContribution, "marks" | "maxMarks" | "hints">): { q: number; next: number } {
  let q = clamp(c.marks / c.maxMarks - HINT_PENALTY * Math.min(c.hints, MAX_PENALISED_HINTS), 0, 1);
  if (c.hints > 0) q = Math.min(q, m); // assisted success cannot raise m
  return { q, next: (1 - ALPHA) * m + ALPHA * q };
}

/** m over the latest WINDOW families of `cs`, from the prior. */
function windowScore(cs: readonly FamilyContribution[]): number {
  let m = PRIOR;
  for (const c of cs.slice(-WINDOW)) m = step(m, c).next;
  return m;
}

/** Recomputes one subskill's mastery from its full event history. `now` decides staleness. */
export function recompute(events: readonly AttemptEvent[], now: Iso | number): MasteryState {
  const contributions = familyContributions(events);
  const window = contributions.slice(-WINDOW);
  let m = PRIOR;
  const steps: MasteryStep[] = [];
  for (const c of window) {
    const { q, next } = step(m, c);
    steps.push({ family: c.family, at: c.at, q, before: m, after: next, assisted: c.hints > 0 });
    m = next;
  }
  // The window slides: dropping its oldest family can lift m even when the newest family was assisted. The rule
  // is "assisted success cannot raise m", so replay the history and never let an assisted family lift the score
  // shown before it (the soak found +0.012 at most, 3 times in 67k questions).
  if (contributions.length > WINDOW) {
    let shown = windowScore(contributions.slice(0, WINDOW));
    for (let k = WINDOW + 1; k <= contributions.length; k++) {
      const score = windowScore(contributions.slice(0, k));
      shown = contributions[k - 1].hints > 0 ? Math.min(score, shown) : score;
    }
    m = shown;
  }
  const dates = [...new Set(window.map((c) => c.date))].sort();
  const last = window.at(-1) ?? null;
  const daysSince = last ? Math.max(0, Math.floor(daysBetween(last.at, now))) : null;
  const families = window.length;
  const confidence: Confidence =
    families === 0 ? "none" : families < LIMITED_BELOW_FAMILIES || dates.length < LIMITED_BELOW_DATES ? "limited" : "developing";

  const submitted = events.filter(valid);
  return {
    m: families === 0 ? null : m,
    families,
    totalFamilies: contributions.length,
    dates,
    lastPractised: last?.at ?? null,
    confidence,
    stale: last !== null && daysBetween(last.at, now) > STALE_AFTER_DAYS,
    daysSincePractice: daysSince,
    completion: {
      attempts: submitted.length,
      firstAttempts: submitted.filter((e) => e.firstTry).length,
      retries: submitted.filter((e) => !e.firstTry).length,
      revealed: submitted.filter((e) => e.revealed).length,
      fullMarks: submitted.filter((e) => effectiveMarks(e) >= e.maxMarks).length,
    },
    steps,
  };
}

/** Challenge band for the next question (PRD §6): easy below .4, medium .4–.7, harder above .7. */
export type Band = "easy" | "medium" | "harder";

export function bandOf(m: number | null): Band {
  const x = m ?? PRIOR;
  return x < 0.4 ? "easy" : x <= 0.7 ? "medium" : "harder";
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function count(n: number, one: string, many: string): string {
  return `${n <= 10 ? WORDS[n] : n} ${n === 1 ? one : many}`;
}

/**
 * The honest label, e.g. "57/100; limited evidence: two families". Marks and completion counts
 * are shown beside it, never folded into it.
 */
export function describeMastery(s: MasteryState): string {
  if (s.m === null) return "Not yet assessed";
  const score = `${Math.round(s.m * 100)}/100`;
  let evidence: string;
  if (s.confidence === "limited") {
    evidence =
      s.families < LIMITED_BELOW_FAMILIES
        ? `limited evidence: ${count(s.families, "family", "families")}`
        : `limited evidence: ${count(s.families, "family", "families")}, all on one day`;
  } else {
    evidence = `developing evidence: ${count(s.families, "family", "families")} over ${count(s.dates.length, "day", "days")}`;
  }
  const stale = s.stale && s.daysSincePractice !== null ? `; stale: last practised ${s.daysSincePractice} days ago` : "";
  return `${score}; ${evidence}${stale}`;
}
