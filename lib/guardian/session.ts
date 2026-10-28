// One learning session as the guardian sees it (docs/prd/PARENT_INSIGHTS.md §1): focus from interaction only
// (quick guesses, long idle gaps, leaving the app, a hint on every question, quitting mid-quest), scored 0–100
// against the child's own usual. Pure and deterministic; never changes mastery or rewards (rule 5).
import { clamp, toMs, type Iso } from "../domain/time.ts";
import type { MoodReading } from "./words.ts";

export interface SessionAnswer {
  /** Time from the question showing to the answer being checked. */
  ms: number;
  hinted: boolean;
}

export interface GuardianSession {
  id: string;
  start: Iso;
  end: Iso;
  answers: SessionAnswer[];
  /** Gaps of a minute or more with no tap or key while the page was visible. */
  idleGaps: number;
  /** Time the app was hidden (another tab or app) during the session. */
  hiddenMs: number;
  quitMidQuest: boolean;
  /** The reading of the child's own words to Kix in this session, if they said any. */
  mood: MoodReading | null;
  /** The on-device camera raised "possibly losing focus" or "possibly sleepy" in this session. */
  cameraTired: boolean;
  /** Sample data, labelled in the UI (rule 8). */
  synthetic?: boolean;
}

/** Answers checked faster than this count as possible guesses. */
export const GUESS_MS = 3_000;

/** Focus 0–100 from interaction alone. Starts at 100 and loses points for each sign, never below 0. */
export function sessionFocus(s: GuardianSession): number {
  const guesses = s.answers.filter((a) => a.ms < GUESS_MS).length;
  const allHinted = s.answers.length >= 2 && s.answers.every((a) => a.hinted);
  const hiddenMin = s.hiddenMs / 60_000;
  const lost = Math.min(30, guesses * 10) + Math.min(24, s.idleGaps * 8) + Math.min(25, hiddenMin * 5) + (allHinted ? 10 : 0) + (s.quitMidQuest ? 10 : 0);
  return Math.round(clamp(100 - lost, 0, 100));
}

/** What the score is made of, in plain words for the parent ("what we saw"). */
export function focusReasons(s: GuardianSession): string[] {
  const out: string[] = [];
  const guesses = s.answers.filter((a) => a.ms < GUESS_MS).length;
  if (guesses) out.push(`${guesses} ${guesses === 1 ? "answer" : "answers"} in under 3 seconds`);
  if (s.idleGaps) out.push(`${s.idleGaps} ${s.idleGaps === 1 ? "pause" : "pauses"} of a minute or more`);
  if (s.hiddenMs >= 60_000) out.push(`left the app for about ${Math.round(s.hiddenMs / 60_000)} min`);
  if (s.answers.length >= 2 && s.answers.every((a) => a.hinted)) out.push("asked for a hint on every question");
  if (s.quitMidQuest) out.push("stopped partway through the quest");
  return out;
}

/** The child's usual focus: the median of their last two weeks of sessions, or 80 until there are three. */
export function focusBaseline(sessions: readonly GuardianSession[], now: Iso | number): number {
  const since = toMs(now) - 14 * 86_400_000;
  const scores = sessions.filter((s) => toMs(s.start) >= since && toMs(s.start) <= toMs(now)).map(sessionFocus).sort((a, b) => a - b);
  if (scores.length < 3) return 80;
  const mid = Math.floor(scores.length / 2);
  return scores.length % 2 ? scores[mid] : Math.round((scores[mid - 1] + scores[mid]) / 2);
}
