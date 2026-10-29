// The touchable habitat's data (founder, 30 Oct): every part sits inside its picture with a fact and a sound, and
// every stage of every pet has its own tap lines and a reason for staying in its zone.
import { describe, expect, it } from "vitest";
import { PET_IDS, PETS } from "@/lib/pets/species";
import { SPOTS } from "./habitats";
import { POKE_SOUND, SPOT_SOUND, TOUCH_HINT, pokeLines, zoneLine } from "./touch";

describe("touchable habitats", () => {
  it("puts every part inside the picture, with a fact and a sound", () => {
    for (const id of PET_IDS) {
      expect(SPOTS[id].length).toBeGreaterThanOrEqual(5);
      expect(new Set(SPOTS[id].map((s) => s.id)).size).toBe(SPOTS[id].length);
      for (const s of SPOTS[id]) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w).toBeLessThanOrEqual(100);
        expect(s.y + s.h).toBeLessThanOrEqual(100);
        expect(s.fact.length).toBeGreaterThan(20);
        expect(SPOT_SOUND[s.kind]).toBeTruthy();
      }
      expect(TOUCH_HINT[id]).toBeTruthy();
    }
  });

  it("gives every stage tap lines, a tap sound and a zone line", () => {
    for (const id of PET_IDS) {
      PETS[id].stages.forEach((st, i) => {
        expect(pokeLines(id, i, st.move).length).toBeGreaterThanOrEqual(3);
        expect(POKE_SOUND[st.move]).toBeTruthy();
        expect(zoneLine(id, i, st.zone)).toBeTruthy();
      });
    }
  });

  it("never calls an egg's shell jelly", () => {
    expect(pokeLines("chicken", 0, "wobble").join(" ")).not.toMatch(/jelly/i);
    expect(pokeLines("frog", 0, "wobble").join(" ")).toMatch(/jelly/i);
  });
});
