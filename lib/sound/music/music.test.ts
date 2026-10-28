// Tests for the composed themes: every score validates and is a real song form
// (two or more sections, 16–32 bars, 45 s or more per pass), the planner is
// deterministic per seed and pass, nothing hangs over the loop point, mono
// instruments never overlap, and every melody note fits its bar's harmony.
import { describe, expect, it } from "vitest";
import { THEMES } from "./index";
import { expandForm, isMonoPart, passSeconds, planPass, type PlannedEvent } from "./plan";
import { MOODS, ThemeScore, type ThemePack } from "./schema";
import { chordPcs, midiOf, parseChord, pitchClass } from "./theory";

const PACKS = Object.keys(THEMES) as ThemePack[];
const pcOf = (note: string) => ((midiOf(note) ?? 0) % 12 + 12) % 12;

/** The chord sounding at a step of the pass (bars split evenly between their chords). */
function chordAtStep(pack: ThemePack, step: number) {
  const score = THEMES[pack];
  const spb = score.meter * 4;
  const bar = expandForm(score)[Math.floor(step / spb)];
  const symbols = bar.section.chords[bar.index].split(/\s+/);
  const slot = Math.floor((step % spb) / (spb / symbols.length));
  return parseChord(symbols[slot])!;
}

describe("theme scores", () => {
  it("all five packs have a valid score, rewritten by Claude Code", () => {
    expect(PACKS).toHaveLength(5);
    for (const pack of PACKS) {
      expect(THEMES[pack].pack).toBe(pack);
      expect(THEMES[pack].composer).toBe("Claude Code");
    }
    expect(new Set(PACKS.map((p) => THEMES[p].title)).size).toBe(5);
  });

  it("is a song form of 16–32 bars with at least two sections that have their own progressions", () => {
    for (const pack of PACKS) {
      const score = THEMES[pack];
      const bars = expandForm(score).length;
      expect(bars, pack).toBeGreaterThanOrEqual(16);
      expect(bars, pack).toBeLessThanOrEqual(32);
      const progressions = new Set(score.form.map((n) => score.sections[n].chords.join("|")));
      expect(progressions.size, pack).toBeGreaterThanOrEqual(2);
      expect(score.sections.A, pack).toBeDefined();
      expect(score.sections.B, pack).toBeDefined();
      expect(score.sections.A.chords.join("|")).not.toBe(score.sections.B.chords.join("|"));
    }
  });

  it("runs at least 45 s before the form repeats, in every mood and at full Arcade heat", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        expect(passSeconds(THEMES[pack], mood, 1), `${pack}/${mood}`).toBeGreaterThanOrEqual(45);
      }
    }
  });

  it("gives every world its own harmony (no two A sections share a progression)", () => {
    const openings = PACKS.map((p) => THEMES[p].sections.A.chords.join("|"));
    expect(new Set(openings).size).toBe(5);
  });

  it("avoids the stock four-chord loops (I–V–vi–IV and I–vi–IV–V in any rotation)", () => {
    const stock = [
      [0, 7, 9, 5],
      [0, 9, 5, 7],
    ].flatMap((p) => p.map((_, r) => [...p.slice(r), ...p.slice(0, r)].join(",")));
    for (const pack of PACKS) {
      const score = THEMES[pack];
      // Relative to the major tonic, so a minor key's i–VI–III–VII is caught too.
      const tonic = pitchClass(score.key.split(" ")[0])! + (score.key.includes("minor") ? 3 : 0);
      for (const [name, section] of Object.entries(score.sections)) {
        const roots = section.chords.map((bar) => ((parseChord(bar.split(/\s+/)[0])!.root - tonic) % 12 + 12) % 12);
        for (let i = 0; i + 4 <= roots.length; i++) {
          expect(stock.includes(roots.slice(i, i + 4).join(",")), `${pack} ${name} bars ${i + 1}-${i + 4}`).toBe(false);
        }
      }
    }
  });

  it("honours the brief's tempo bands", () => {
    for (const pack of PACKS) {
      const { bpm } = THEMES[pack];
      expect(bpm.calm).toBeGreaterThanOrEqual(60);
      expect(bpm.calm).toBeLessThanOrEqual(80);
      expect(bpm.dreamy).toBeLessThan(bpm.calm);
      expect(bpm.bright).toBeGreaterThan(bpm.calm);
      expect(bpm.driving).toBeGreaterThan(bpm.bright);
    }
  });

  describe("schema", () => {
    const base = THEMES.dreamlight;
    const withSection = (patch: Partial<ThemeScore["sections"][string]>) => ({
      ...base,
      sections: { ...base.sections, A: { ...base.sections.A, ...patch } },
    });

    it("rejects a melody bar that does not fill the meter", () => {
      const melody = [...base.sections.A.melody];
      melody[0] = "G5:1 B5:1";
      expect(ThemeScore.safeParse(withSection({ melody })).success).toBe(false);
    });

    it("rejects durations off the 16th grid", () => {
      const melody = [...base.sections.A.melody];
      melody[0] = "G5:1.3 B5:0.7 D6:1";
      expect(ThemeScore.safeParse(withSection({ melody })).success).toBe(false);
    });

    it("rejects unknown chord symbols", () => {
      const chords = [...base.sections.A.chords];
      chords[0] = "Cmaj13#11";
      expect(ThemeScore.safeParse(withSection({ chords })).success).toBe(false);
    });

    it("rejects patterns that are not whole bars", () => {
      expect(ThemeScore.safeParse(withSection({ bass: "1-------" })).success).toBe(false);
    });

    it("rejects a form that names a missing section, or runs under 16 or over 32 bars", () => {
      expect(ThemeScore.safeParse({ ...base, form: ["A", "Z"] }).success).toBe(false);
      const a = base.sections.A;
      const short = withSection({ chords: a.chords.slice(0, 4), melody: a.melody.slice(0, 4) });
      expect(ThemeScore.safeParse({ ...short, form: ["A", "B"] }).success).toBe(false);
      expect(ThemeScore.safeParse({ ...base, form: ["A", "B", "A", "B", "A"] }).success).toBe(false);
      expect(ThemeScore.safeParse({ ...base, form: ["A", "B"] }).success).toBe(true);
    });

    it("rejects a form whose sections all share one progression", () => {
      expect(ThemeScore.safeParse({ ...base, form: ["A", "A", "A", "A"] }).success).toBe(false);
    });

    it("rejects drums outside the driving mood", () => {
      const bad = { ...THEMES["toon-pop"], layers: { ...THEMES["toon-pop"].layers, drums: ["bright"] } };
      expect(ThemeScore.safeParse(bad).success).toBe(false);
    });

    it("rejects percussion in the calm (learning) mood", () => {
      const bad = { ...THEMES.terrarium, layers: { ...THEMES.terrarium.layers, perc: ["calm", "bright"] } };
      expect(ThemeScore.safeParse(bad).success).toBe(false);
    });

    it("rejects a melody that stops in the calm mood", () => {
      const bad = { ...base, layers: { ...base.layers, melody: ["bright"] } };
      expect(ThemeScore.safeParse(bad).success).toBe(false);
    });
  });
});

