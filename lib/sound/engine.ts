// Browser-only sound engine on Tone.js. Loaded with a dynamic import after the first tap
// (browsers block audio before a user gesture), so Tone never ships in the first page load.
import * as Tone from "tone";
import type { PackId } from "@/components/theme/packs";
import { type Ambience, type Effect, type Flourish, type PropSound, type SoundEvent, type Voice, PACK_SOUNDS, defaultBeatOn, planFor } from "./palette";
import { THEMES } from "./music";
import { BEAT_PARTS, planPass, type Part, type PassPlan, type PlannedEvent } from "./music/plan";
import type { ThemeMood, ThemeScore } from "./music/schema";

const MASTER_DB = -12;
/** The music bed sits well under the effects (Music brief). */
const MUSIC_DB = -24;
const DUCK_DB = -10;
/** Seconds: a theme fades in, two themes crossfade, and the music fades out when stopped. */
const FADE_IN = 1.5;
const CROSSFADE = 1.5;
const FADE_OUT = 0.8;

let started = false;
const voices = new Map<PackId, { synth: Tone.PolySynth; reverb: Tone.Freeverb }>();
let ambience: { pack: PackId; stop: () => void } | null = null;

/** The Transport clocks the music; it runs while anyone holds it. */
const transportHolds = new Set<string>();
function holdTransport(id: string) {
  transportHolds.add(id);
  if (Tone.getTransport().state !== "started") Tone.getTransport().start();
}
function releaseTransport(id: string) {
  transportHolds.delete(id);
  if (transportHolds.size === 0) Tone.getTransport().stop();
}

/** Starts the audio context. Call from (or right after) a user gesture. */
export async function start(): Promise<void> {
  if (started) return;
  const resumed = Tone.start(); // must be called inside the user gesture on iOS Safari
  Tone.getDestination().volume.value = MASTER_DB;
  started = true; // notes scheduled now play as soon as the context is running
  await resumed;
}

export function setMuted(muted: boolean): void {
  Tone.getDestination().mute = muted;
}

function makeVoice(voice: Voice): Tone.PolySynth {
  switch (voice) {
    case "bell": // music box / celesta
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 12,
        envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.6 },
        modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 },
      });
    case "glock":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.4 },
      });
    case "marimba":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
      });
    case "pluck": // synth pluck
      return new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "sawtooth" },
        filter: { Q: 2, type: "lowpass" },
        filterEnvelope: { attack: 0.001, decay: 0.15, sustain: 0, baseFrequency: 300, octaves: 3 },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.15 },
      });
    case "kalimba":
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 8,
        modulationIndex: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
        modulationEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      });
  }
}

function voiceFor(pack: PackId): Tone.PolySynth {
  let v = voices.get(pack);
  if (!v) {
    const reverb = new Tone.Freeverb({ roomSize: 0.7, wet: PACK_SOUNDS[pack].reverb }).toDestination();
    const synth = makeVoice(PACK_SOUNDS[pack].voice).connect(reverb);
    synth.volume.value = -6;
    v = { synth, reverb };
    voices.set(pack, v);
  }
  return v.synth;
}

/** One-shot nodes are disposed shortly after they finish so nothing leaks. */
function disposeAfter(seconds: number, ...nodes: { dispose: () => unknown }[]) {
  setTimeout(() => nodes.forEach((n) => n.dispose()), (seconds + 0.5) * 1000);
}

function playEffect(kind: Effect, when: number, dur: number) {
  if (kind === "whoosh") {
    const filter = new Tone.Filter(300, "lowpass").toDestination();
    const noise = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: dur * 0.8, decay: dur * 0.2, sustain: 0, release: 0.1 } }).connect(filter);
    noise.volume.value = -14;
    filter.frequency.setValueAtTime(300, when);
    filter.frequency.exponentialRampToValueAtTime(6000, when + dur);
    noise.triggerAttackRelease(dur, when);
    disposeAfter(dur, noise, filter);
  } else if (kind === "swish") {
    const filter = new Tone.Filter(2200, "bandpass").toDestination();
    const noise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.005, decay: dur, sustain: 0, release: 0.05 } }).connect(filter);
    noise.volume.value = -18;
    noise.triggerAttackRelease(dur, when);
    disposeAfter(dur, noise, filter);
  } else {
    const synth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: dur, sustain: 0, release: 0.05 } }).toDestination();
    synth.volume.value = -8;
    synth.triggerAttack("G3", when);
    synth.frequency.exponentialRampToValueAtTime("G4", when + dur);
    synth.triggerRelease(when + dur);
    disposeAfter(dur, synth);
  }
}

