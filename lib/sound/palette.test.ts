import { describe, expect, it } from "vitest";
import { PACK_IDS } from "@/components/theme/packs";
import { PACK_SOUNDS, SOUND_EVENTS, defaultSoundOn, planFor, planLength } from "./palette";

describe("sound palette", () => {
  it("defines every pack, and Toon Pop is the only pack without ambience", () => {
    for (const pack of PACK_IDS) expect(PACK_SOUNDS[pack]).toBeDefined();
    const without = PACK_IDS.filter((p) => PACK_SOUNDS[p].ambience === null);
    expect(without).toEqual(["toon-pop"]);
    for (const pack of PACK_IDS) expect(Boolean(PACK_SOUNDS[pack].ambience)).toBe(Boolean(PACK_SOUNDS[pack].ambienceLabel));
  });

  it("has no sound for wrong answers", () => {
    expect(SOUND_EVENTS.some((e) => /wrong|incorrect|error|fail/i.test(e))).toBe(false);
  });

  it("keeps every effect short except the transform", () => {
    for (const pack of PACK_IDS) {
      for (const event of SOUND_EVENTS) {
        const length = planLength(planFor(pack, event));
        expect(length).toBeGreaterThan(0);
        if (event === "transform") expect(length).toBeLessThanOrEqual(2.8);
        else expect(length, `${pack}/${event}`).toBeLessThanOrEqual(0.6);
      }
    }
  });

  it("plays only notes from the pack's own scale or chord", () => {
    for (const pack of PACK_IDS) {
      const allowed = new Set([...PACK_SOUNDS[pack].scale, ...PACK_SOUNDS[pack].chord]);
      for (const event of SOUND_EVENTS) {
        for (const n of planFor(pack, event).notes) {
          expect(allowed.has(n.note), `${pack}/${event} ${n.note}`).toBe(true);
          expect(n.vel).toBeGreaterThan(0);
          expect(n.vel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("starts on for Junior and off for Teen", () => {
    expect(defaultSoundOn("junior")).toBe(true);
    expect(defaultSoundOn("teen")).toBe(false);
  });
});
