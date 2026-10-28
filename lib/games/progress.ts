// A child's saved progress in one game (GAMES.md §3 "Stars, saving and sharing"), and how a finished round updates
// it. Pure and deterministic: the same rounds always give the same progress. Stars are the best ever per level,
// a level with at least one star unlocks the next, and per-key tallies add up (for "often swaps B and N", shown to
// the grown-up as information only). Personal bests only: nothing here compares children. Never touches mastery
// or the reward ledger (rule 5).
import { LEVELS_PER_STAGE } from "./typing/curriculum.ts";
import { accuracy, starsFor, wordsPerMinute, type Band } from "./typing/score.ts";
import type { TypingState } from "./typing/session.ts";

export type KeyTally = TypingState["keys"];

export interface GameProgress {
  game: string;
  /** The furthest stage and level unlocked. */
  stage: number;
  level: number;
  /** Best stars per level, keyed "stage-level". */
  stars: Record<string, number>;
  bestAccuracy: number;
  bestWpm: number;
  keys: KeyTally;
  updatedAt: string;
}

export interface RoundReport {
  stage: number;
  level: number;
  hits: number;
  misses: number;
  correctChars: number;
  /** Milliseconds between the first and the last key. */
  ms: number;
  finished: boolean;
  keys: KeyTally;
}

export function emptyProgress(game: string, startStage: number, now: string): GameProgress {
  return { game, stage: startStage, level: 1, stars: {}, bestAccuracy: 0, bestWpm: 0, keys: {}, updatedAt: now };
}

/** Stars for a round; `speedStage` is the curriculum stage whose speed target applies (defaults to the round's). */
export function scoreRound(r: RoundReport, band: Band, speedStage = r.stage) {
  const acc = accuracy(r);
  const wpm = wordsPerMinute({ correctChars: r.correctChars, startedAt: 0, lastAt: r.ms });
  return { accuracy: acc, wpm, stars: starsFor({ finished: r.finished, accuracy: acc, wpm, band, stage: speedStage }) };
}

function mergeKeys(a: KeyTally, b: KeyTally): KeyTally {
  const out: KeyTally = { ...a };
  for (const [k, t] of Object.entries(b)) {
    const p = out[k] ?? { hits: 0, misses: 0, instead: {} };
    const instead = { ...p.instead };
    for (const [w, n] of Object.entries(t.instead)) instead[w] = (instead[w] ?? 0) + n;
    out[k] = { hits: p.hits + t.hits, misses: p.misses + t.misses, instead };
  }
  return out;
}

/** The progress after one round; `maxStage` is the last stage this child can play right now. */
export function applyRound(prev: GameProgress, r: RoundReport, band: Band, maxStage: number, now: string, speedStage = r.stage) {
  const { accuracy: acc, wpm, stars } = scoreRound(r, band, speedStage);
  const key = `${r.stage}-${r.level}`;
  const next: GameProgress = {
    ...prev,
    stars: { ...prev.stars, [key]: Math.max(prev.stars[key] ?? 0, stars) },
    bestAccuracy: r.finished ? Math.max(prev.bestAccuracy, acc) : prev.bestAccuracy,
    bestWpm: r.finished ? Math.max(prev.bestWpm, wpm) : prev.bestWpm,
    keys: mergeKeys(prev.keys, r.keys),
    updatedAt: now,
  };
  // Clearing the furthest level unlocks the next one (and the next stage after its last level).
  if (stars >= 1 && r.stage === prev.stage && r.level === prev.level) {
    if (r.level < LEVELS_PER_STAGE) next.level = r.level + 1;
    else if (r.stage < maxStage) {
      next.stage = r.stage + 1;
      next.level = 1;
    }
  }
  return { progress: next, stars, accuracy: acc, wpm, unlocked: next.stage !== prev.stage || next.level !== prev.level };
}

/** Whether a level is open to play: any level up to the furthest one unlocked. */
export function isOpen(p: Pick<GameProgress, "stage" | "level">, stage: number, level: number): boolean {
  return stage < p.stage || (stage === p.stage && level <= p.level);
}

/** Stars earned and possible across the stages played so far (for the cabinet: "★ 11 of 27"). */
export function starTotals(p: GameProgress): { earned: number; possible: number } {
  const earned = Object.values(p.stars).reduce((s, n) => s + n, 0);
  return { earned, possible: p.stage * LEVELS_PER_STAGE * 3 };
}