function playFlourish(kind: Flourish, pack: PackId, when: number) {
  const top = PACK_SOUNDS[pack].scale.at(-1) ?? "C6";
  if (kind === "chimes" || kind === "sparkle") {
    voiceFor(pack).triggerAttackRelease([top], 0.25, when, 0.35);
    voiceFor(pack).triggerAttackRelease([top], 0.25, when + 0.08, 0.25);
  } else if (kind === "boing") {
    const s = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.25, sustain: 0, release: 0.05 } }).toDestination();
    s.volume.value = -10;
    s.triggerAttack("C4", when);
    s.frequency.exponentialRampToValueAtTime("C5", when + 0.12);
    s.frequency.exponentialRampToValueAtTime("G4", when + 0.25);
    s.triggerRelease(when + 0.25);
    disposeAfter(0.3, s);
  } else if (kind === "claps") {
    const clap = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 } }).toDestination();
    clap.volume.value = -16;
    clap.triggerAttackRelease(0.08, when);
    clap.triggerAttackRelease(0.08, when + 0.12);
    disposeAfter(0.3, clap);
  } else {
    // Frog croak: a low FM burp.
    const croak = new Tone.FMSynth({ harmonicity: 0.5, modulationIndex: 18, envelope: { attack: 0.01, decay: 0.18, sustain: 0, release: 0.05 } }).toDestination();
    croak.volume.value = -12;
    croak.triggerAttackRelease("E2", 0.18, when);
    disposeAfter(0.3, croak);
  }
}

/** Plays a UI sound for `pack`. Safe to call before `start()` resolves: it just stays silent. */
export function play(pack: PackId, event: SoundEvent): void {
  if (!started) return;
  const plan = planFor(pack, event);
  const t0 = Tone.now() + 0.02;
  const synth = voiceFor(pack);
  for (const n of plan.notes) synth.triggerAttackRelease([n.note], n.dur, t0 + n.at, n.vel);
  if (plan.effect) playEffect(plan.effect.kind, t0 + plan.effect.at, plan.effect.dur);
  if (plan.flourish) playFlourish(plan.flourish.kind, pack, t0 + plan.flourish.at);
}

function noiseHit(type: "white" | "pink" | "brown", filterType: BiquadFilterType, freq: number, dur: number, db: number, when: number) {
  const filter = new Tone.Filter(freq, filterType).toDestination();
  const noise = new Tone.NoiseSynth({ noise: { type }, envelope: { attack: 0.002, decay: dur, sustain: 0, release: 0.03 } }).connect(filter);
  noise.volume.value = db;
  noise.triggerAttackRelease(dur, when);
  disposeAfter(dur, noise, filter);
  return filter;
}

function blip(from: string, to: string, dur: number, db: number, when: number, type: "sine" | "triangle" = "sine") {
  const s = new Tone.Synth({ oscillator: { type }, envelope: { attack: 0.003, decay: dur, sustain: 0, release: 0.04 } }).toDestination();
  s.volume.value = db;
  s.triggerAttack(from, when);
  s.frequency.exponentialRampToValueAtTime(to, when + dur);
  s.triggerRelease(when + dur);
  disposeAfter(dur, s);
}

/**
 * A living-scene prop sound for `pack`. `step` picks a note of the pack's scale (chimes),
 * `vary` (0-1) nudges pitch and timing so the same prop never sounds exactly the same twice.
 */
