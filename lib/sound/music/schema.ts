// A world theme as data. The five JSON scores beside this schema were composed
// by Claude Code as original work (Music brief, docs/plan/HANDOFF.md); the
// first drafts were Muse Code's. No Tone.js here, so scores stay unit-tested
// and safe to import on the server.
//
// A score is a short song form: named sections (A, B, ...) of 4–8 bars, each
// with its own chord progression, a written melody, an optional answering
// line, and step patterns for bass, arpeggio, pad and drums. The form strings
// the sections into 16–32 bars, so a theme runs 45 s or more before it
// repeats, and the planner adds seeded ornaments on every pass.
import { z } from "zod";
import { barBeats, parseBarLine, parseChord, patternSteps, pitchClass } from "./theory";

export const PACK_IDS = ["dreamlight", "anime-sky", "toon-pop", "idol-stage", "terrarium"] as const;
export type ThemePack = (typeof PACK_IDS)[number];

export const MOODS = ["calm", "dreamy", "bright", "driving"] as const;
export type ThemeMood = (typeof MOODS)[number];

export const LAYERS = ["melody", "answer", "pad", "drone", "bass", "arp", "sparkle", "perc", "drums"] as const;
export type Layer = (typeof LAYERS)[number];

/** Drum kinds. Blocks and shakers are the "perc" layer and may play in any mood; the rest are "drums". */
export const DRUMS = ["kick", "snare", "clap", "hat", "shaker", "block"] as const;
export type DrumKind = (typeof DRUMS)[number];
export const PERC_DRUMS: readonly DrumKind[] = ["block", "shaker"];

