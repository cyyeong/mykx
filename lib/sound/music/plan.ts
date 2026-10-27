// Turns a theme score into one loop of timed events. Pure and deterministic:
// the same (score, mood, seed) always plans the same loop, so the sequencer
// loops bar-for-bar identical audio while the seed picks ornaments that keep
// repeats from feeling mechanical. No Tone.js here; the engine plays the plan.
import { PACK_SOUNDS } from "@/lib/sound/palette";
import type { ThemeMood, ThemeScore } from "./schema";

export type PlannedEvent = {
  /** Bar index in the loop. */
  bar: number;
  /** Beats from the bar start (4/4). */
  beat: number;
  /** Length in beats; never crosses the loop end, so loops have no clicks. */
  durBeats: number;
  notes: string[];
  layer: "pad" | "melody" | "bass" | "pulse" | "sparkle" | "drums";
  /** 0–1. */
  vel: number;
  /** ms of humanising nudge; the engine adds it to the exact grid time. */
  nudgeMs: number;
  /** Kick or hat, for drum events. */
  drum?: "kick" | "hat";
};

export type LoopPlan = {
  bpm: number;
  beatsPerBar: 4;
  bars: number;
  /** Seconds per loop. */
  loopSecs: number;
  events: PlannedEvent[];
};

/** Tiny seeded PRNG (mulberry32) so variation is reproducible per seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OCTAVE_UP = 12;

/** Transpose a note name by semitones, keeping letter spelling simple. */
function shift(note: string, semis: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const m = note.match(/^([A-G](?:#|b)?)(-?\d)$/);
  if (!m) return note;
  const flats: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
  const base = flats[m[1]] ?? m[1];
  const midi = names.indexOf(base) + (Number(m[2]) + 1) * 12 + semis;
  const oct = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${oct}`;
}

export function planLoop(score: ThemeScore, mood: ThemeMood, seed: number): LoopPlan {
  const rand = rng(seed);
  const bpm = score.bpm[mood];
  const beatSecs = 60 / bpm;
  const loopSecs = score.bars * 4 * beatSecs;
  const layers = new Set(score.layers ? Object.entries(score.layers).filter(([, moods]) => moods.includes(mood)).map(([l]) => l) : []);
  const events: PlannedEvent[] = [];
  const push = (e: PlannedEvent) => {
    // Clamp inside the loop so nothing is cut off at the edge (no clicks).
    const startBeat = e.bar * 4 + e.beat;
    e.durBeats = Math.min(e.durBeats, score.bars * 4 - startBeat);
    if (e.durBeats > 0) events.push(e);
  };

  for (let bar = 0; bar < score.bars; bar++) {
    const chord = score.chords[bar];
    const tone = (i: number) => chord[i % chord.length];
    if (layers.has("pad")) {
      push({ bar, beat: 0, durBeats: 3.9, notes: [...chord], layer: "pad", vel: 0.3, nudgeMs: 0 });
    }
    if (layers.has("bass")) {
      push({ bar, beat: 0, durBeats: 0.9, notes: [score.bass[bar]], layer: "bass", vel: 0.42, nudgeMs: 0 });
      push({ bar, beat: 2, durBeats: 0.9, notes: [score.bass[bar]], layer: "bass", vel: 0.34, nudgeMs: (rand() - 0.5) * 8 });
    }
    if (layers.has("melody")) {
      const steps = score.motifs[score.form[bar]];
      let beat = 0;
      for (const s of steps) {
        let note = tone(s.tone);
        if (s.up || (mood === "dreamy" && rand() < 0.3)) note = shift(note, OCTAVE_UP);
        // Seeded ornament: one in six steps leans on the upper neighbour first.
        const grace = rand() < 0.16;
        const vel = 0.5 + rand() * 0.15;
        const nudgeMs = (rand() - 0.5) * 14;
        if (grace && s.len >= 0.5) {
          push({ bar, beat, durBeats: 0.22, notes: [shift(tone(s.tone + 1), s.up ? OCTAVE_UP : 0)], layer: "melody", vel: vel * 0.6, nudgeMs });
          push({ bar, beat: beat + 0.25, durBeats: s.len - 0.25, notes: [note], layer: "melody", vel, nudgeMs });
        } else {
          push({ bar, beat, durBeats: Math.max(0.2, s.len * 0.92), notes: [note], layer: "melody", vel, nudgeMs });
        }
        beat += s.len;
      }
    }
    if (layers.has("pulse")) {
      for (const b of [0, 1, 2, 3]) {
        push({ bar, beat: b + 0.5, durBeats: 0.22, notes: [tone(1)], layer: "pulse", vel: b % 2 ? 0.2 : 0.28, nudgeMs: 0 });
      }
    }
    if (layers.has("sparkle")) {
      const scale = PACK_SOUNDS[score.pack].scale;
      const hits = mood === "dreamy" ? 3 : 2;
      for (let h = 0; h < hits; h++) {
        const beat = Math.floor(rand() * 8) / 2;
        const note = scale[Math.floor(rand() * scale.length)];
        push({ bar, beat, durBeats: 0.5, notes: [note], layer: "sparkle", vel: 0.16 + rand() * 0.1, nudgeMs: (rand() - 0.5) * 20 });
      }
    }
    if (layers.has("drums")) {
      for (const b of [0, 1, 2, 3]) push({ bar, beat: b, durBeats: 0.2, notes: ["C1"], layer: "drums", drum: "kick", vel: 0.7, nudgeMs: 0 });
      for (const b of [0.5, 1.5, 2.5, 3.5]) push({ bar, beat: b, durBeats: 0.05, notes: [], layer: "drums", drum: "hat", vel: 0.22, nudgeMs: 0 });
    }
  }
  events.sort((a, b) => a.bar - b.bar || a.beat - b.beat);
  return { bpm, beatsPerBar: 4, bars: score.bars, loopSecs, events };
}
