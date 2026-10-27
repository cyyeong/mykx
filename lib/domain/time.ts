// Time helpers for the deterministic learner record. Every function takes its clock as an
// argument (no Date.now()), so the same inputs always give the same answer.
//
// Singapore has no daylight saving, so its local date is simply UTC+8.

export const DAY_MS = 86_400_000;
const SGT_OFFSET_MS = 8 * 3_600_000;

/** An ISO 8601 timestamp, as stored in `attempts.created_at` and `ledger.created_at`. */
export type Iso = string;

/** Milliseconds since the epoch, or NaN for an unparseable timestamp. */
export function toMs(at: Iso | number): number {
  return typeof at === "number" ? at : Date.parse(at);
}

/** The Asia/Singapore calendar date ("2026-11-04") of an instant. */
export function sgDate(at: Iso | number): string {
  return new Date(toMs(at) + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Days from `from` to `to` as a real number (negative when `to` is earlier). */
export function daysBetween(from: Iso | number, to: Iso | number): number {
  return (toMs(to) - toMs(from)) / DAY_MS;
}

/** Whole Singapore calendar days from `from` to `to` (a test tomorrow is 1 day away, whatever the hour). */
export function sgDaysBetween(from: Iso | number, to: Iso | number): number {
  return Math.round((Date.parse(sgDate(to)) - Date.parse(sgDate(from))) / DAY_MS);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
