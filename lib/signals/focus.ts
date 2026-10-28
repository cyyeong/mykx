// Focus from the on-device camera's per-minute counts (docs/prd/PARENT_INSIGHTS.md §1, AGENTS.md rule 12).
// The browser turns each camera frame into a head angle and three blendshape scores and keeps only the counts
// below (lib/signals/camera.ts); this file scores those minutes against the child's own baseline and raises a
// "possibly losing focus" note for the grown-up. A possibility with evidence, never a diagnosis or a label.
//
// Pure and deterministic: every time is passed in and nothing reads the clock. Nothing here imports, reads or
// changes mastery or rewards (rule 5): the note goes to the parent, and Kix only suggests a break.

export const MINUTE_MS = 60_000;

/** One minute of camera counts: the only thing that ever leaves the device. */
export interface FocusMinute {
  /** Start of the minute (ISO 8601, on a whole minute). */
  minute: string;
  /** Seconds spent looking away from the screen, in spells of 2 s or more (0–60). */
  awaySeconds: number;
  /** Times the eyes stayed shut for 1 s or more. Normal blinks are too short to count. */
  eyesClosedEvents: number;
  /** Mouth wide open for 1.5 s or more. */
  yawns: number;
  /** Share of the watched time a face was in view (0–1). Poor light reads as out of view. */
  facePresentRatio: number;
}

export type Confidence = "low" | "medium" | "high";

/** A "possibly losing focus" note. Shown to the grown-up only; the child just sees Kix suggest a break. */
export interface FocusSignal {
  level: "watch";
  /** Plain words: the counts in these minutes against the child's usual. */
  evidence: string;
  confidence: Confidence;
  /** Start of the first minute and end of the last (ISO). */
  from: string;
  to: string;
}

/** The child's usual minute: medians of their own recent minutes, or a starting guess until there are enough. */
export interface FocusBaseline {
  score: number;
  awaySeconds: number;
  eyesClosedEvents: number;
  yawns: number;
  /** How many of the child's minutes it was built from. */
  minutes: number;
  /** True while there are too few minutes to know the child's usual, so DEFAULT_BASELINE stands in. */
  fromDefault: boolean;
}

/** A calm, attentive minute with a few glances away: the starting guess for a new child. */
export const DEFAULT_BASELINE: FocusBaseline = { score: 85, awaySeconds: 4, eyesClosedEvents: 0, yawns: 0, minutes: 0, fromDefault: true };
/** Minutes needed before the child's own median replaces the starting guess. */
export const MIN_BASELINE_MINUTES = 10;
/** The baseline reads at most this many of the most recent minutes (about four sessions). */
export const BASELINE_WINDOW = 240;
/** Minutes the camera barely saw a face say nothing about usual focus (the child stepped away). */
const BASELINE_MIN_PRESENT = 0.5;

/** "Well below": at least this many points under the usual score. */
export const DIP_POINTS = 20;
/** For this many consecutive minutes. */
export const DIP_MINUTES = 3;
/** Kix suggests a break at most once every 10 minutes, and once per note. */
export const NUDGE_GAP_MS = 10 * MINUTE_MS;

/** Out of view for part of a minute is normal (a stretch, a drink of water). Only the share above this counts. */
const ABSENT_GRACE = 0.25;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const ms = (iso: string) => Date.parse(iso);

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * A minute's focus, 0–100. Starts at 100; looking away costs up to 48, eyes shut up to 40, yawns up to 24, and
 * being out of view for most of the minute up to 50 (so a whole minute away from the screen and a whole minute
 * looking away cost about the same). Looking away and out of view never overlap: without a face there's no angle.
 */
export function minuteScore(m: FocusMinute): number {
  const away = clamp(m.awaySeconds, 0, 60) * 0.8;
  const eyes = clamp(m.eyesClosedEvents, 0, 4) * 10;
  const yawns = clamp(m.yawns, 0, 3) * 8;
  const absentShare = 1 - clamp(m.facePresentRatio, 0, 1);
  const absent = (Math.max(0, absentShare - ABSENT_GRACE) / (1 - ABSENT_GRACE)) * 50;
  return Math.round(clamp(100 - away - eyes - yawns - absent, 0, 100));
}

/** Sorted by time, one entry per minute (a later copy of the same minute wins). */
function byMinute(minutes: readonly FocusMinute[]): FocusMinute[] {
  const seen = new Map<number, FocusMinute>();
  for (const m of minutes) {
    const t = ms(m.minute);
    if (Number.isFinite(t)) seen.set(t, m);
  }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, m]) => m);
}

/**
 * The child's usual minute: the median of each count over their most recent minutes in view, before `before`
 * (exclusive) when given, so the minutes being judged never set their own bar.
 */
