import { describe, expect, it } from "vitest";
import { STAGES, companion, milestonesFrom, stageFromMilestones } from "./companion.ts";
import { recompute } from "./mastery.ts";
import type { LedgerEntry } from "./rewards.ts";
import { BANNER, JETS, freshSuccesses, squadron } from "./squadron.ts";
import { attempt } from "./test-helpers.ts";

const NOW = "2026-11-04T12:00:00Z";
const none = { firstAttempt: false, freshSuccess: false, masteryBand: false };

describe("critter companion", () => {
  it("has the real life-cycle stages, froglet included", () => {
    expect(STAGES.frog).toEqual(["frogspawn", "tadpole", "froglet", "frog"]);
    expect(STAGES.mealworm).toEqual(["eggs", "larva", "pupa", "beetle"]);
  });

  it("grows one stage per milestone, in order", () => {
    expect(stageFromMilestones(none)).toBe(0);
    expect(stageFromMilestones({ ...none, firstAttempt: true })).toBe(1);
    expect(stageFromMilestones({ ...none, firstAttempt: true, freshSuccess: true })).toBe(2);
    expect(stageFromMilestones({ firstAttempt: true, freshSuccess: false, masteryBand: true })).toBe(1);
    expect(stageFromMilestones({ firstAttempt: true, freshSuccess: true, masteryBand: true })).toBe(3);
  });

  it("reads milestones from attempts and honest mastery", () => {
    const hinted = attempt({ at: "2026-11-01T01:00:00Z", hintsBeforeSubmit: 1 });
    expect(milestonesFrom([hinted], [])).toEqual({ firstAttempt: true, freshSuccess: false, masteryBand: false });
    const clean = attempt({ at: "2026-11-01T02:00:00Z" });
    expect(milestonesFrom([hinted, clean], []).freshSuccess).toBe(true);
    // Two correct answers push m above .7, but with limited evidence: no last stage yet.
    const two = [attempt({ at: "2026-11-01T03:00:00Z" }), attempt({ at: "2026-11-01T04:00:00Z" })];
    expect(milestonesFrom(two, [recompute(two, NOW)]).masteryBand).toBe(false);
    const five = Array.from({ length: 5 }, (_, k) => attempt({ at: `2026-11-0${1 + (k % 2)}T0${k}:00:00Z` }));
    expect(milestonesFrom(five, [recompute(five, NOW)]).masteryBand).toBe(true);
  });

  it("writes one ledger entry per new stage and never shrinks after a break", () => {
    const grown = companion({ species: "frog", ledger: [], milestones: { firstAttempt: true, freshSuccess: true, masteryBand: false }, now: NOW });
    expect(grown).toMatchObject({ stage: 2, name: "froglet", next: { name: "frog" } });
    expect(grown.grants.map((g) => [g.key, g.ref])).toEqual([
      ["companion:frog:1", "tadpole"],
      ["companion:frog:2", "froglet"],
    ]);
    const later = companion({ species: "frog", ledger: grown.grants, milestones: none, now: "2026-12-30T00:00:00Z" });
    expect(later).toMatchObject({ stage: 2, name: "froglet", grants: [] });
    const other = companion({ species: "mealworm", ledger: grown.grants, milestones: none, now: NOW });
    expect(other).toMatchObject({ stage: 0, name: "eggs", next: { name: "larva", needs: "answer your first question" } });
  });
});

describe("Sky Squadron", () => {
  it("unlocks one jet per four fresh successes, in order, then the banner", () => {
    expect(squadron({ successes: 3, ledger: [], now: NOW })).toMatchObject({ unlocked: [], banner: false, next: { jet: "dragonfly", have: 3, need: 4 } });
    expect(squadron({ successes: 9, ledger: [], now: NOW })).toMatchObject({ unlocked: ["dragonfly", "bumblebee"], next: { jet: "firefly", have: 1 } });
    const full = squadron({ successes: 40, ledger: [], now: NOW });
    expect(full).toMatchObject({ unlocked: [...JETS], banner: true, next: null });
    expect(full.grants.map((g) => g.ref)).toEqual([...JETS, BANNER]);
  });

  it("is idempotent and never takes a jet back", () => {
    const first = squadron({ successes: 4, ledger: [], now: NOW });
    expect(first.grants).toHaveLength(1);
    const ledger: LedgerEntry[] = first.grants;
    expect(squadron({ successes: 4, ledger, now: NOW }).grants).toEqual([]);
    expect(squadron({ successes: 0, ledger, now: NOW }).unlocked).toEqual(["dragonfly"]);
    expect(squadron({ successes: Number.NaN, ledger: [], now: NOW }).unlocked).toEqual([]);
  });

  it("counts only independent first attempts on fresh families", () => {
    const events = [
      attempt({ itemId: "a", at: "2026-11-01T01:00:00Z" }), // counts
      attempt({ itemId: "a", firstTry: false, at: "2026-11-01T01:01:00Z" }), // retry
      attempt({ itemId: "b", family: "a", at: "2026-11-01T01:02:00Z" }), // variant of a seen family
      attempt({ itemId: "c", hintsBeforeSubmit: 1, at: "2026-11-01T01:03:00Z" }), // assisted
      attempt({ itemId: "d", marks: 1, at: "2026-11-01T01:04:00Z" }), // partial
      attempt({ itemId: "e", revealed: true, at: "2026-11-01T01:05:00Z" }), // revealed
      attempt({ itemId: "f", at: "2026-11-01T01:06:00Z", skill: "p6-maths", topic: "number.ratio", subskill: "ba_total_unchanged" }), // counts
    ];
    expect(freshSuccesses(events)).toBe(2);
  });
});
