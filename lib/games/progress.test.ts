import { describe, expect, it } from "vitest";
import { applyRound, emptyProgress, isOpen, starTotals, type RoundReport } from "./progress.ts";
import { levelWords } from "./typing/levels.ts";

const NOW = "2026-10-29T10:00:00.000Z";
const round = (p: Partial<RoundReport>): RoundReport => ({ stage: 1, level: 1, hits: 50, misses: 1, correctChars: 50, ms: 120_000, finished: true, keys: {}, ...p });

describe("game progress", () => {
  it("scores deterministically and unlocks the next level", () => {
    const out = applyRound(emptyProgress("star-typer", 1, NOW), round({}), "junior", 6, NOW);
    expect(out.stars).toBe(3);
    expect(out.progress).toMatchObject({ stage: 1, level: 2, stars: { "1-1": 3 } });
    expect(out.unlocked).toBe(true);
    expect(applyRound(emptyProgress("star-typer", 1, NOW), round({}), "junior", 6, NOW).stars).toBe(3);
  });

  it("keeps the best stars and doesn't unlock from a replay of an older level", () => {
    let p = applyRound(emptyProgress("g", 1, NOW), round({ misses: 10 }), "junior", 6, NOW).progress;
    expect(p.stars["1-1"]).toBe(1);
    p = applyRound(p, round({ misses: 0 }), "junior", 6, NOW).progress;
    expect(p.stars["1-1"]).toBe(3);
    expect(p.level).toBe(2);
  });

  it("moves to the next stage after level 5, but not past the playable stages", () => {
    const p = { ...emptyProgress("g", 1, NOW), stage: 6, level: 5 };
    const out = applyRound(p, round({ stage: 6, level: 5 }), "junior", 6, NOW);
    expect(out.progress).toMatchObject({ stage: 6, level: 5 });
    const q = applyRound({ ...p, stage: 2 }, round({ stage: 2, level: 5 }), "junior", 6, NOW);
    expect(q.progress).toMatchObject({ stage: 3, level: 1 });
  });

  it("asks teens for the stage's speed for three stars", () => {
    expect(applyRound(emptyProgress("g", 4, NOW), round({ stage: 4, correctChars: 50, ms: 120_000 }), "teen", 6, NOW).stars).toBe(2);
    expect(applyRound(emptyProgress("g", 4, NOW), round({ stage: 4, correctChars: 200, ms: 120_000 }), "teen", 6, NOW).stars).toBe(3);
  });

  it("adds key tallies and only opens levels up to the furthest one", () => {
    const p = applyRound(emptyProgress("g", 1, NOW), round({ keys: { b: { hits: 3, misses: 2, instead: { n: 2 } } } }), "junior", 6, NOW).progress;
    const q = applyRound(p, round({ level: 2, keys: { b: { hits: 1, misses: 1, instead: { n: 1 } } } }), "junior", 6, NOW).progress;
    expect(q.keys.b).toEqual({ hits: 4, misses: 3, instead: { n: 3 } });
    expect(isOpen(q, 1, 3)).toBe(true);
    expect(isOpen(q, 1, 4)).toBe(false);
    expect(starTotals(q).possible).toBe(15);
  });

  it("has words for stages 1–6 at every level, and none yet for 7", () => {
    for (const school of ["P3", "P6", "Sec 2"] as const)
      for (let stage = 1; stage <= 6; stage++) for (let level = 1; level <= 5; level++) expect(levelWords(stage, level, school)?.length).toBe(10);
    expect(levelWords(7, 1, "P3")).toBeNull();
  });
});
