// The guardian's whole picture of one kid, built on the server from stored rows (beats, attempts, words to Kix,
// camera notes and the parent's settings). Sessions, screen time, flags and Kix's next step all come from the pure
// rules beside this file, so the same rows always give the same picture. Never changes mastery or rewards.
import type { AttemptEvent } from "../domain/attempts.ts";
import { sgDate, toMs, type Iso } from "../domain/time.ts";
import type { FocusNote } from "../signals/schemas.ts";
import type { StoredBeat, StoredGuardianSettings, StoredKixMessage, StoredSessionRead } from "../auth/store.ts";
import { guardianFlags, type GuardianFlag } from "./flags.ts";
import { nextStep, type NextStep, type NextStepInput } from "./next-step.ts";
import { BEAT_MS, BREAK_GAP_MS, JUNIOR_SETTINGS, TEEN_SETTINGS, lastDays, minutesSinceBreak, screenTimeByDay, type DayTime, type GuardianSettings } from "./screen-time.ts";
import { focusBaseline, focusReasons, sessionFocus, type GuardianSession } from "./session.ts";
import { MOODS, moodFromWords, type Mood, type MoodReading } from "./words.ts";

/** Sessions shorter than this aren't worth a row (a peek at the map). */
const MIN_SESSION_MS = 2 * 60_000;

/** The parent's settings over the band's defaults; the daily limit comes from the profile when set. */
export function settingsFor(band: string | null, dailyLimitMin: number | null, saved: StoredGuardianSettings | null): GuardianSettings {
  const base = band === "teen" ? TEEN_SETTINGS : JUNIOR_SETTINGS;
  return { ...base, ...(saved ?? {}), ...(dailyLimitMin ? { dailyLimitMin } : {}) };
}

/** Learning sessions from the heartbeats: runs of learning beats with no break of 3 min or more. */
export function deriveSessions(beats: readonly StoredBeat[], attempts: readonly AttemptEvent[], messages: readonly StoredKixMessage[], notes: readonly FocusNote[], reads: readonly StoredSessionRead[] = []): GuardianSession[] {
  const learn = beats.filter((b) => b.kind === "learn").sort((a, b) => toMs(a.at) - toMs(b.at));
  const runs: StoredBeat[][] = [];
  for (const b of learn) {
    const run = runs[runs.length - 1];
    if (run && toMs(b.at) - toMs(run[run.length - 1].at) <= BREAK_GAP_MS) run.push(b);
    else runs.push([b]);
  }
  return runs
    .filter((run) => toMs(run[run.length - 1].at) + BEAT_MS - toMs(run[0].at) >= MIN_SESSION_MS)
    .map((run) => {
      const startMs = toMs(run[0].at);
      const endMs = toMs(run[run.length - 1].at) + BEAT_MS;
      let hiddenMs = 0;
      let idleGaps = 0;
      run.forEach((b, i) => {
        if (b.idle && !run[i - 1]?.idle) idleGaps += 1;
        const gap = i ? toMs(b.at) - toMs(run[i - 1].at) : 0;
        if (gap > BEAT_MS * 1.5) hiddenMs += gap - BEAT_MS;
      });
      const inWindow = (at: Iso, pad = 0) => toMs(at) >= startMs - pad && toMs(at) <= endMs + pad;
      const said = messages.filter((m) => inWindow(m.at, 2 * 60_000)).map((m) => m.text);
      return {
        id: `s:${run[0].at}`,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        answers: attempts.filter((a) => inWindow(a.at, 60_000)).map((a) => ({ ms: a.durationMs ?? 10_000, hinted: a.hintsBeforeSubmit > 0 })),
        idleGaps,
        hiddenMs,
        quitMidQuest: false,
        mood: sparkMood(reads, startMs, endMs) ?? moodFromWords(said),
        cameraTired: notes.some((n) => toMs(n.to) >= startMs && toMs(n.from) <= endMs),
        ...(run.every((b) => b.synthetic) ? { synthetic: true } : {}),
      };
    });
}

