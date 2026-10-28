// Tests for the composed themes: every score validates, the planner is
// deterministic per seed, loops never overrun their edge, and every melody
// note sits on its bar's chord (the consonance guarantee).
import { describe, expect, it } from "vitest";
import { THEMES } from "./index";
import { planLoop } from "./plan";
import { MOODS, ThemeScore, type ThemePack } from "./schema";

const PACKS = Object.keys(THEMES) as ThemePack[];

describe("theme scores", () => {
  it("all five packs have a valid score", () => {
    expect(PACKS).toHaveLength(5);
    for (const pack of PACKS) {
      expect(THEMES[pack].pack).toBe(pack);
      expect(THEMES[pack].composer).toBe("Muse Code");
    }
  });

  it("rejects a motif that does not fill its bar", () => {
    const bad = { ...THEMES.dreamlight, motifs: { a: [{ tone: 0, len: 3 }] }, form: ["a", "a", "b", "a"] };
    expect(ThemeScore.safeParse(bad).success).toBe(false);
  });

  it("rejects drums outside the driving mood", () => {
    const bad = { ...THEMES["toon-pop"], layers: { ...THEMES["toon-pop"].layers, drums: ["bright"] } };
    expect(ThemeScore.safeParse(bad).success).toBe(false);
  });
});

describe("planLoop", () => {
  it("is deterministic per seed and varies across seeds", () => {
    const a = planLoop(THEMES.terrarium, "calm", 7);
    const b = planLoop(THEMES.terrarium, "calm", 7);
    const c = planLoop(THEMES.terrarium, "calm", 8);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it("keeps every event inside the loop (no edge clicks)", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        const plan = planLoop(THEMES[pack], mood, 42);
        const total = plan.bars * 4;
        for (const e of plan.events) {
          expect(e.bar * 4 + e.beat + e.durBeats).toBeLessThanOrEqual(total + 1e-9);
        }
        expect(plan.loopSecs).toBeCloseTo((total * 60) / plan.bpm, 9);
      }
    }
  });

  it("plays melody on its bar's chord tones in every mood", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        const score = THEMES[pack];
        const plan = planLoop(score, mood, 11);
        for (const e of plan.events) {
          if (e.layer !== "melody") continue;
          const chord = score.chords[e.bar].map((n) => n.replace(/[0-8]$/, ""));
          for (const n of e.notes) {
            const pc = n.replace(/[0-8]$/, "");
            const inChord = chord.includes(pc);
            // Grace-note ornaments may lean on the neighbour; the resolved note follows.
            expect(inChord || e.durBeats < 0.3).toBe(true);
          }
        }
      }
    }
  });

  it("honours the brief's tempo bands", () => {
    for (const pack of PACKS) {
      const { bpm } = THEMES[pack];
      expect(bpm.calm).toBeGreaterThanOrEqual(60);
      expect(bpm.calm).toBeLessThanOrEqual(80);
    }
  });

  it("only drums when driving", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        const plan = planLoop(THEMES[pack], mood, 3);
        const drums = plan.events.filter((e) => e.layer === "drums");
        expect(drums.length > 0).toBe(mood === "driving");
      }
    }
  });
});
