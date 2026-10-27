// Sky Squadron (PRD_REVIEW E8): four original insect-inspired display jets, unlocked
// deterministically. One jet per four fresh-question successes, in a fixed order; the hero banner
// after the full set. No random packs. Unlocks are written to the ledger and never taken back.
import type { AttemptEvent } from "./attempts.ts";
import { familyContributions } from "./mastery.ts";
import type { LedgerEntry } from "./rewards.ts";
import { type Iso, sgDate } from "./time.ts";

export const JETS = ["dragonfly", "bumblebee", "firefly", "rhino_beetle"] as const;
export type Jet = (typeof JETS)[number];
export const SUCCESSES_PER_JET = 4;
export const BANNER = "squadron_banner";

/**
 * Independent fresh-question successes across every subject: a family's earliest eligible attempt
 * (confirmed, first try, not revealed) with full marks and no hints. Retries and variants never count.
 */
export function freshSuccesses(attempts: readonly AttemptEvent[]): number {
  return familyContributions(attempts).filter((c) => c.hints === 0 && c.marks >= c.maxMarks).length;
}

export interface SquadronView {
  unlocked: Jet[];
  banner: boolean;
  /** Progress to the next jet, or null when the set is complete. */
  next: { jet: Jet; have: number; need: number } | null;
  /** New `squadron_unlock` ledger entries to write. */
  grants: LedgerEntry[];
}

export function squadron(input: { successes: number; ledger: readonly LedgerEntry[]; now: Iso }): SquadronView {
  const { ledger, now } = input;
  const successes = Number.isFinite(input.successes) ? Math.max(0, Math.floor(input.successes)) : 0;
  const grantedKeys = new Set(ledger.filter((e) => e.rule === "squadron_unlock").map((e) => e.key));
  const earned = Math.min(JETS.length, Math.floor(successes / SUCCESSES_PER_JET));
  const unlocked = JETS.filter((jet, i) => i < earned || grantedKeys.has(`squadron:${jet}`));
  const banner = unlocked.length === JETS.length;

  const grants: LedgerEntry[] = [];
  const grant = (ref: string) => {
    const key = `squadron:${ref}`;
    if (!grantedKeys.has(key)) grants.push({ key, kind: "squadron_unlock", rule: "squadron_unlock", amount: 0, ref, at: now, day: sgDate(now) });
  };
  for (const jet of unlocked) grant(jet);
  if (banner) grant(BANNER);

  const nextIndex = JETS.findIndex((jet) => !unlocked.includes(jet));
  const next =
    nextIndex < 0
      ? null
      : { jet: JETS[nextIndex], have: Math.max(0, successes - nextIndex * SUCCESSES_PER_JET), need: SUCCESSES_PER_JET };
  return { unlocked, banner, next: next && { ...next, have: Math.min(next.have, next.need) }, grants };
}
