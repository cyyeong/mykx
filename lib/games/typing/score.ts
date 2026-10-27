// Scoring a typing round. Stars are deterministic (GAMES.md §3): ★ finish, ★★ 90 % right, ★★★ 96 % right,
// and teens also need their stage's speed. Same play, same stars. Never touches mastery or the reward ledger.
import type { TypingState } from "./session.ts";

export type Band = "junior" | "teen";

export function accuracy(s: Pick<TypingState, "hits" | "misses">): number {
  const total = s.hits + s.misses;
  return total === 0 ? 1 : s.hits / total;
}

/** Words a minute: correct characters / 5 per minute between the first and last key. 0 until 3 s have passed. */
export function wordsPerMinute(s: Pick<TypingState, "correctChars" | "startedAt" | "lastAt">): number {
  if (s.startedAt === null || s.lastAt === null) return 0;
  const minutes = (s.lastAt - s.startedAt) / 60_000;
  return minutes < 0.05 ? 0 : Math.round(s.correctChars / 5 / minutes);
}

/** A teen's speed target for a stage (stages 1–4: 15 wpm; 5 and up: 25 wpm). Juniors have none. */
export function speedTarget(band: Band, stage: number): number | null {
  if (band === "junior") return null;
  return stage <= 4 ? 15 : 25;
}

export function starsFor(opts: { finished: boolean; accuracy: number; wpm: number; band: Band; stage: number }): 0 | 1 | 2 | 3 {
  if (!opts.finished) return 0;
  if (opts.accuracy < 0.9) return 1;
  const target = speedTarget(opts.band, opts.stage);
  if (opts.accuracy >= 0.96 && (target === null || opts.wpm >= target)) return 3;
  return 2;
}

/** Keys a child often gets wrong, with what they press instead (information for the parent, never a label). */
export function slips(s: Pick<TypingState, "keys">, minTries = 4): { key: string; missRate: number; instead: string | null }[] {
  return Object.entries(s.keys)
    .map(([key, k]) => {
      const tries = k.hits + k.misses;
      const top = Object.entries(k.instead).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return { key, tries, missRate: tries ? k.misses / tries : 0, instead: top ? top[0] : null };
    })
    .filter((k) => k.tries >= minTries && k.missRate >= 0.2)
    .sort((a, b) => b.missRate - a.missRate || a.key.localeCompare(b.key))
    .map(({ key, missRate, instead }) => ({ key, missRate, instead }));
}