/** e.g. C4, F#5, Bb3. */
export const NoteName = z.string().regex(/^[A-G](?:#|b)?[0-8]$/);

const BpmMap = z.object({
  calm: z.number().min(60).max(80),
  dreamy: z.number().min(50).max(80),
  bright: z.number().min(80).max(110),
  driving: z.number().min(100).max(130),
});

const PerMood = z.object({
  calm: z.number().min(0).max(4),
  dreamy: z.number().min(0).max(4),
  bright: z.number().min(0).max(4),
  driving: z.number().min(0).max(4),
});

const Voice = z.enum(["lead", "counter"]);

/** One drum line: a step pattern of X (accent), x (normal), o (soft) and . (rest). */
const DrumLine = z.object({
  drum: z.enum(DRUMS),
  pattern: z.string().regex(/^[Xxo.\s|]+$/),
  /** Pitch for wood blocks. */
  note: NoteName.optional(),
  /** In the driving mood, the line waits until the Arcade heat reaches this. */
  minHeat: z.number().min(0).max(1).optional(),
});

const Section = z.object({
  /** One entry per bar; "Dm9 G7sus4" splits a bar between two chords. */
  chords: z.array(z.string()).min(4).max(8),
  /** One bar line per bar, e.g. "G5:1.5 B5:0.5 D6:1". */
  melody: z.array(z.string()),
  /** An answering line (call and response, echoes), one bar line per bar. */
  answer: z.array(z.string()).optional(),
  /** Bass steps: 1 root (or slash bass), 3 5 6 7 chord degrees, 8 octave, 2 and 4 passing, "." rest, "-" hold. */
  bass: z.string().regex(/^[1-8.\-\s|]+$/),
  /** Arpeggio steps: 0-9 index into the chord (or scale), "*" the whole chord, "." rest, "-" hold. */
  arp: z.string().regex(/^[0-9*.\-\s|]+$/).optional(),
  /** Pad steps: "*" strikes the chord, "-" holds, "." rests. Defaults to one held chord per bar. */
  pad: z.string().regex(/^[*.\-\s|]+$/).optional(),
  /** Drone notes, struck every two bars (Terrarium's pond hum). */
  drone: z.array(NoteName).min(1).max(3).optional(),
  /** Name of the groove (drum lines) this section uses. */
  groove: z.string().optional(),
});
export type ThemeSection = z.infer<typeof Section>;

export const ThemeScore = z
  .object({
    pack: z.enum(PACK_IDS),
    title: z.string().min(1).max(60),
    composer: z.string().min(1).max(60),
    key: z.string().min(1).max(24),
    /** The key's scale as pitch-class names; grace notes and the "scale" arpeggio use it. */
    scale: z.array(z.string().regex(/^[A-G](?:#|b)?$/)).min(5).max(7),
    /** Beats per bar. */
    meter: z.union([z.literal(3), z.literal(4)]),
    bpm: BpmMap,
    /** BPM the Arcade adds at full heat (driving mood only). */
    heatBpm: z.number().min(0).max(12),
    /** 0 straight to 0.6 (near triplet): how late the off-beat eighths land. */
    swing: z.number().min(0).max(0.6),
    /** The answering voice glides like a slide whistle (it is then monophonic). */
    glide: z.boolean().optional(),
    /** Centre notes each part is voiced around. */
    register: z.object({ pad: NoteName, bass: NoteName, arp: NoteName, sparkle: NoteName }),
    /** Which session instrument plays each written line. */
    voices: z.object({ melody: Voice, arp: Voice, answer: Voice }),
    /** The arpeggio indexes the bar's chord or the key's scale. */
    arpSource: z.enum(["chord", "scale"]),
    /** Seeded sparkle: which voice, and how many notes per bar on average in each mood. */
    sparkle: z.object({ voice: z.enum(["lead", "drop"]), perBar: PerMood }),
    /** A bass pattern the planner may swap in on a section's last bar. */
    bassFill: z.string().regex(/^[1-8.\-\s|]+$/).optional(),
    sections: z.record(z.string().regex(/^[A-Z][0-9]?$/), Section),
    /** Section names in order; the whole form loops. */
    form: z.array(z.string()).min(2).max(8),
    grooves: z.record(z.string(), z.array(DrumLine).min(1).max(8)).optional(),
    /** Which layers play in each mood. Melody always plays calm and dreamy; drums only when driving. */
    layers: z.partialRecord(z.enum(LAYERS), z.array(z.enum(MOODS)).nonempty()),
    /** In the driving mood, a layer waits until the Arcade heat reaches this. */
    heat: z.partialRecord(z.enum(LAYERS), z.number().min(0).max(1)).optional(),
  })
  .superRefine((score, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const stepsPerBar = score.meter * 4;
    const checkPattern = (name: string, p: string | undefined) => {
      if (p !== undefined && patternSteps(p).length % stepsPerBar !== 0) issue(`${name} pattern is not whole bars of ${stepsPerBar} steps`);
    };
    for (const pc of score.scale) if (pitchClass(pc) === null) issue(`scale has unknown pitch class "${pc}"`);
    checkPattern("bassFill", score.bassFill);

    let bars = 0;
    for (const name of score.form) {
      const section = score.sections[name];
      if (!section) issue(`form names unknown section "${name}"`);
      else bars += section.chords.length;
    }
    if (bars < 16 || bars > 32) issue(`form is ${bars} bars; it must be 16–32`);
    const progressions = new Set(score.form.filter((n) => score.sections[n]).map((n) => score.sections[n].chords.join(" | ")));
    if (progressions.size < 2) issue("the form needs at least two sections with their own progressions");

    for (const [name, s] of Object.entries(score.sections)) {
      const n = s.chords.length;
      if (s.melody.length !== n) issue(`section ${name}: melody needs one bar line per chord bar`);
      if (s.answer && s.answer.length !== n) issue(`section ${name}: answer needs one bar line per chord bar`);
      s.chords.forEach((bar, i) => {
        const symbols = bar.trim().split(/\s+/);
        if (symbols.length > 2 || stepsPerBar % symbols.length !== 0) issue(`section ${name} bar ${i + 1}: one or two chords per bar`);
        for (const sym of symbols) if (!parseChord(sym)) issue(`section ${name} bar ${i + 1}: unknown chord "${sym}"`);
      });
      for (const [kind, lines] of [["melody", s.melody], ["answer", s.answer ?? []]] as const) {
        lines.forEach((line, i) => {
          const tokens = parseBarLine(line);
          if (!tokens) issue(`section ${name} ${kind} bar ${i + 1}: cannot read "${line}"`);
          else if (Math.abs(barBeats(tokens) - score.meter) > 1e-9) issue(`section ${name} ${kind} bar ${i + 1} fills ${barBeats(tokens)} beats, not ${score.meter}`);
        });
      }
      checkPattern(`section ${name} bass`, s.bass);
      checkPattern(`section ${name} arp`, s.arp);
      checkPattern(`section ${name} pad`, s.pad);
      if (s.groove && !score.grooves?.[s.groove]) issue(`section ${name} names unknown groove "${s.groove}"`);
    }
    for (const [name, lines] of Object.entries(score.grooves ?? {})) {
      for (const line of lines) checkPattern(`groove ${name} ${line.drum}`, line.pattern);
    }

    const melody = score.layers.melody ?? [];
    if (!melody.includes("calm") || !melody.includes("dreamy")) issue("melody must play in calm and dreamy moods");
    if ((score.layers.drums ?? []).some((m) => m !== "driving")) issue("drums only play when driving");
    if ((score.layers.perc ?? []).includes("calm")) issue("learning (calm) has no percussion");
    if (score.glide && score.voices.arp === "counter") issue("a gliding answer voice is monophonic, so the arpeggio cannot share it");
  });

export type ThemeScore = z.infer<typeof ThemeScore>;