export function prop(pack: PackId, kind: PropSound, step = 0, vary = Math.random()): void {
  if (!started) return;
  const t = Tone.now() + 0.02;
  const scale = PACK_SOUNDS[pack].scale;
  const cents = Math.round((vary - 0.5) * 120);
  const at = (note: string) => Tone.Frequency(note).transpose(cents / 100).toNote();
  switch (kind) {
    case "click": // a lamp switch: tick, then a soft thump
      noiseHit("white", "highpass", 3000, 0.02, -20, t);
      blip("A2", "E2", 0.08, -16, t + 0.015);
      break;
    case "creak": { // a wooden drawer sliding
      const f = noiseHit("brown", "bandpass", 500 + vary * 300, 0.32, -10, t);
      f.frequency.setValueAtTime(400 + vary * 200, t);
      f.frequency.linearRampToValueAtTime(900 + vary * 300, t + 0.3);
      blip("D3", "C3", 0.06, -18, t + 0.3, "triangle");
      break;
    }
    case "tink": // glass
      blip(at("E7"), at("E7"), 0.5, -20, t, "triangle");
      blip(at("B7"), at("B7"), 0.3, -26, t + 0.01, "sine");
      break;
    case "splash":
      noiseHit("pink", "lowpass", 1800, 0.22, -14, t);
      blip(at("C4"), at("G4"), 0.12, -14, t + 0.05);
      blip(at("E4"), at("B4"), 0.1, -18, t + 0.16 + vary * 0.06);
      break;
    case "croak": {
      const croak = new Tone.FMSynth({ harmonicity: 0.5, modulationIndex: 14 + vary * 8, envelope: { attack: 0.01, decay: 0.16, sustain: 0, release: 0.05 } }).toDestination();
      croak.volume.value = -12;
      croak.triggerAttackRelease(at("E2"), 0.16, t);
      if (vary > 0.5) croak.triggerAttackRelease(at("D2"), 0.14, t + 0.24);
      disposeAfter(0.6, croak);
      break;
    }
    case "chime": // crystals and lanterns play the pack's scale, so taps make tunes
      voiceFor(pack).triggerAttackRelease([scale[((step % scale.length) + scale.length) % scale.length]], 0.4, t, 0.45);
      break;
    case "pop":
      blip(at("C6"), at("C5"), 0.06, -14, t);
      noiseHit("white", "bandpass", 4000, 0.04, -24, t);
      break;
    case "flutter":
      for (let i = 0; i < 4; i++) noiseHit("white", "bandpass", 1800 + i * 200, 0.04, -24, t + i * (0.07 + vary * 0.03));
      break;
    case "knock":
      blip("G2", "D2", 0.09, -8, t, "sine");
      blip("G2", "D2", 0.09, -10, t + 0.17 + vary * 0.05, "sine");
      if (vary > 0.6) blip("G2", "D2", 0.09, -12, t + 0.36, "sine");
      break;
    case "rustle":
      noiseHit("pink", "bandpass", 2600 + vary * 1200, 0.25, -20, t);
      noiseHit("pink", "bandpass", 3400, 0.18, -24, t + 0.12);
      break;
    case "beat": { // two bars of a soft lo-fi loop: kick, hat, a warm chord
      const kick = new Tone.MembraneSynth({ envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } }).toDestination();
      kick.volume.value = -14;
      const bar = 60 / 78; // 78 bpm, one beat
      const chords = [["D4", "F4", "A4", "C5"], ["G3", "B3", "D4", "F4"]];
      // A mono synth needs its notes in time order.
      for (const beat of [0, 2.75, 4, 6.75]) kick.triggerAttackRelease("C1", 0.2, t + beat * bar);
      for (let i = 0; i < 8; i++) noiseHit("white", "highpass", 7000, 0.03, -28, t + i * bar + bar / 2);
      chords.forEach((c, i) => voiceFor(pack).triggerAttackRelease(c, bar * 3.5, t + i * 4 * bar, 0.2));
      disposeAfter(8 * bar, kick);
      break;
    }
  }
}

/** Random wait between `min` and `max` seconds. */
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * An ambience bed: texture only (noise beds, crickets, birdsong). It never plays
 * pitched notes or a beat, so an idle screen never "hits notes" off the music's
 * key and grid; the composed theme owns melody and rhythm.
 */
function startAmbience(kind: Ambience): () => void {
  const nodes: { dispose: () => unknown }[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const out = new Tone.Gain(0).toDestination();
  out.gain.rampTo(Tone.dbToGain(-6), 1.2); // fade in, so a bed never clicks on
  nodes.push(out);

  // A soft noise bed; `sweep` drifts its filter slowly, like moving air.
  const bed = (type: "pink" | "brown", cutoff: number, db: number, sweep = false, filterType: BiquadFilterType = "lowpass") => {
    const filter = sweep ? new Tone.AutoFilter({ frequency: 0.07, baseFrequency: cutoff / 3, octaves: 2 }).start() : new Tone.Filter(cutoff, filterType);
    filter.connect(out);
    const noise = new Tone.Noise(type).connect(filter);
    noise.volume.value = db;
    noise.start();
    nodes.push(noise, filter);
  };
  // Repeats `fn` at random gaps until stopped (insects and birds keep their own time).
  const every = (min: number, max: number, fn: () => void) => {
    const tick = () => {
      fn();
      timers.push(setTimeout(tick, rand(min, max) * 1000));
    };
    timers.push(setTimeout(tick, rand(min, max) * 1000));
  };

  if (kind === "rain-crickets") {
    bed("pink", 1400, -30);
    bed("pink", 5200, -40, false, "highpass"); // the hiss of rain on leaves
    const cricket = new Tone.FMSynth({ harmonicity: 1.5, modulationIndex: 4, envelope: { attack: 0.005, decay: 0.04, sustain: 0, release: 0.02 } }).connect(out);
    cricket.volume.value = -32;
    nodes.push(cricket);
    every(0.8, 1.6, () => {
      const t = Tone.now();
      for (let i = 0; i < 3; i++) cricket.triggerAttackRelease("A6", 0.04, t + i * 0.07);
    });
  } else if (kind === "night-breeze") {
    bed("brown", 900, -26, true);
    bed("pink", 3000, -40, true); // a faint, airy top
  } else if (kind === "wind-birds") {
    bed("pink", 1800, -32, true);
    const bird = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.03 } }).connect(out);
    bird.volume.value = -28;
    nodes.push(bird);
    every(2.5, 5, () => {
      const t = Tone.now();
      bird.triggerAttack(rand(2000, 2600), t);
      bird.frequency.exponentialRampToValueAtTime(rand(2800, 3400), t + 0.1);
      bird.triggerRelease(t + 0.12);
    });
  } else {
    // Stage hum: the low rumble and air of a hall before the show. No beat (the music has one).
    bed("brown", 380, -24);
    bed("pink", 1200, -38, true);
  }

  return () => {
    timers.forEach(clearTimeout);
    out.gain.rampTo(0, 0.4);
    setTimeout(() => nodes.forEach((n) => n.dispose()), 700);
  };
}

