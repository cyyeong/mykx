import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CRITTERS, INSECT_QUIZ, shuffledStages } from "./catalog.ts";

describe("Critter Lab catalogue", () => {
  it("has art and four stages for every living thing", () => {
    for (const c of CRITTERS) {
      expect(existsSync(`public${c.art}.webp`) && existsSync(`public${c.art}-800.webp`), c.id).toBe(true);
      expect(c.stages).toHaveLength(4);
    }
  });

  it("knows which are insects (P3 classification)", () => {
    expect(INSECT_QUIZ.filter((c) => c.insect).map((c) => c.id)).toEqual(["mealworm", "butterfly", "mosquito", "cockroach"]);
  });

  it("shuffles the order game deterministically and never starts solved", () => {
    expect(shuffledStages(7)).toEqual(shuffledStages(7));
    for (let s = 0; s < 50; s++) expect(shuffledStages(s).join()).not.toBe("0,1,2,3");
  });
});
