// Turns a theme score into one pass through its form as timed events. Pure and
// deterministic: the same (score, mood, seed, pass) always plans the same
// pass, and each new pass reseeds the ornaments (grace notes, bass fills,
// sparkle, humanising), so repeats never come back bar for bar. No Tone.js
// here; the engine plays the plan one 16th step at a time.
import { PERC_DRUMS, type DrumKind, type Layer, type ThemeMood, type ThemeScore, type ThemeSection } from "./schema";
import { barHits, midiOf, nearest, noteOf, parseBarLine, parseChord, pitchClass, type Chord, type Hit } from "./theory";

/** The session instrument that plays an event. */
export type Part = "lead" | "counter" | "pad" | "bass" | "drop" | "kick" | "snap" | "hat" | "block";

export type PlannedEvent = {
  /** 16th step from the start of the pass. */
  step: number;
  /** Bar index in the pass. */
  bar: number;
  /** Beats from the bar start. */
  beat: number;
  /** Length in beats; never crosses the pass end, and mono parts never overlap. */
  durBeats: number;
  notes: string[];
  layer: Layer;
  part: Part;
  /** 0–1. */
  vel: number;
  /** ms of humanising nudge; the engine adds it (and swing) to the exact grid time. */
  nudgeMs: number;
  /** Driving mood only: the event waits until the Arcade heat reaches this. */
  minHeat: number;
  drum?: DrumKind;
  /** A seeded grace note leaning into the next melody note. */
  grace?: true;
};

export type PassPlan = {
  bpm: number;
  heatBpm: number;
  meter: 3 | 4;
  stepsPerBar: number;
  bars: number;
  steps: number;
  /** Seconds per pass at `bpm`. */
  passSecs: number;
  swing: number;
  events: PlannedEvent[];
};

/** The rhythm section the Beat switch silences: bass and every drum. The tune, pad and arpeggios keep playing. */
export const BEAT_PARTS: ReadonlySet<Part> = new Set(["bass", "kick", "snap", "hat", "block"]);

/** Instruments that play one note at a time (Tone needs their start times strictly increasing). */
const MONO_PARTS: ReadonlySet<Part> = new Set(["bass", "drop", "kick", "snap", "hat", "block"]);
export function isMonoPart(score: ThemeScore, part: Part): boolean {
  return MONO_PARTS.has(part) || (part === "counter" && Boolean(score.glide));
}

const DRUM_PART: Record<DrumKind, Part> = { kick: "kick", snare: "snap", clap: "snap", hat: "hat", shaker: "hat", block: "block" };
const MOOD_VEL: Record<ThemeMood, number> = { calm: 0.8, dreamy: 0.72, bright: 1, driving: 1 };
const HIT_VEL: Record<string, number> = { X: 1, x: 0.72, o: 0.42 };

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

/** A distinct seed for each pass through the form. */
export function passSeed(seed: number, pass: number): number {
  return (seed ^ Math.imul(pass + 1, 0x9e3779b1)) >>> 0;
}

export type FormBar = { name: string; section: ThemeSection; index: number; last: boolean };

/** The form as a flat list of bars. */
export function expandForm(score: ThemeScore): FormBar[] {
  return score.form.flatMap((name) => {
    const section = score.sections[name];
    return section.chords.map((_, index) => ({ name, section, index, last: index === section.chords.length - 1 }));
  });
}

/** Seconds one pass lasts in `mood` (at full heat when driving). */
export function passSeconds(score: ThemeScore, mood: ThemeMood, heat = 0): number {
  const bpm = score.bpm[mood] + (mood === "driving" ? heat * score.heatBpm : 0);
  return (expandForm(score).length * score.meter * 60) / bpm;
}

type Slot = { start: number; len: number; chord: Chord };

function chordSlots(bar: string, stepsPerBar: number): Slot[] {
  const symbols = bar.trim().split(/\s+/);
  const len = stepsPerBar / symbols.length;
  return symbols.map((sym, k) => ({ start: k * len, len, chord: parseChord(sym)! }));
}

/** The chord's tones stacked up from `root`. */
function stackFrom(chord: Chord, root: number): number[] {
  return [...new Set(chord.tones)].map((i) => root + i);
}

/** The chord's tones stacked up from the root nearest `base`. */
function stack(chord: Chord, base: number): number[] {
  return stackFrom(chord, nearest(chord.root, base));
}

