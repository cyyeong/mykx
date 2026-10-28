// Small, pure music theory for the theme scores: note names, chord symbols,
// bar lines ("E5:1.5 G5:0.5 r:2") and 16th-step patterns ("1-..5-..").
// No Tone.js here, so the schema, planner and tests share one definition.

const PC: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Pitch class of a bare name ("Bb" → 10), or null. */
export function pitchClass(name: string): number | null {
  return name in PC ? PC[name] : null;
}

/** MIDI number of a note name ("C4" → 60), or null. */
export function midiOf(note: string): number | null {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!m || !(m[1] in PC)) return null;
  return PC[m[1]] + (Number(m[2]) + 1) * 12;
}

/** Note name for a MIDI number, spelled with sharps (Tone reads either spelling). */
export function noteOf(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** The pitch with class `pc` nearest to `target` (ties go down). */
export function nearest(pc: number, target: number): number {
  const below = target - ((((target - pc) % 12) + 12) % 12);
  return target - below <= below + 12 - target ? below : below + 12;
}

/** Chord qualities as stacked intervals above the root (root, third, fifth, seventh, ninth). */
const QUALITIES: Record<string, readonly number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "5": [0, 7, 12],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "69": [0, 4, 7, 9, 14],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  "9": [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
};

export type Chord = {
  symbol: string;
  /** Root pitch class. */
  root: number;
  /** Stacked intervals above the root, lowest first. */
  tones: readonly number[];
  /** Pitch class the bass plays (the slash note, or the root). */
  bass: number;
};

/** Parses "Cmaj9", "G/B", "D9/F#", "Ebmaj7" and friends; null for anything else. */
export function parseChord(symbol: string): Chord | null {
  const m = /^([A-G](?:#|b)?)([a-z0-9#]*)(?:\/([A-G](?:#|b)?))?$/.exec(symbol);
  if (!m) return null;
  const root = pitchClass(m[1]);
  const tones = QUALITIES[m[2]];
  if (root === null || !tones) return null;
  const bass = m[3] ? pitchClass(m[3]) : root;
  if (bass === null) return null;
  return { symbol, root, tones, bass };
}

/** The chord's pitch classes, including a slash bass. */
export function chordPcs(chord: Chord): Set<number> {
  const pcs = new Set(chord.tones.map((i) => (chord.root + i) % 12));
  pcs.add(chord.bass);
  return pcs;
}

/** One bar-line token: notes (empty for a rest) held for `beats`. */
export type BarToken = { notes: string[]; beats: number };

/**
 * Parses a bar of melody: space-separated `note:beats` tokens, where note is
 * a name ("E5"), a dyad ("C6+E6") or "r" for a rest. Beats sit on the 16th
 * grid (multiples of 0.25). Returns null when anything is malformed.
 */
export function parseBarLine(line: string): BarToken[] | null {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const out: BarToken[] = [];
  for (const t of tokens) {
    const m = /^([^:]+):(\d+(?:\.\d+)?)$/.exec(t);
    if (!m) return null;
    const beats = Number(m[2]);
    if (!(beats > 0) || Math.abs(beats * 4 - Math.round(beats * 4)) > 1e-9) return null;
    const notes = m[1] === "r" ? [] : m[1].split("+");
    if (notes.some((n) => midiOf(n) === null)) return null;
    out.push({ notes, beats });
  }
  return out;
}

/** Total beats of a parsed bar. */
export function barBeats(tokens: BarToken[]): number {
  return tokens.reduce((sum, t) => sum + t.beats, 0);
}

/** A step pattern with readability spaces and bar pipes removed. */
export function patternSteps(pattern: string): string {
  return pattern.replace(/[\s|]/g, "");
}

/** One hit in a step pattern: the char that starts it and how many steps it holds. */
export type Hit = { step: number; len: number; ch: string };

/**
 * The hits of one bar of a step pattern. Each char is a 16th; "." rests and
 * "-" holds the previous hit. Patterns longer than a bar cycle by bar index.
 */
export function barHits(pattern: string, barIndex: number, stepsPerBar: number): Hit[] {
  const steps = patternSteps(pattern);
  if (!steps.length) return [];
  const offset = (barIndex * stepsPerBar) % steps.length;
  const bar = steps.slice(offset, offset + stepsPerBar);
  const hits: Hit[] = [];
  let holding = false;
  for (let s = 0; s < bar.length; s++) {
    const ch = bar[s];
    if (ch === "-") {
      if (holding) hits[hits.length - 1].len++;
    } else if (ch === ".") {
      holding = false;
    } else {
      hits.push({ step: s, len: 1, ch });
      holding = true;
    }
  }
  return hits;
}