/** Switches the ambience bed to `pack`'s, or turns it off with null. */
export function setAmbience(pack: PackId | null): void {
  if (ambience && ambience.pack === pack) return;
  ambience?.stop();
  ambience = null;
  if (!started || !pack) return;
  const kind = PACK_SOUNDS[pack].ambience;
  if (kind) ambience = { pack, stop: startAmbience(kind) };
}

// --- Background music: the five composed themes, played from their scores. ---
//
// Each theme plays in a session that owns its band: the lead (its own copy of
// the pack voice, never the shared effects synth), a pad, a bass, an answering
// voice and a small kit, all on one music bus with one reverb. The session
// plays one 16th step per Transport tick, so pausing the Transport or clearing
// the session stops new notes at once and the bus fade covers what still rings.
// A new mood in the same world takes over at the next bar line (layers change,
// tempo eases); a new world crossfades two sessions. Bass and drums ride their
// own Beat bus, which the Beat switch (and the mood's default) opens or closes.

type Disposable = { dispose: () => unknown };
type Player = { play: (notes: string[], dur: number, at: number, vel: number) => void };

type PadKit = { osc: "sine" | "triangle" | "square" | "sawtooth"; attack: number; decay: number; sustain: number; release: number; cutoff: number; db: number; poly: number; chorus?: true };
type BassKit = { osc: "sine" | "triangle" | "square" | "sawtooth"; attack: number; decay: number; sustain: number; release: number; db: number; filter?: { base: number; octaves: number } };
type Counter = "harp" | "piano" | "whistle" | "glitter" | "ocarina";
type MusicKit = { reverb: { decay: number; wet: number }; leadDb: number; pad: PadKit; bass: BassKit; counter: Counter; kick: string };

/** Each world's band, from its §6a instrument palette (the lead is the pack voice). The rhythm sits low in the mix. */
const KITS: Record<PackId, MusicKit> = {
  dreamlight: {
    // Music box lead, celesta-harp broken chords, a soft pad, wind chimes.
    reverb: { decay: 4.5, wet: 0.42 },
    leadDb: -3,
    pad: { osc: "triangle", attack: 1.2, decay: 1, sustain: 0.7, release: 2.2, cutoff: 1600, db: -13, poly: 10 },
    bass: { osc: "sine", attack: 0.03, decay: 1.2, sustain: 0.4, release: 1, db: -11 },
    counter: "harp",
    kick: "C2",
  },
  "anime-sky": {
    // Glockenspiel lead, bright piano, airy strings.
    reverb: { decay: 2.8, wet: 0.3 },
    leadDb: -4,
    pad: { osc: "sawtooth", attack: 0.7, decay: 0.8, sustain: 0.75, release: 1.6, cutoff: 1500, db: -20, poly: 10, chorus: true },
    bass: { osc: "triangle", attack: 0.006, decay: 0.5, sustain: 0.45, release: 0.25, db: -9 },
    counter: "piano",
    kick: "A1",
  },
  "toon-pop": {
    // Marimba lead, slide whistle answers, toy-organ stabs, bouncy bass, wood blocks.
    reverb: { decay: 1.3, wet: 0.14 },
    leadDb: -2,
    pad: { osc: "square", attack: 0.006, decay: 0.16, sustain: 0.28, release: 0.12, cutoff: 1400, db: -24, poly: 8 },
    bass: { osc: "square", attack: 0.004, decay: 0.18, sustain: 0.25, release: 0.08, db: -18, filter: { base: 180, octaves: 2.6 } },
    counter: "whistle",
    kick: "C2",
  },
  "idol-stage": {
    // Synth pluck lead, glitter arpeggios, a filtered saw pad, synth bass, claps.
    reverb: { decay: 2.2, wet: 0.26 },
    leadDb: -4,
    pad: { osc: "sawtooth", attack: 0.35, decay: 0.6, sustain: 0.6, release: 0.9, cutoff: 1100, db: -22, poly: 10, chorus: true },
    bass: { osc: "sawtooth", attack: 0.003, decay: 0.2, sustain: 0.35, release: 0.08, db: -17, filter: { base: 110, octaves: 3.2 } },
    counter: "glitter",
    kick: "A1",
  },
  terrarium: {
    // Kalimba (ostinato and tune), pond-hum drone, ocarina answers, rain drops, wood blocks.
    reverb: { decay: 3, wet: 0.32 },
    leadDb: -3,
    pad: { osc: "triangle", attack: 1.6, decay: 1, sustain: 0.75, release: 2.4, cutoff: 900, db: -12, poly: 10 },
    bass: { osc: "sine", attack: 0.02, decay: 0.7, sustain: 0.3, release: 0.5, db: -11 },
    counter: "ocarina",
    kick: "C2",
  },
};