/** An arpeggio root that moves as little as possible from the last one, kept near `base`. */
function arpRoot(chord: Chord, prev: number | null, base: number): number {
  let root = nearest(chord.root, prev ?? base);
  while (root < base - 7) root += 12;
  while (root > base + 8) root -= 12;
  return root;
}

/**
 * A close pad voicing around `center`: the bass note and (if crowded) the fifth
 * are left to others, and semitone rubs are opened up by lifting the lower note.
 */
export function padVoicing(chord: Chord, center: number): string[] {
  let pcs = [...new Set(chord.tones.map((i) => (chord.root + i) % 12))];
  if (pcs.length >= 4) pcs = pcs.filter((pc) => pc !== chord.bass);
  if (pcs.length > 4) pcs = pcs.filter((pc) => pc !== (chord.root + 7) % 12);
  const notes = pcs.slice(0, 4).map((pc) => nearest(pc, center));
  for (let pass = 0; pass < 2; pass++) {
    notes.sort((a, b) => a - b);
    for (let k = 0; k + 1 < notes.length; k++) if (notes[k + 1] - notes[k] === 1) notes[k] += 12;
  }
  return notes.sort((a, b) => a - b).map(noteOf);
}

function degree(chord: Chord, ch: string): number {
  const has = (i: number) => chord.tones.includes(i);
  switch (ch) {
    case "3":
      return has(3) ? 3 : has(4) ? 4 : has(5) ? 5 : 2;
    case "5":
      return has(6) ? 6 : has(8) ? 8 : 7;
    case "7":
      return has(11) ? 11 : has(10) ? 10 : has(9) ? 9 : 10;
    case "6":
      return 9;
    case "4":
      return 5;
    default:
      return 2;
  }
}

/** A bass note for a pattern degree; the root (or slash note) voice-leads from the previous bar. */
function bassNote(chord: Chord, ch: string, prev: number | null, base: number): { note: number; anchor: number } {
  let anchor = nearest(chord.bass, prev ?? base);
  while (anchor < base - 10) anchor += 12;
  while (anchor > base + 7) anchor -= 12;
  if (ch === "1") return { note: anchor, anchor };
  if (ch === "8") return { note: anchor + 12, anchor };
  let note = nearest((chord.root + degree(chord, ch)) % 12, anchor + 6);
  while (note <= anchor) note += 12;
  while (note > anchor + 12) note -= 12;
  return { note, anchor };
}

/** Calm and dreamy beds keep the bass to the strong beats, each note held to the next. */
function thinBass(hits: Hit[], stepsPerBar: number): Hit[] {
  const every = stepsPerBar === 12 ? 12 : 8;
  const kept = hits.filter((h) => h.step % every === 0);
  if (!kept.length && hits.length) kept.push(hits[0]);
  return kept.map((h, k) => ({ ...h, len: (kept[k + 1]?.step ?? stepsPerBar) - h.step }));
}

/** Bright (Home) keeps a light bass: on the beat only, no pumping eighths or pushes. */
function lightBass(hits: Hit[]): Hit[] {
  const kept = hits.filter((h) => h.step % 4 === 0);
  return kept.length ? kept : hits.slice(0, 1);
}

/**
 * Sparkle lands on fixed slots in the bar (the last eighth first), and a regular
 * number per bar, so it reads as part of the arrangement rather than stray notes.
 * Only the pitch is seeded.
 */
function sparkleSlots(stepsPerBar: number): number[] {
  return stepsPerBar === 12 ? [10, 6, 2] : [14, 6, 10, 2];
}
function sparkleCount(bar: number, perBar: number): number {
  return Math.floor((bar + 1) * perBar + 1e-9) - Math.floor(bar * perBar + 1e-9);
}