describe("planPass", () => {
  it("is deterministic per seed and pass, and varies across seeds and passes", () => {
    const a = planPass(THEMES.terrarium, "calm", 7, 0);
    expect(planPass(THEMES.terrarium, "calm", 7, 0)).toEqual(a);
    expect(JSON.stringify(planPass(THEMES.terrarium, "calm", 8, 0))).not.toBe(JSON.stringify(a));
    expect(JSON.stringify(planPass(THEMES.terrarium, "calm", 7, 1))).not.toBe(JSON.stringify(a));
  });

  it("keeps every event inside the pass (no notes hang over the loop point)", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        const plan = planPass(THEMES[pack], mood, 42, 3);
        const total = plan.steps / 4;
        expect(plan.steps).toBe(plan.bars * plan.stepsPerBar);
        for (const e of plan.events) {
          expect(e.durBeats).toBeGreaterThan(0);
          expect(e.step / 4 + e.durBeats, `${pack}/${mood} step ${e.step}`).toBeLessThanOrEqual(total + 1e-9);
          expect(e.bar * plan.stepsPerBar + e.beat * 4).toBe(e.step);
        }
        expect(plan.passSecs).toBeCloseTo((plan.bars * plan.meter * 60) / plan.bpm, 9);
      }
    }
  });

  it("never overlaps or double-books a mono instrument (Tone needs rising start times)", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        const plan = planPass(THEMES[pack], mood, 5, 0);
        const byPart = new Map<string, PlannedEvent[]>();
        for (const e of plan.events) if (isMonoPart(THEMES[pack], e.part)) byPart.set(e.part, [...(byPart.get(e.part) ?? []), e]);
        for (const [part, list] of byPart) {
          for (let k = 1; k < list.length; k++) {
            expect(list[k].step, `${pack}/${mood}/${part}`).toBeGreaterThan(list[k - 1].step);
            expect(list[k - 1].step / 4 + list[k - 1].durBeats, `${pack}/${mood}/${part}`).toBeLessThan(list[k].step / 4);
          }
        }
      }
    }
  });

  it("lands every melody note that starts a bar or a chord on that chord, and keeps lines in the key", () => {
    for (const pack of PACKS) {
      const score = THEMES[pack];
      const scale = new Set(score.scale.map((n) => pitchClass(n)!));
      const spb = score.meter * 4;
      for (const mood of MOODS) {
        for (const e of planPass(score, mood, 11, 0).events) {
          if (e.layer !== "melody" && e.layer !== "answer") continue;
          const chord = chordPcs(chordAtStep(pack, e.step));
          for (const n of e.notes) {
            expect(scale.has(pcOf(n)) || chord.has(pcOf(n)), `${pack} ${e.layer} ${n} at step ${e.step}`).toBe(true);
          }
          const symbols = expandForm(score)[e.bar].section.chords[expandForm(score)[e.bar].index].split(/\s+/);
          const onChordChange = (e.step % spb) % (spb / symbols.length) === 0;
          if (e.layer === "melody" && onChordChange && !e.grace) {
            for (const n of e.notes) expect(chord.has(pcOf(n)), `${pack} melody ${n} at bar ${e.bar + 1}`).toBe(true);
          }
        }
      }
    }
  });

  it("only drums when driving, and gates the Arcade extras by heat", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        const plan = planPass(THEMES[pack], mood, 3, 0);
        const drums = plan.events.filter((e) => e.layer === "drums");
        expect(drums.length > 0, `${pack}/${mood}`).toBe(mood === "driving");
        if (mood !== "driving") expect(plan.events.every((e) => e.minHeat === 0)).toBe(true);
      }
      const driving = planPass(THEMES[pack], "driving", 3, 0);
      expect(driving.events.some((e) => e.minHeat > 0), pack).toBe(true);
      expect(driving.events.some((e) => e.layer === "drums" && e.minHeat === 0), pack).toBe(true);
    }
  });

  it("keeps the calm learning bed light: bass on the strong beats, arpeggios in eighths", () => {
    for (const pack of PACKS) {
      const plan = planPass(THEMES[pack], "calm", 9, 0);
      const strong = plan.stepsPerBar === 12 ? 12 : 8;
      for (const e of plan.events) {
        if (e.layer === "bass") expect(e.step % strong, pack).toBe(0);
        if (e.layer === "arp") expect(e.step % 2, pack).toBe(0);
      }
    }
  });

  it("gives learning no percussion, Home a light on-the-beat bass, and saves the full groove for the games", () => {
    for (const pack of PACKS) {
      const calm = planPass(THEMES[pack], "calm", 4, 0);
      expect(calm.events.filter((e) => e.layer === "perc" || e.layer === "drums"), pack).toHaveLength(0);
      const bright = planPass(THEMES[pack], "bright", 4, 0);
      expect(bright.events.filter((e) => e.layer === "drums"), pack).toHaveLength(0);
      for (const e of bright.events) if (e.layer === "bass") expect(e.step % 4, `${pack} bright bass`).toBe(0);
    }
  });

  it("places sparkle on fixed slots and a regular count per bar: organised, never stray", () => {
    for (const pack of PACKS) {
      const score = THEMES[pack];
      const spb = score.meter * 4;
      const slots = spb === 12 ? [10, 6, 2] : [14, 6, 10, 2];
      for (const mood of MOODS) {
        const plan = planPass(score, mood, 77, 0);
        const sparkle = plan.events.filter((e) => e.layer === "sparkle");
        for (const e of sparkle) expect(slots.includes(e.step % spb), `${pack}/${mood}`).toBe(true);
        if (!(score.layers.sparkle ?? []).includes(mood)) continue;
        const expected = Math.round(plan.bars * score.sparkle.perBar[mood]);
        expect(Math.abs(sparkle.length - expected), `${pack}/${mood}`).toBeLessThanOrEqual(1);
        // Same slots on every pass and seed; only the pitch varies.
        const other = planPass(score, mood, 78, 1).events.filter((e) => e.layer === "sparkle");
        expect(other.map((e) => e.step)).toEqual(sparkle.map((e) => e.step));
      }
    }
  });

  it("caps chord sizes so polyphony stays small", () => {
    for (const pack of PACKS) {
      for (const mood of MOODS) {
        for (const e of planPass(THEMES[pack], mood, 1, 0).events) {
          expect(e.notes.length, `${pack} ${e.layer}`).toBeLessThanOrEqual(e.layer === "pad" || e.layer === "arp" ? 4 : 3);
          for (const n of e.notes) expect(midiOf(n), `${pack} ${e.layer} ${n}`).not.toBeNull();
        }
      }
    }
  });
});