/** Drum levels inside the Beat bus: soft, so even the Arcade groove supports rather than pounds. */
const KIT_DB = { kick: -14, snap: -13, hat: -22, block: -18 };

/** Plays a PolySynth within `cap` sounding voices (tails count), so Tone never drops a note with a warning. */
function polyPlayer(synth: Tone.PolySynth, cap: number): Player {
  synth.maxPolyphony = cap + 6; // headroom for notes Tone starts just in time and has not counted yet
  return {
    play(notes, dur, at, vel) {
      const room = cap - synth.activeVoices;
      if (room > 0) synth.triggerAttackRelease(notes.slice(0, room), dur, at, vel);
    },
  };
}

/** Plays a one-voice instrument; Tone needs every start strictly after the last one. */
function monoPlayer(trigger: (note: string | undefined, dur: number, at: number, vel: number) => void): Player {
  let last = -Infinity;
  return {
    play(notes, dur, at, vel) {
      const t = Math.max(at, last + 0.005);
      last = t;
      trigger(notes[0], dur, t, vel);
    },
  };
}

type Keep = <T extends Disposable>(node: T) => T;

function makeCounter(kind: Counter, out: Tone.ToneAudioNode, keep: Keep): Player {
  switch (kind) {
    case "harp": {
      const s = keep(new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 1.6, sustain: 0, release: 1.2 } })).connect(out);
      s.volume.value = -10;
      return polyPlayer(s, 6);
    }
    case "piano": {
      const s = keep(
        new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 1,
          modulationIndex: 2.2,
          oscillator: { type: "sine" },
          modulation: { type: "triangle" },
          envelope: { attack: 0.002, decay: 1.6, sustain: 0.06, release: 1 },
          modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0.1, release: 0.6 },
        }),
      ).connect(out);
      s.volume.value = -11;
      return polyPlayer(s, 10);
    }
    case "whistle": {
      // One sine voice with portamento: the answers slide like a slide whistle.
      const s = keep(new Tone.Synth({ portamento: 0.07, oscillator: { type: "sine" }, envelope: { attack: 0.04, decay: 0.1, sustain: 0.8, release: 0.12 } })).connect(out);
      s.volume.value = -12;
      return monoPlayer((n, d, t, v) => s.triggerAttackRelease(n ?? "C5", d, t, v));
    }
    case "glitter": {
      const s = keep(new Tone.PolySynth(Tone.Synth, { oscillator: { type: "square" }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.12 } })).connect(out);
      s.volume.value = -26;
      return polyPlayer(s, 6);
    }
    case "ocarina": {
      const s = keep(new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.07, decay: 0.2, sustain: 0.7, release: 0.5 } })).connect(out);
      s.volume.value = -9;
      return polyPlayer(s, 3);
    }
  }
}

type Band = { bus: Tone.Gain; beatBus: Tone.Gain; reverb: Tone.Reverb; lead: Tone.PolySynth; players: Partial<Record<Part, Player>>; nodes: Disposable[] };

