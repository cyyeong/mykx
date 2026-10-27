// A world theme as data: five JSON scores live beside this schema, composed by
// Muse Code as original work (see the Music brief in docs/plan/HANDOFF.md).
// No Tone.js here, so scores stay unit-tested and safe to import on the server.
import { z } from "zod";

export const PACK_IDS = ["dreamlight", "anime-sky", "toon-pop", "idol-stage", "terrarium"] as const;
export type ThemePack = (typeof PACK_IDS)[number];

export const MOODS = ["calm", "dreamy", "bright", "driving"] as const;
export type ThemeMood = (typeof MOODS)[number];

/** e.g. C4, F#5, Bb3. */
export const NoteName = z.string().regex(/^[A-G](?:#|b)?[0-8]$/);

const BpmMap = z.object({
  calm: z.number().min(60).max(80),
  dreamy: z.number().min(50).max(80),
  bright: z.number().min(80).max(110),
  driving: z.number().min(100).max(130),
});

/**
 * One melody step: an index into the bar's chord tones (0 = root), so a motif
 * always lands on chord tones no matter which bar of the loop it plays over.
 */
const MotifStep = z.object({
  tone: z.number().int().min(0).max(4),
  /** Beats this step lasts; a motif must fill exactly one 4/4 bar. */
  len: z.number().min(0.25).max(4),
  /** Lift this step an octave for sparkle. */
  up: z.boolean().optional(),
});

const LayerName = z.enum(["pad", "melody", "bass", "pulse", "sparkle", "drums"]);

export const ThemeScore = z
  .object({
    pack: z.enum(PACK_IDS),
    title: z.string().min(1).max(60),
    composer: z.string().min(1).max(60),
    key: z.string().min(1).max(8),
    bpm: BpmMap,
    /** Bars per loop; chords, bass and form each hold exactly one entry per bar. */
    bars: z.number().int().min(2).max(8),
    chords: z.array(z.array(NoteName).min(3).max(5)).min(2).max(8),
    bass: z.array(NoteName).min(2).max(8),
    motifs: z.record(z.string(), z.array(MotifStep).min(1).max(16)),
    /** One motif name per bar. */
    form: z.array(z.string()).min(2).max(8),
    /** Which layers play in each mood. Melody always plays; drums only when driving. */
    layers: z.record(LayerName, z.array(z.enum(MOODS)).nonempty()),
  })
  .superRefine((score, ctx) => {
    if (score.chords.length !== score.bars || score.bass.length !== score.bars || score.form.length !== score.bars) {
      ctx.addIssue({ code: "custom", message: "chords, bass and form must each hold one entry per bar" });
    }
    for (const [name, steps] of Object.entries(score.motifs)) {
      const total = steps.reduce((sum, s) => sum + s.len, 0);
      if (Math.abs(total - 4) > 1e-9) ctx.addIssue({ code: "custom", message: `motif "${name}" fills ${total} beats, not one 4/4 bar` });
    }
    for (const name of score.form) {
      if (!score.motifs[name]) ctx.addIssue({ code: "custom", message: `form names unknown motif "${name}"` });
    }
    if (!score.layers.melody.includes("calm") || !score.layers.melody.includes("dreamy")) {
      ctx.addIssue({ code: "custom", message: "melody must play in calm and dreamy moods" });
    }
    if (score.layers.drums.some((m) => m !== "driving")) {
      ctx.addIssue({ code: "custom", message: "drums only play when driving" });
    }
  });

export type ThemeScore = z.infer<typeof ThemeScore>;
