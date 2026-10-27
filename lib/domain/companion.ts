// The critter companion (PRD_REVIEW E7): it grows through its real life-cycle stages as learning
// evidence lands, keyed to milestones, never to chance or time spent. It never shrinks, gets sick
// or dies when a child takes a break: once a stage is in the ledger it stays.
//
//   stage 1 (tadpole / larva)  the first submitted attempt
//   stage 2 (froglet / pupa)   the first fresh-question success: a fresh family, full marks,
//                              no hints, no reveal
//   stage 3 (frog / beetle)    a mastery band: some subskill above .7 with developing evidence
//                              (five families over two days), so the last stage is honest
import type { AttemptEvent } from "./attempts.ts";
import { familyContributions, type MasteryState } from "./mastery.ts";
import type { LedgerEntry } from "./rewards.ts";
import { type Iso, sgDate } from "./time.ts";

export type Species = "frog" | "mealworm";

export const STAGES: Record<Species, readonly [string, string, string, string]> = {
  frog: ["frogspawn", "tadpole", "froglet", "frog"],
  mealworm: ["eggs", "larva", "pupa", "beetle"],
};

export const MASTERY_BAND = 0.7;

export interface Milestones {
  firstAttempt: boolean;
  freshSuccess: boolean;
  masteryBand: boolean;
}

const NEEDS = [
  "answer your first question",
  "get a new question right on your own",
  "show steady mastery of one skill (above 70 with five questions over two days)",
] as const;

/** Milestones from the learner record: attempts (all subjects) and current mastery states. */
export function milestonesFrom(attempts: readonly AttemptEvent[], mastery: readonly MasteryState[]): Milestones {
  const firstAttempt = attempts.some((a) => a.firstTry);
  // A fresh-question success is a family's earliest eligible attempt, done independently.
  const freshSuccess = familyContributions(attempts).some((c) => c.hints === 0 && c.marks >= c.maxMarks);
  const masteryBand = mastery.some((s) => s.m !== null && s.m > MASTERY_BAND && s.confidence === "developing");
  return { firstAttempt, freshSuccess, masteryBand };
}

/** Stages reached in order: each needs the one before. */
export function stageFromMilestones(ms: Milestones): number {
  if (!ms.firstAttempt) return 0;
  if (!ms.freshSuccess) return 1;
  if (!ms.masteryBand) return 2;
  return 3;
}

export interface CompanionView {
  species: Species;
  stage: number;
  name: string;
  /** The next stage and what earns it, or null at the last stage. */
  next: { stage: number; name: string; needs: string } | null;
  /** New `companion_stage` ledger entries to write (one per stage newly reached). */
  grants: LedgerEntry[];
}

/** The companion's stage now: the higher of the ledger's record and today's milestones. */
export function companion(input: { species: Species; ledger: readonly LedgerEntry[]; milestones: Milestones; now: Iso }): CompanionView {
  const { species, ledger, milestones, now } = input;
  const names = STAGES[species];
  const granted = ledger
    .filter((e) => e.rule === "companion_stage" && e.key.startsWith(`companion:${species}:`))
    .reduce((m, e) => Math.max(m, Number(e.key.split(":")[2]) || 0), 0);
  const stage = Math.max(granted, stageFromMilestones(milestones));
  const grants: LedgerEntry[] = [];
  for (let s = granted + 1; s <= stage; s++) {
    grants.push({ key: `companion:${species}:${s}`, kind: "companion_stage", rule: "companion_stage", amount: 0, ref: names[s], at: now, day: sgDate(now) });
  }
  return {
    species,
    stage,
    name: names[stage],
    next: stage < 3 ? { stage: stage + 1, name: names[stage + 1], needs: NEEDS[stage] } : null,
    grants,
  };
}
