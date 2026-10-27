// The reward ledger (PRD FR10): transparent, deterministic, never random.
//
//   2 points  first submitted attempt with the child's own explanation
//   3 points  retry with a revised explanation
//   5 points  fresh-family independent success following an error in that subskill
//   5 points  saved creation
//   repeatable awards capped at 15 points per Singapore day; unique rule/event keys;
//   nothing for a refresh or a replay. No money, loot boxes or rankings.
//
// Decisions where FR10 is silent (see docs/plan/soak-report.md):
// - "With explanation" means the child wrote or picked their own reason. An attempt without one
//   earns nothing, so the question player must ask for one.
// - Keys are per item, not per attempt: a double submit or a replayed event can never pay twice;
//   a retry pays once per item, and never after the answer was revealed (copying is not effort).
// - The cap tops up to exactly 15, then records 0-point entries ("daily cap reached") so the
//   key is spent: a capped event never pays out later.
// - The day is the Singapore date of the event, not of processing.
import { type AttemptEvent, isError, isIndependentSuccess, subskillKey } from "./attempts.ts";
import { type Iso, sgDate, toMs } from "./time.ts";

export const POINTS = { first_attempt: 2, retry_revised: 3, fresh_transfer: 5, creation_saved: 5 } as const;
export const DAILY_CAP = 15;
export const CAP_NOTE = "daily cap reached";

export type PointsRule = keyof typeof POINTS;
export type RewardRule = PointsRule | "companion_stage" | "squadron_unlock";
/** Matches the `ledger.kind` check constraint in supabase/schema.sql. */
export type LedgerKind = "stars" | "card" | "companion_stage" | "squadron_unlock";

export interface LedgerEntry {
  /** Unique: the `ledger.idempotency_key`. */
  key: string;
  kind: LedgerKind;
  rule: RewardRule;
  amount: number;
  /** Item, family, creation, stage or jet the entry is about. */
  ref?: string;
  at: Iso;
  /** Singapore date the entry counts against. */
  day: string;
  /** What the rule would have paid before the cap. */
  requested?: number;
  note?: string;
}

export type RewardEvent =
  | { type: "attempt"; attempt: AttemptEvent }
  | { type: "creation_saved"; creationId: string; at: Iso };

export function isRepeatable(rule: RewardRule): rule is PointsRule {
  return rule in POINTS;
}

/** Points from repeatable rules already granted on a Singapore day. */
export function pointsOnDay(ledger: readonly LedgerEntry[], day: string): number {
  return ledger.reduce((s, e) => (e.day === day && isRepeatable(e.rule) ? s + e.amount : s), 0);
}

export function totalPoints(ledger: readonly LedgerEntry[]): number {
  return ledger.reduce((s, e) => (e.kind === "stars" ? s + e.amount : s), 0);
}

/**
 * The entries one event earns, given the ledger so far and the learner's earlier attempts.
 * Returns [] for an event whose keys are already in the ledger (a refresh or a replay).
 */
export function awardsFor(
  event: RewardEvent,
  ctx: { ledger: readonly LedgerEntry[]; attempts: readonly AttemptEvent[] },
): LedgerEntry[] {
  const keys = new Set(ctx.ledger.map((e) => e.key));
  const wanted: { key: string; rule: PointsRule; ref: string }[] = [];
  let at: Iso;

  if (event.type === "creation_saved") {
    at = event.at;
    wanted.push({ key: `creation_saved:${event.creationId}`, rule: "creation_saved", ref: event.creationId });
  } else {
    const a = event.attempt;
    at = a.at;
    const t = toMs(a.at);
    const before = ctx.attempts.filter((p) => p.id !== a.id && toMs(p.at) <= t && !(toMs(p.at) === t && p.id > a.id));

    if (a.firstTry && a.explanation) {
      wanted.push({ key: `first_attempt:${a.itemId}`, rule: "first_attempt", ref: a.itemId });
    }
    if (!a.firstTry && a.explanation && a.explanationRevised && !a.revealed) {
      const revealedBefore = before.some((p) => p.itemId === a.itemId && p.revealed);
      if (!revealedBefore) wanted.push({ key: `retry_revised:${a.itemId}`, rule: "retry_revised", ref: a.itemId });
    }
    if (a.firstTry && isIndependentSuccess(a)) {
      const key = subskillKey(a);
      const freshFamily = !before.some((p) => p.family === a.family);
      if (freshFamily) {
        // An error in this subskill since the last transfer award here (or ever, if none).
        const lastAward = ctx.ledger
          .filter((e) => e.rule === "fresh_transfer" && e.ref?.startsWith(`${key}#`))
          .reduce((m, e) => Math.max(m, toMs(e.at)), -Infinity);
        const errorSince = before.some((p) => subskillKey(p) === key && isError(p) && toMs(p.at) > lastAward);
        if (errorSince) wanted.push({ key: `fresh_transfer:${a.family}`, rule: "fresh_transfer", ref: `${key}#${a.family}` });
      }
    }
  }

  const day = sgDate(at);
  let remaining = Math.max(0, DAILY_CAP - pointsOnDay(ctx.ledger, day));
  const out: LedgerEntry[] = [];
  for (const w of wanted) {
    if (keys.has(w.key)) continue; // refresh or replay: never pays twice
    keys.add(w.key);
    const requested = POINTS[w.rule];
    const amount = Math.min(requested, remaining);
    remaining -= amount;
    out.push({
      key: w.key,
      kind: "stars",
      rule: w.rule,
      amount,
      ref: w.ref,
      at,
      day,
      ...(amount < requested ? { requested, note: CAP_NOTE } : {}),
    });
  }
  return out;
}

/** Folds a whole event stream into a ledger, oldest first. Replaying the stream adds nothing. */
export function buildLedger(events: readonly RewardEvent[], start: readonly LedgerEntry[] = []): LedgerEntry[] {
  const atOf = (e: RewardEvent) => toMs(e.type === "attempt" ? e.attempt.at : e.at);
  const sorted = [...events].sort((a, b) => atOf(a) - atOf(b));
  const ledger = [...start];
  const attempts: AttemptEvent[] = [];
  for (const e of sorted) {
    ledger.push(...awardsFor(e, { ledger, attempts }));
    if (e.type === "attempt") attempts.push(e.attempt);
  }
  return ledger;
}