/** Builds a session's instruments once; notes reuse them (nothing is created per note). */
function buildBand(pack: PackId, score: ThemeScore, beatOn: boolean): Band {
  const kit = KITS[pack];
  const nodes: Disposable[] = [];
  const keep: Keep = (node) => {
    nodes.push(node);
    return node;
  };
  const bus = keep(new Tone.Gain(0).toDestination());
  const reverb = keep(new Tone.Reverb({ decay: kit.reverb.decay, preDelay: 0.02, wet: kit.reverb.wet })).connect(bus);
  // Bass and drums: the Beat switch fades this bus, never the tune.
  const beatBus = keep(new Tone.Gain(beatOn ? 1 : 0)).connect(bus);

  // The melody's own copy of the pack voice, so it rides the music bus: faded, ducked, disposed with the session.
  const lead = keep(makeVoice(PACK_SOUNDS[pack].voice)).connect(reverb);
  lead.volume.value = kit.leadDb;

  const p = kit.pad;
  // Strings and synth pads get their width from one shared chorus, not extra oscillators per voice.
  const padOut = p.chorus ? keep(new Tone.Chorus({ frequency: 0.6, delayTime: 3.5, depth: 0.5, wet: 0.5 }).start()).connect(reverb) : reverb;
  const padTone = keep(new Tone.Filter(p.cutoff, "lowpass")).connect(padOut);
  const pad = keep(
    new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: p.osc },
      envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
    }),
  ).connect(padTone);
  pad.volume.value = p.db;

  const b = kit.bass;
  const bassEnv = { attack: b.attack, decay: b.decay, sustain: b.sustain, release: b.release };
  const bass = b.filter
    ? keep(
        new Tone.MonoSynth({
          oscillator: { type: b.osc },
          envelope: bassEnv,
          filter: { type: "lowpass", Q: 1 },
          filterEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.2, release: 0.1, baseFrequency: b.filter.base, octaves: b.filter.octaves },
        }),
      )
    : keep(new Tone.Synth({ oscillator: { type: b.osc }, envelope: bassEnv }));
  bass.connect(beatBus);
  bass.volume.value = b.db;

  const players: Partial<Record<Part, Player>> = {
    lead: polyPlayer(lead, 8),
    pad: polyPlayer(pad, p.poly),
    bass: monoPlayer((n, d, t, v) => bass.triggerAttackRelease(n ?? "C2", d, t, v)),
    counter: makeCounter(kit.counter, reverb, keep),
  };

  if (score.sparkle.voice === "drop") {
    // Rain drops: a short sine that chirps upward, like water.
    const drop = keep(new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 } })).connect(reverb);
    drop.volume.value = -12;
    players.drop = monoPlayer((n, _d, t, v) => {
      const f = Tone.Frequency(n ?? "A5").toFrequency();
      drop.triggerAttackRelease(f, 0.07, t, v);
      drop.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.05);
    });
  }

  const drums = new Set(Object.values(score.grooves ?? {}).flatMap((lines) => lines.map((l) => l.drum)));
  if (drums.has("kick")) {
    const kick = keep(new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.08 } })).connect(beatBus);
    kick.volume.value = KIT_DB.kick;
    players.kick = monoPlayer((_n, d, t, v) => kick.triggerAttackRelease(kit.kick, Math.min(d, 0.3), t, v));
  }
  if (drums.has("snare") || drums.has("clap")) {
    const tone = keep(new Tone.Filter(1500, "bandpass")).connect(beatBus);
    const snap = keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.04 } })).connect(tone);
    snap.volume.value = KIT_DB.snap;
    players.snap = monoPlayer((_n, d, t, v) => snap.triggerAttackRelease(Math.min(d, 0.1), t, v));
  }
  if (drums.has("hat") || drums.has("shaker")) {
    const tone = keep(new Tone.Filter(7500, "highpass")).connect(beatBus);
    const hat = keep(new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.012 } })).connect(tone);
    hat.volume.value = KIT_DB.hat;
    players.hat = monoPlayer((_n, d, t, v) => hat.triggerAttackRelease(Math.min(d, 0.05), t, v));
  }
  if (drums.has("block")) {
    const block = keep(new Tone.MembraneSynth({ pitchDecay: 0.006, octaves: 1.2, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 } })).connect(beatBus);
    block.volume.value = KIT_DB.block;
    players.block = monoPlayer((n, _d, t, v) => block.triggerAttackRelease(n ?? "D6", 0.05, t, v));
  }
  return { bus, beatBus, reverb, lead, players, nodes };
}

export type MusicSession = Band & {
  pack: PackId;
  seed: number;
  score: ThemeScore;
  mood: ThemeMood;
  /** A mood waiting for the next bar line. */
  pending: ThemeMood | null;
  /** Arcade heat sampled at the last bar line (0 outside the driving mood). */
  barHeat: number;
  /** Whether the Beat bus is open (bass and drums scheduled). */
  beatOn: boolean;
  pass: number;
  /** The next 16th step to play in the pass. */
  step: number;
  plan: PassPlan;
  byStep: PlannedEvent[][];
  repeatId: number | null;
};