/** Ascending notes of the scale from `base` upward. */
function scaleLadder(scalePcs: number[], base: number): number[] {
  const out: number[] = [];
  for (let m = base; out.length < 16; m++) if (scalePcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

/**
 * A grace note that approaches `note` by step from the side the line comes from
 * (from below after a rise, from above after a fall), or null when the line
 * already moves by step and an ornament would only repeat the last note.
 */
function graceInto(note: string, prev: number | null, scalePcs: number[]): string | null {
  const m = midiOf(note)!;
  const dir = prev !== null && prev < m ? -1 : 1;
  for (let k = 1; k <= 12; k++) {
    const g = m + dir * k;
    if (scalePcs.includes(((g % 12) + 12) % 12)) return g === prev ? null : noteOf(g);
  }
  return null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0.02, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function planPass(score: ThemeScore, mood: ThemeMood, seed: number, pass = 0): PassPlan {
  const rand = rng(passSeed(seed, pass));
  const stepsPerBar = score.meter * 4;
  const form = expandForm(score);
  const steps = form.length * stepsPerBar;
  const totalBeats = steps / 4;
  const bpm = score.bpm[mood];
  const on = (l: Layer) => score.layers[l]?.includes(mood) ?? false;
  const layerHeat = (l: Layer) => (mood === "driving" ? (score.heat?.[l] ?? 0) : 0);
  const thin = mood === "calm" || mood === "dreamy";
  const mv = MOOD_VEL[mood];
  const scalePcs = score.scale.map((n) => pitchClass(n)!);
  const reg = {
    pad: midiOf(score.register.pad)!,
    bass: midiOf(score.register.bass)!,
    arp: midiOf(score.register.arp)!,
    sparkle: midiOf(score.register.sparkle)!,
  };
  const events: PlannedEvent[] = [];
  const push = (e: Omit<PlannedEvent, "bar" | "beat">) => {
    // Clamp inside the pass so nothing hangs over the loop point.
    const dur = Math.min(e.durBeats, totalBeats - e.step / 4);
    if (dur <= 0) return;
    events.push({ ...e, durBeats: round3(dur), bar: Math.floor(e.step / stepsPerBar), beat: (e.step % stepsPerBar) / 4 });
  };
  let prevBass: number | null = null;
  let prevArp: number | null = null;
  let prevMelody: number | null = null;

  form.forEach((fb, b) => {
    const s = fb.section;
    const i = fb.index;
    const at = b * stepsPerBar;
    const slots = chordSlots(s.chords[i], stepsPerBar);
    const chordAt = (step: number) => (slots.find((x) => step >= x.start && step < x.start + x.len) ?? slots[0]).chord;

    if (on("pad")) {
      for (const hit of barHits(s.pad ?? "*" + "-".repeat(stepsPerBar - 1), i, stepsPerBar)) {
        for (const slot of slots) {
          const start = Math.max(hit.step, slot.start);
          const end = Math.min(hit.step + hit.len, slot.start + slot.len);
          if (end <= start) continue;
          push({ step: at + start, durBeats: (end - start) / 4, notes: padVoicing(slot.chord, reg.pad), layer: "pad", part: "pad", vel: 0.34 * mv, nudgeMs: 0, minHeat: layerHeat("pad") });
        }
      }
    }

    if (on("drone") && s.drone && i % 2 === 0) {
      const bars = Math.min(2, s.chords.length - i);
      push({ step: at, durBeats: (bars * stepsPerBar) / 4, notes: [...s.drone], layer: "drone", part: "pad", vel: 0.3 * mv, nudgeMs: 0, minHeat: 0 });
    }

    if (on("bass")) {
      const fill = fb.last && score.bassFill !== undefined && rand() < 0.5;
      let hits = barHits(fill ? score.bassFill! : s.bass, i, stepsPerBar);
      if (thin) hits = thinBass(hits, stepsPerBar);
      else if (mood === "bright") hits = lightBass(hits);
      for (const h of hits) {
        const { note, anchor } = bassNote(chordAt(h.step), h.ch, prevBass, reg.bass);
        prevBass = anchor;
        push({ step: at + h.step, durBeats: h.len / 4, notes: [noteOf(note)], layer: "bass", part: "bass", vel: (h.step === 0 ? 0.62 : 0.5) * mv, nudgeMs: 0, minHeat: layerHeat("bass") });
      }
    }

    if (on("arp") && s.arp) {
      let hits = barHits(s.arp, i, stepsPerBar);
      if (thin) hits = hits.filter((h) => h.step % 2 === 0);
      for (const h of hits) {
        const chord = chordAt(h.step);
        prevArp = arpRoot(chord, prevArp, reg.arp);
        let notes: number[];
        if (h.ch === "*") notes = stackFrom(chord, prevArp).slice(0, 4);
        else if (score.arpSource === "scale") notes = [scaleLadder(scalePcs, reg.arp)[Number(h.ch)]];
        else {
          const tones = stackFrom(chord, prevArp);
          const idx = Number(h.ch);
          notes = [tones[idx % tones.length] + 12 * Math.floor(idx / tones.length)];
        }
        const accent = h.step % 4 === 0 ? 0.06 : 0;
        push({
          step: at + h.step,
          durBeats: Math.max(h.len / 4, 0.5),
          notes: notes.map(noteOf),
          layer: "arp",
          part: score.voices.arp,
          vel: clamp01((0.4 + accent + (rand() - 0.5) * 0.06) * mv),
          nudgeMs: round3((rand() - 0.5) * 6),
          minHeat: layerHeat("arp"),
        });
      }
    }

    const line = (layer: "melody" | "answer", text: string | undefined, part: Part, base: number) => {
      if (!text || !on(layer)) return;
      let pos = 0;
      for (const t of parseBarLine(text)!) {
        if (t.notes.length) {
          const step = at + pos * 4;
          const vel = clamp01((base + (pos === 0 ? 0.07 : 0) + (rand() - 0.5) * 0.08) * mv);
          const nudgeMs = round3((rand() - 0.5) * 12);
          const minHeat = layerHeat(layer);
          // Seeded ornament: now and then a long melody note is approached by a grace note.
          const grace = layer === "melody" && t.beats >= 1 && t.notes.length === 1 && rand() < 0.14 ? graceInto(t.notes[0], prevMelody, scalePcs) : null;
          if (grace) {
            push({ step, durBeats: 0.25, notes: [grace], layer, part, vel: vel * 0.6, nudgeMs, minHeat, grace: true });
            push({ step: step + 1, durBeats: t.beats - 0.25, notes: t.notes, layer, part, vel, nudgeMs, minHeat });
          } else {
            push({ step, durBeats: t.beats, notes: t.notes, layer, part, vel, nudgeMs, minHeat });
          }
          if (layer === "melody") prevMelody = midiOf(t.notes[t.notes.length - 1]);
        }
        pos += t.beats;
      }
    };
    line("melody", s.melody[i], score.voices.melody, 0.62);
    line("answer", s.answer?.[i], score.voices.answer, 0.48);

    if (on("sparkle")) {
      const slots = sparkleSlots(stepsPerBar).slice(0, sparkleCount(b, score.sparkle.perBar[mood]));
      for (const pos of slots) {
        const tones = stack(chordAt(pos), reg.sparkle);
        const note = tones[Math.floor(rand() * tones.length)];
        push({
          step: at + pos,
          durBeats: 0.5,
          notes: [noteOf(note)],
          layer: "sparkle",
          part: score.sparkle.voice === "drop" ? "drop" : "lead",
          vel: clamp01((0.2 + rand() * 0.12) * mv),
          nudgeMs: round3((rand() - 0.5) * 16),
          minHeat: layerHeat("sparkle"),
        });
      }
    }

    const groove = s.groove ? score.grooves?.[s.groove] : undefined;
    for (const dl of groove ?? []) {
      const layer: Layer = PERC_DRUMS.includes(dl.drum) ? "perc" : "drums";
      if (!on(layer)) continue;
      // Heat-gated lines belong to the Arcade; other moods play only the base groove.
      if (mood !== "driving" && (dl.minHeat ?? 0) > 0) continue;
      const minHeat = mood === "driving" ? Math.max(dl.minHeat ?? 0, layerHeat(layer)) : 0;
      for (const h of barHits(dl.pattern, i, stepsPerBar)) {
        push({ step: at + h.step, durBeats: 0.25, notes: dl.note ? [dl.note] : [], layer, part: DRUM_PART[dl.drum], drum: dl.drum, vel: (HIT_VEL[h.ch] ?? 0.72) * mv, nudgeMs: 0, minHeat });
      }
    }
  });

  // Mono parts: one event per step (the most essential wins), each ending before the next starts.
  const kept: PlannedEvent[] = [];
  const mono = new Map<Part, PlannedEvent[]>();
  for (const e of events) {
    if (!isMonoPart(score, e.part)) kept.push(e);
    else mono.set(e.part, [...(mono.get(e.part) ?? []), e]);
  }
  for (const list of mono.values()) {
    list.sort((a, b) => a.step - b.step || a.minHeat - b.minHeat || b.vel - a.vel);
    const unique = list.filter((e, k) => k === 0 || list[k - 1].step !== e.step);
    unique.forEach((e, k) => {
      const next = unique[k + 1];
      if (next) e.durBeats = round3(Math.min(e.durBeats, (next.step - e.step) / 4 - 0.05));
      kept.push(e);
    });
  }
  kept.sort((a, b) => a.step - b.step);

  return { bpm, heatBpm: score.heatBpm, meter: score.meter, stepsPerBar, bars: form.length, steps, passSecs: (form.length * score.meter * 60) / bpm, swing: score.swing, events: kept };
}
