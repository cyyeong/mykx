// Browser-only sound engine on Tone.js. Loaded with a dynamic import after the first tap
// (browsers block audio before a user gesture), so Tone never ships in the first page load.
import * as Tone from "tone";
import type { PackId } from "@/components/theme/packs";
import { type Ambience, type Effect, type Flourish, type PropSound, type SoundEvent, type Voice, PACK_SOUNDS, planFor } from "./palette";

const MASTER_DB = -12;

let started = false;
const voices = new Map<PackId, { synth: Tone.PolySynth; reverb: Tone.Freeverb }>();
let ambience: { pack: PackId; stop: () => void } | null = null;

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

function startAmbience(kind: Ambience, pack: PackId): () => void {
  const nodes: { dispose: () => unknown }[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const out = new Tone.Volume(-6).toDestination();
  nodes.push(out);

  // A soft noise bed shared by the outdoor scenes.
  const bed = (type: "pink" | "brown", cutoff: number, db: number, sweep = false) => {
    const filter = sweep ? new Tone.AutoFilter({ frequency: 0.07, baseFrequency: cutoff / 3, octaves: 2 }).start() : new Tone.Filter(cutoff, "lowpass");
    filter.connect(out);
    const noise = new Tone.Noise(type).connect(filter);
    noise.volume.value = db;
    noise.start();
    nodes.push(noise, filter);
  };
  // Repeats `fn` at random gaps until stopped.
  const every = (min: number, max: number, fn: () => void) => {
    const tick = () => {
      fn();
      timers.push(setTimeout(tick, rand(min, max) * 1000));
    };
    timers.push(setTimeout(tick, rand(min, max) * 1000));
  };

  if (kind === "rain-crickets") {
    bed("pink", 1400, -30);
    const cricket = new Tone.FMSynth({ harmonicity: 1.5, modulationIndex: 4, envelope: { attack: 0.005, decay: 0.04, sustain: 0, release: 0.02 } }).connect(out);
    cricket.volume.value = -30;
    const drip = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 } }).connect(out);
    drip.volume.value = -24;
    nodes.push(cricket, drip);
    every(0.8, 1.6, () => {
      const t = Tone.now();
      for (let i = 0; i < 3; i++) cricket.triggerAttackRelease("A6", 0.04, t + i * 0.07);
    });
    every(2, 5, () => drip.triggerAttackRelease(PACK_SOUNDS[pack].scale[Math.floor(rand(3, 7))], 0.12));
  } else if (kind === "night-breeze") {
    bed("brown", 900, -26, true);
    every(3, 6, () => voiceFor(pack).triggerAttackRelease([PACK_SOUNDS[pack].scale[Math.floor(rand(2, 7))]], 0.4, undefined, 0.15));
  } else if (kind === "wind-birds") {
    bed("pink", 1800, -32, true);
    const bird = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.03 } }).connect(out);
    bird.volume.value = -26;
    nodes.push(bird);
    every(2, 4.5, () => {
      const t = Tone.now();
      bird.triggerAttack(rand(2000, 2600), t);
      bird.frequency.exponentialRampToValueAtTime(rand(2800, 3400), t + 0.1);
      bird.triggerRelease(t + 0.12);
    });
  } else {
    // Stage pulse: a soft four-on-the-floor at 100 bpm with off-beat hats.
    const kick = new Tone.MembraneSynth({ envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } }).connect(out);
    kick.volume.value = -22;
    const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 } }).connect(out);
    hat.volume.value = -34;
    nodes.push(kick, hat);
    const beat = 60 / 100;
    const loop = new Tone.Loop((time) => {
      kick.triggerAttackRelease("C1", 0.2, time);
      hat.triggerAttackRelease(0.04, time + beat / 2);
    }, beat).start(0);
    nodes.push(loop);
    Tone.getTransport().start();
  }

  return () => {
    timers.forEach(clearTimeout);
    nodes.forEach((n) => n.dispose());
    if (kind === "stage-pulse") Tone.getTransport().stop();
  };
}

/** Switches the ambience bed to `pack`'s, or turns it off with null. */
export function setAmbience(pack: PackId | null): void {
  if (ambience && ambience.pack === pack) return;
  ambience?.stop();
  ambience = null;
  if (!started || !pack) return;
  const kind = PACK_SOUNDS[pack].ambience;
  if (kind) ambience = { pack, stop: startAmbience(kind, pack) };
}
