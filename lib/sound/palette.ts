// Pure sound design data: which instrument each pack plays and what every event sounds like.
// No Tone.js here, so it is unit-tested and safe to import on the server.
import type { Band, PackId } from "@/components/theme/packs";

/** Every UI sound. There is deliberately no "wrong answer" sound (design skill §6a). */
export const SOUND_EVENTS = ["tap", "packPick", "correct", "hint", "reward", "transform", "flip", "pipGrows"] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

export type Voice = "bell" | "glock" | "marimba" | "pluck" | "kalimba";
export type Flourish = "chimes" | "sparkle" | "boing" | "claps" | "croak";
export type Ambience = "night-breeze" | "wind-birds" | "stage-pulse" | "rain-crickets";
export type Effect = "whoosh" | "swish" | "bloop";
/** Living-scene props (lamps, drawers, ponds, crystals): cosmetic only, never tied to rewards. */
export const PROP_SOUNDS = ["click", "creak", "tink", "splash", "croak", "chime", "pop", "flutter", "knock", "rustle", "beat"] as const;
export type PropSound = (typeof PROP_SOUNDS)[number];

export type PackSound = {
  voice: Voice;
  /** Pentatonic, low to high; events pick from it so every pack stays in tune with itself. */
  scale: readonly string[];
  /** The pack's signature chord, played when the pack is picked. */
  chord: readonly string[];
  /** Reverb wet level, 0–1. */
  reverb: number;
  /** A pack-specific colour added to rewards. */
  flourish: Flourish;
  ambience: Ambience | null;
  ambienceLabel: string | null;
};

export const PACK_SOUNDS: Record<PackId, PackSound> = {
  dreamlight: {
    voice: "bell",
    scale: ["C5", "D5", "E5", "G5", "A5", "C6", "D6"],
    chord: ["C5", "E5", "G5", "B5"],
    reverb: 0.45,
    flourish: "chimes",
    ambience: "night-breeze",
    ambienceLabel: "Night breeze",
  },
  "anime-sky": {
    voice: "glock",
    scale: ["F5", "G5", "A5", "C6", "D6", "F6", "G6"],
    chord: ["F5", "A5", "C6", "G6"],
    reverb: 0.3,
    flourish: "sparkle",
    ambience: "wind-birds",
    ambienceLabel: "Wind and birds",
  },
  "toon-pop": {
    voice: "marimba",
    scale: ["C4", "D4", "E4", "G4", "A4", "C5", "D5"],
    chord: ["C4", "E4", "G4", "C5"],
    reverb: 0.12,
    flourish: "boing",
    ambience: null,
    ambienceLabel: null,
  },
  "idol-stage": {
    voice: "pluck",
    scale: ["A4", "C5", "D5", "E5", "G5", "A5", "C6"],
    chord: ["A4", "C5", "E5", "B5"],
    reverb: 0.25,
    flourish: "claps",
    ambience: "stage-pulse",
    ambienceLabel: "Stage pulse",
  },
  terrarium: {
    voice: "kalimba",
    scale: ["D5", "E5", "F#5", "A5", "B5", "D6", "E6"],
    chord: ["D5", "A5", "E6"],
    reverb: 0.3,
    flourish: "croak",
    ambience: "rain-crickets",
    ambienceLabel: "Rain and crickets",
  },
};

/** One note in a plan; `at` and `dur` are seconds from the event, `vel` is 0–1. */
export type PlannedNote = { note: string; at: number; dur: number; vel: number };

export type SoundPlan = {
  notes: PlannedNote[];
  /** A non-melodic layer the engine synthesises (noise sweep, swish, pitch bloop). */
  effect?: { kind: Effect; at: number; dur: number };
  /** The pack flourish, if this event uses it. */
  flourish?: { kind: Flourish; at: number };
};

const step = (scale: readonly string[], i: number) => scale[Math.min(i, scale.length - 1)];

/** What `event` sounds like in `pack`. Deterministic, so it can be tested and cached. */
export function planFor(pack: PackId, event: SoundEvent): SoundPlan {
  const { scale, chord } = PACK_SOUNDS[pack];
  switch (event) {
    case "tap":
      return { notes: [{ note: step(scale, 4), at: 0, dur: 0.06, vel: 0.3 }] };
    case "packPick":
      return { notes: chord.map((note, i) => ({ note, at: i * 0.035, dur: 0.45, vel: 0.55 })) };
    case "correct":
      return { notes: [0, 2, 4].map((n, i) => ({ note: step(scale, n), at: i * 0.09, dur: 0.16, vel: 0.65 })) };
    case "hint":
      return {
        notes: [
          { note: step(scale, 2), at: 0, dur: 0.22, vel: 0.4 },
          { note: step(scale, 3), at: 0.17, dur: 0.26, vel: 0.4 },
        ],
      };
    case "reward":
      return {
        notes: [0, 1, 2, 3, 4, 5, 6].map((n, i) => ({ note: step(scale, n), at: i * 0.055, dur: 0.18, vel: 0.5 })),
        flourish: { kind: PACK_SOUNDS[pack].flourish, at: 0.3 },
      };
    case "transform":
      return {
        effect: { kind: "whoosh", at: 0, dur: 2 },
        notes: chord.map((note, i) => ({ note, at: 2 + i * 0.05, dur: 0.6, vel: 0.6 })),
      };
    case "flip":
      return { notes: [], effect: { kind: "swish", at: 0, dur: 0.18 } };
    case "pipGrows":
      return {
        effect: { kind: "bloop", at: 0, dur: 0.2 },
        notes: [{ note: step(scale, 5), at: 0.22, dur: 0.3, vel: 0.5 }],
      };
  }
}

/** Seconds from the start of an event to the end of its last sound. */
export function planLength(plan: SoundPlan): number {
  const ends = plan.notes.map((n) => n.at + n.dur);
  if (plan.effect) ends.push(plan.effect.at + plan.effect.dur);
  if (plan.flourish) ends.push(plan.flourish.at + 0.25);
  return ends.length ? Math.max(...ends) : 0;
}

/** Sound effects start on for Junior and off for Teen; ambience always starts off (design skill §6a). */
export function defaultSoundOn(band: Band): boolean {
  return band === "junior";
}