let music: MusicSession | null = null;
const retiring = new Set<MusicSession>();
let ducked = false;
let hidden = false;
let musicHeat = 1;
/** The Beat switch: true or false when the child chose, null to follow the mood (off for learning). */
let beatChoice: boolean | null = null;
/** A world switch waiting out a burst of quick changes. */
let pendingWorld: { pack: PackId; mood: ThemeMood; seed: number; timer: ReturnType<typeof setTimeout> } | null = null;
/** A stop waiting to see whether another screen picks the music straight back up. */
let pendingStop: ReturnType<typeof setTimeout> | null = null;
/** World switches settle for this long before the crossfade starts. */
const WORLD_SETTLE_MS = 300;

function musicBusTarget(): number {
  return Tone.dbToGain(MUSIC_DB + (ducked ? DUCK_DB : 0));
}

const beatFor = (mood: ThemeMood) => beatChoice ?? defaultBeatOn(mood);

function indexSteps(plan: PassPlan): PlannedEvent[][] {
  const by: PlannedEvent[][] = Array.from({ length: plan.steps }, () => []);
  for (const e of plan.events) by[e.step].push(e);
  return by;
}

function replan(s: MusicSession): void {
  s.plan = planPass(s.score, s.mood, s.seed, s.pass);
  s.byStep = indexSteps(s.plan);
}

function tempoFor(s: MusicSession): number {
  return s.plan.bpm + s.barHeat * s.plan.heatBpm;
}

/** Opens or closes the Beat bus with a short fade (at `time`, or now). */
function applyBeat(s: MusicSession, time?: number): void {
  const want = beatFor(s.mood);
  if (want === s.beatOn) return;
  s.beatOn = want;
  s.beatBus.gain.rampTo(want ? 1 : 0, 0.3, time);
}

/** At each bar line a waiting mood takes over, the Arcade heat is sampled, and the tempo eases to suit. */
function barLine(s: MusicSession, time: number): void {
  if (s.pending && s.pending !== s.mood) {
    s.mood = s.pending;
    replan(s); // same pass and step, new layers
  }
  s.pending = null;
  s.barHeat = s.mood === "driving" ? musicHeat : 0;
  applyBeat(s, time);
  const bpm = Tone.getTransport().bpm;
  const target = tempoFor(s);
  if (Math.abs(bpm.getValueAtTime(time) - target) > 0.25) bpm.rampTo(target, 1.5, time);
}

/** Plays one 16th step. Called by the Transport just ahead of `time`. */
function tick(s: MusicSession, time: number): void {
  if (music !== s) return; // a retired session never plays another note
  if (s.step % s.plan.stepsPerBar === 0) barLine(s, time);
  const events = s.byStep[s.step];
  if (events.length) {
    const beat = 60 / Tone.getTransport().bpm.getValueAtTime(time);
    const swing = s.step % 4 === 2 ? (s.plan.swing * beat) / 4 : 0;
    for (const e of events) {
      if (e.minHeat > s.barHeat) continue;
      if (!s.beatOn && BEAT_PARTS.has(e.part)) continue;
      const player = s.players[e.part];
      if (!player) continue;
      const at = time + swing + e.nudgeMs / 1000;
      const dur = Math.max(0.03, e.durBeats * beat);
      player.play(e.notes, dur, at, e.vel);
      if (e.drum === "clap") player.play(e.notes, dur, at + 0.012, e.vel * 0.7); // a hand clap is a quick flam
    }
  }
  s.step++;
  if (s.step >= s.plan.steps) {
    s.step = 0;
    s.pass++;
    replan(s); // every pass gets fresh ornaments
  }
}

/** Stops a session's notes now and fades its bus to silence; its nodes are freed once silent. */
function retire(s: MusicSession, fade: number): void {
  if (s.repeatId !== null) Tone.getTransport().clear(s.repeatId);
  s.repeatId = null;
  if (music === s) music = null;
  retiring.add(s);
  s.bus.gain.rampTo(0, fade);
  setTimeout(() => {
    s.nodes.forEach((n) => n.dispose());
    retiring.delete(s);
  }, (fade + 0.5) * 1000);
}

function cancelPending(): void {
  if (pendingWorld) clearTimeout(pendingWorld.timer);
  pendingWorld = null;
  if (pendingStop) clearTimeout(pendingStop);
  pendingStop = null;
}