export function focusBaseline(history: readonly FocusMinute[], before?: string): FocusBaseline {
  const cutoff = before === undefined ? Infinity : ms(before);
  const usable = byMinute(history)
    .filter((m) => ms(m.minute) < cutoff && m.facePresentRatio >= BASELINE_MIN_PRESENT)
    .slice(-BASELINE_WINDOW);
  if (usable.length < MIN_BASELINE_MINUTES) return { ...DEFAULT_BASELINE, minutes: usable.length };
  return {
    score: Math.round(median(usable.map(minuteScore))),
    awaySeconds: median(usable.map((m) => m.awaySeconds)),
    eyesClosedEvents: median(usable.map((m) => m.eyesClosedEvents)),
    yawns: median(usable.map((m) => m.yawns)),
    minutes: usable.length,
    fromDefault: false,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function duration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const rest = s % 60;
  return rest ? `${Math.floor(s / 60)} min ${rest} s` : `${s / 60} min`;
}

function usual(n: number, unit: (k: number) => string): string {
  return n === 0 ? "usually none" : `usually about ${unit(n)}`;
}

function confidenceOf(run: readonly FocusMinute[], scores: readonly number[], baseline: FocusBaseline): Confidence {
  const seen = run.reduce((sum, m) => sum + m.facePresentRatio, 0) / run.length;
  // A starting guess, or a camera that could hardly see a face (dim room, child away): say so.
  if (baseline.fromDefault || seen < 0.5) return "low";
  const drop = baseline.score - scores.reduce((a, b) => a + b, 0) / scores.length;
  return baseline.minutes >= 30 && drop >= 35 ? "high" : "medium";
}

/** "In 3 minutes: looked away 1 min 35 s (usually about 12 s), eyes closed 4 times (usually none), …". */
export function focusEvidence(run: readonly FocusMinute[], baseline: FocusBaseline): string {
  const n = run.length;
  const sum = (pick: (m: FocusMinute) => number) => run.reduce((t, m) => t + pick(m), 0);
  const away = sum((m) => m.awaySeconds);
  const eyes = sum((m) => m.eyesClosedEvents);
  const yawns = sum((m) => m.yawns);
  const outOfView = sum((m) => (1 - clamp(m.facePresentRatio, 0, 1)) * 60);
  const scores = run.map(minuteScore);
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / n);

  const parts = [`looked away ${duration(away)}`, `eyes closed ${plural(eyes, "time", "times")}`, plural(yawns, "yawn", "yawns")];
  if (!baseline.fromDefault) {
    parts[0] += ` (${usual(Math.round(baseline.awaySeconds * n), (k) => duration(k))})`;
    parts[1] += ` (${usual(Math.round(baseline.eyesClosedEvents * n), (k) => plural(k, "time", "times"))})`;
    parts[2] += ` (${usual(Math.round(baseline.yawns * n), (k) => String(k))})`;
  }
  let text = `In ${n} minutes: ${parts.join(", ")}.`;
  if (outOfView >= 30) text += ` Out of the camera's view for about ${duration(Math.round(outOfView / 10) * 10)}.`;
  text += baseline.fromDefault
    ? ` Focus about ${score}, against a starting guess of ${baseline.score}: too few minutes yet to know their usual.`
    : ` Focus about ${score}, against a usual ${baseline.score}.`;
  return text;
}

/**
 * A "possibly losing focus" note when the latest DIP_MINUTES consecutive minutes (each one minute after the last,
 * so a gap such as a hidden tab breaks the run) all score at least DIP_POINTS under the baseline. Only minutes
 * starting at or after `after` count: pass the previous note's `to` so each run raises one note.
 */
export function detectFocusDip(minutes: readonly FocusMinute[], baseline: FocusBaseline, opts: { after?: string } = {}): FocusSignal | null {
  const after = opts.after === undefined ? -Infinity : ms(opts.after);
  const run = byMinute(minutes)
    .filter((m) => ms(m.minute) >= after)
    .slice(-DIP_MINUTES);
  if (run.length < DIP_MINUTES) return null;
  for (let i = 1; i < run.length; i++) if (ms(run[i].minute) - ms(run[i - 1].minute) !== MINUTE_MS) return null;
  const scores = run.map(minuteScore);
  if (scores.some((s) => s > baseline.score - DIP_POINTS)) return null;
  return {
    level: "watch",
    evidence: focusEvidence(run, baseline),
    confidence: confidenceOf(run, scores, baseline),
    from: new Date(ms(run[0].minute)).toISOString(),
    to: new Date(ms(run[run.length - 1].minute) + MINUTE_MS).toISOString(),
  };
}

/** Whether Kix may suggest a break now: never more than once every NUDGE_GAP_MS. */
export function canNudge(lastNudgeAtMs: number | null, nowMs: number): boolean {
  return lastNudgeAtMs === null || nowMs - lastNudgeAtMs >= NUDGE_GAP_MS;
}

/** Each note a grown-up marked "not right" in the last two weeks makes the child's threshold 5 points more forgiving,
 *  up to 15: their check tunes the camera to this child, by a fixed rule (never a model). */
export const CORRECTION_POINTS = 5;
export const MAX_CORRECTION = 15;
export function withCorrections(baseline: FocusBaseline, notRight: number): FocusBaseline {
  const ease = Math.min(MAX_CORRECTION, Math.max(0, notRight) * CORRECTION_POINTS);
  return ease ? { ...baseline, score: baseline.score - ease } : baseline;
}