/** The Memory Keeper's reading for a session, when one overlaps it (it read the same words, with more care). */
function sparkMood(reads: readonly StoredSessionRead[], startMs: number, endMs: number): MoodReading | null {
  const r = reads.find((x) => toMs(x.sessionStart) <= endMs + 5 * 60_000 && toMs(x.sessionEnd) >= startMs);
  return r && (MOODS as readonly string[]).includes(r.mood) ? { mood: r.mood as Mood, confidence: r.confidence, evidence: r.evidence.slice(0, 3), source: "spark" } : null;
}

export interface SessionRow extends GuardianSession {
  focus: number;
  reasons: string[];
}

export interface GuardianView {
  settings: GuardianSettings;
  /** The last 7 days, oldest first; the last one is today. */
  days: DayTime[];
  sinceBreakMin: number;
  usualFocus: number;
  /** The last 7 days of learning sessions, newest first. */
  sessions: SessionRow[];
  flags: (GuardianFlag & { seen: boolean })[];
  next: NextStep;
  /** Some of what's shown is sample data (rule 8). */
  synthetic: boolean;
}

export interface ViewInput {
  nickname: string;
  band: string | null;
  dailyLimitMin: number | null;
  now: Iso;
  saved: StoredGuardianSettings | null;
  beats: readonly StoredBeat[];
  attempts: readonly AttemptEvent[];
  messages: readonly StoredKixMessage[];
  notes: readonly FocusNote[];
  /** The Memory Keeper's after-session readings (optional; the word lists stand in without them). */
  reads?: readonly StoredSessionRead[];
  seen: readonly string[];
  /** What the app can offer next (the open quest, reviews due, whether the Arcade and Vibe Zone exist). */
  offer: Pick<NextStepInput, "quest" | "reviewsDue" | "arcade" | "vibe">;
}

export function guardianView(x: ViewInput): GuardianView {
  const settings = settingsFor(x.band, x.dailyLimitMin, x.saved);
  const nowMs = toMs(x.now);
  const days = screenTimeByDay(x.beats, lastDays(x.now, 7), settings);
  const all = deriveSessions(x.beats, x.attempts, x.messages, x.notes, x.reads);
  const week = all.filter((s) => nowMs - toMs(s.start) <= 7 * 86_400_000 && toMs(s.start) <= nowMs);
  const flags = guardianFlags({ nickname: x.nickname, now: x.now, settings, messages: x.messages, sessions: week, days });
  const seen = new Set(x.seen);
  const today = sgDate(x.now);
  const todaysWords = x.messages.filter((m) => sgDate(m.at) === today).map((m) => m.text);
  const recentNote = x.notes.find((n) => nowMs - toMs(n.to) <= 15 * 60_000 && toMs(n.to) <= nowMs);
  const mood: Mood | null = moodFromWords(todaysWords)?.mood ?? null;
  const next = nextStep({
    nickname: x.nickname,
    now: x.now,
    settings,
    today: days[days.length - 1],
    sinceBreakMin: minutesSinceBreak(x.beats, x.now),
    focusDip: Boolean(recentNote),
    sleepy: Boolean(recentNote && /yawn|eyes closed/.test(recentNote.evidence)) || mood === "tired",
    mood: mood === "calm" ? null : mood,
    ...x.offer,
  });
  return {
    settings,
    days,
    sinceBreakMin: minutesSinceBreak(x.beats, x.now),
    usualFocus: focusBaseline(all, x.now),
    sessions: week
      .slice()
      .reverse()
      .map((s) => ({ ...s, focus: sessionFocus(s), reasons: focusReasons(s) })),
    flags: flags.map((f) => ({ ...f, seen: seen.has(f.id) })),
    next,
    synthetic: x.beats.some((b) => b.synthetic) || x.messages.some((m) => m.synthetic),
  };
}