/** Starts a world's session now, crossfading from whatever plays. */
function startSession(pack: PackId, mood: ThemeMood, seed: number): void {
  const live = music;
  if (live) retire(live, CROSSFADE);
  const score = THEMES[pack];
  const plan = planPass(score, mood, seed, 0);
  const beatOn = beatFor(mood);
  const s: MusicSession = {
    ...buildBand(pack, score, beatOn),
    pack,
    seed,
    score,
    mood,
    pending: null,
    barHeat: mood === "driving" ? musicHeat : 0,
    beatOn,
    pass: 0,
    step: 0,
    plan,
    byStep: indexSteps(plan),
    repeatId: null,
  };
  const transport = Tone.getTransport();
  transport.bpm.value = tempoFor(s);
  music = s;
  holdTransport("music");
  if (!hidden) s.bus.gain.rampTo(musicBusTarget(), live ? CROSSFADE : FADE_IN);
  // One 16th per call, from the next 16th of the Transport grid.
  s.repeatId = transport.scheduleRepeat((time) => tick(s, time), "16n", 0);
}

/** Ducks the music bed while Kix speaks or the mic records (Music brief). */
export function setDucked(on: boolean): void {
  if (on === ducked) return; // the provider polls; only a change moves the fader
  ducked = on;
  if (music && !hidden) music.bus.gain.rampTo(musicBusTarget(), 0.4);
}

/**
 * Plays `pack`'s theme in `mood`. The same world in a new mood keeps playing and
 * changes at the next bar line (so quick page changes just update the plan); a
 * new world (or seed) settles briefly, then crossfades to a new session. There is
 * never more than one session scheduling notes.
 */
export function startMusic(pack: PackId, mood: ThemeMood, seed: number): void {
  if (!started) return;
  if (pendingStop) clearTimeout(pendingStop);
  pendingStop = null;
  const live = music;
  if (live && live.pack === pack && live.seed === seed) {
    if (pendingWorld) clearTimeout(pendingWorld.timer);
    pendingWorld = null;
    live.pending = mood === live.mood ? null : mood;
    return;
  }
  if (!live) {
    startSession(pack, mood, seed);
    return;
  }
  if (pendingWorld) clearTimeout(pendingWorld.timer);
  const timer = setTimeout(() => {
    pendingWorld = null;
    startSession(pack, mood, seed);
  }, WORLD_SETTLE_MS);
  pendingWorld = { pack, mood, seed, timer };
}

/** Switches mood at the next bar line; no-op when nothing plays. */
export function setMusicMood(mood: ThemeMood): void {
  if (pendingWorld) pendingWorld.mood = mood;
  else if (music) startMusic(music.pack, mood, music.seed);
}

/**
 * Arcade heat (0–1), for the games to call with their combo or heat. In the driving
 * mood it brings in layers and lifts the tempo from the next bar line; it only ever
 * adds or drops whole layers, never stray notes. Games raise it with good play only;
 * nothing here reacts to wrong keys.
 */
export function setMusicHeat(heat: number): void {
  musicHeat = Math.min(1, Math.max(0, heat));
}

/**
 * The Beat switch: true or false silences or restores the bass and drums now
 * (the tune keeps playing); null follows the mood (off for learning, on elsewhere).
 */
export function setBeat(choice: boolean | null): void {
  beatChoice = choice;
  if (music) applyBeat(music);
}

/** Fades the music out and frees its band. `quick` shortens the fade (it never hard-cuts). */
export function stopMusic(quick = false): void {
  cancelPending();
  const s = music;
  if (!s) return;
  retire(s, quick ? 0.15 : FADE_OUT);
  releaseTransport("music");
}

/**
 * Stops the music after `ms` unless something starts it again first: a screen
 * that unmounts calls this, so moving between areas never restarts the tune.
 */
export function releaseMusic(ms = 800): void {
  if (!music && !pendingWorld) return;
  if (pendingStop) clearTimeout(pendingStop);
  pendingStop = setTimeout(() => {
    pendingStop = null;
    stopMusic();
  }, ms);
}

/** Whether audio is already unlocked (an earlier screen did it), so a new screen needs no tap. */
export function isStarted(): boolean {
  return started;
}

/** Pauses the music when the tab hides (CPUs and ears rest) and resumes it on return. */
export function setHidden(next: boolean): void {
  if (!started || next === hidden) return;
  hidden = next;
  const transport = Tone.getTransport();
  if (hidden) {
    music?.bus.gain.rampTo(0, 0.2);
    if (transport.state === "started") transport.pause();
  } else {
    if (transportHolds.size > 0 && transport.state !== "started") transport.start();
    music?.bus.gain.rampTo(musicBusTarget(), 0.8);
  }
}

/** For tests and checks: the live session and any still fading out. */
export function musicSessions(): { live: MusicSession | null; retiring: MusicSession[] } {
  return { live: music, retiring: [...retiring] };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => setHidden(document.hidden));
}
