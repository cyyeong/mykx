// Screen time and balance (docs/prd/PARENT_INSIGHTS.md §1). While a kid page is visible the browser sends a
// heartbeat every 30 s naming what the child is doing; everything here is counted from those beats.
//
// Pure and deterministic: every time is passed in and nothing reads the clock. Nothing here touches mastery or
// rewards (rule 5). Kix uses it to suggest breaks and balance; the parent sees it against their own limit.
import { sgDate, toMs, type Iso } from "../domain/time.ts";

/** What a kid screen is for. Talk to Kix and the Studio count as creating; Home, Treasure and Me count as screen
 *  time but not towards the balance ("other"). */
export type ActivityKind = "learn" | "play" | "create" | "other";
export const ACTIVITY_KINDS = ["learn", "play", "create", "other"] as const satisfies readonly ActivityKind[];

export const BEAT_MS = 30_000;
/** A gap longer than this between beats ends a run of screen time (a real break, or the app was closed). */
export const BREAK_GAP_MS = 3 * 60_000;

/** One heartbeat: 30 s of a visible kid page. */
export interface Beat {
  at: Iso;
  kind: ActivityKind;
}

/** Which activity a kid route counts as. */
export function activityForPath(pathname: string): ActivityKind {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (/^\/(arcade|play|games)(\/|$)/.test(p)) return "play";
  if (/^\/(vibe|studio|talk)(\/|$)/.test(p)) return "create";
  if (/^\/(learn|question|study)(\/|$)/.test(p) || /^\/me\/papers(\/|$)/.test(p)) return "learn";
  return "other";
}

/** The parent's settings for one child (Your family); the defaults suit a junior. */
export interface GuardianSettings {
  /** Minutes a day across all of myKx. */
  dailyLimitMin: number;
  /** Quiet hours in Singapore time, as whole hours: from 21:00 to 07:00 by default. */
  quietFromHour: number;
  quietToHour: number;
  /** Kix suggests a short break after this many minutes without one. */
  breakEveryMin: number;
  /** The balance the parent wants: at least this much learning before games take over… */
  learnMinMin: number;
  /** …and at most this much play in a day. */
  playMaxMin: number;
}

export const JUNIOR_SETTINGS: GuardianSettings = { dailyLimitMin: 60, quietFromHour: 21, quietToHour: 7, breakEveryMin: 20, learnMinMin: 25, playMaxMin: 20 };
export const TEEN_SETTINGS: GuardianSettings = { dailyLimitMin: 90, quietFromHour: 22, quietToHour: 7, breakEveryMin: 30, learnMinMin: 40, playMaxMin: 30 };

/** The Singapore hour (0–23) of an instant. */
export function sgHour(at: Iso | number): number {
  return Math.floor(((toMs(at) / 3_600_000 + 8) % 24 + 24) % 24);
}

/** Whether an instant falls in the parent's quiet hours (late night). */
export function inQuietHours(at: Iso | number, s: Pick<GuardianSettings, "quietFromHour" | "quietToHour">): boolean {
  const h = sgHour(at);
  return s.quietFromHour > s.quietToHour ? h >= s.quietFromHour || h < s.quietToHour : h >= s.quietFromHour && h < s.quietToHour;
}

export interface DayTime {
  /** Singapore date, "2026-10-28". */
  day: string;
  minutes: Record<ActivityKind, number>;
  total: number;
  /** Minutes inside quiet hours. */
  lateMinutes: number;
  overLimit: boolean;
}

const minutesOf = (beats: number) => Math.round(beats * (BEAT_MS / 60_000) * 10) / 10;

/** Minutes per Singapore day, by activity, for the days in `days` (oldest first); beats are de-duplicated per 30 s. */
export function screenTimeByDay(beats: readonly Beat[], days: readonly string[], s: GuardianSettings): DayTime[] {
  const seen = new Set<string>();
  const count = new Map<string, Record<ActivityKind | "late", number>>();
  for (const b of beats) {
    const ms = toMs(b.at);
    if (!Number.isFinite(ms)) continue;
    const slot = `${Math.floor(ms / BEAT_MS)}`;
    if (seen.has(slot)) continue;
    seen.add(slot);
    const day = sgDate(ms);
    const c = count.get(day) ?? { learn: 0, play: 0, create: 0, other: 0, late: 0 };
    c[b.kind] += 1;
    if (inQuietHours(ms, s)) c.late += 1;
    count.set(day, c);
  }
  return days.map((day) => {
    const c = count.get(day) ?? { learn: 0, play: 0, create: 0, other: 0, late: 0 };
    const minutes = { learn: minutesOf(c.learn), play: minutesOf(c.play), create: minutesOf(c.create), other: minutesOf(c.other) };
    const total = minutesOf(c.learn + c.play + c.create + c.other);
    return { day, minutes, total, lateMinutes: minutesOf(c.late), overLimit: total > s.dailyLimitMin };
  });
}

/** The last `n` Singapore dates ending on `now`'s, oldest first. */
export function lastDays(now: Iso | number, n: number): string[] {
  const end = Date.parse(sgDate(now));
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** Minutes of screen time since the last real break (a gap of 3 min or more), ending at `now`. */
export function minutesSinceBreak(beats: readonly Beat[], now: Iso | number): number {
  const nowMs = toMs(now);
  const times = [...new Set(beats.map((b) => Math.floor(toMs(b.at) / BEAT_MS) * BEAT_MS))].filter((t) => t <= nowMs).sort((a, b) => b - a);
  if (!times.length || nowMs - times[0] > BREAK_GAP_MS) return 0;
  let start = times[0];
  for (const t of times.slice(1)) {
    if (start - t > BREAK_GAP_MS) break;
    start = t;
  }
  return Math.round(((times[0] + BEAT_MS - start) / 60_000) * 10) / 10;
}
