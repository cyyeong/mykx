// The music engine against a fake Tone.js: each session owns its lead voice on
// the music bus (never the effects synth), stops scheduling the moment it is
// stopped, fades and is disposed with its band, crossfades between worlds,
// changes mood at bar lines, and only moves the fader when something changed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ramp = [value: number, time: number];

const fake = vi.hoisted(() => {
  class Param {
    value: number;
    ramps: Ramp[] = [];
    constructor(v = 0) {
      this.value = v;
    }
    rampTo(v: number, t: number) {
      this.ramps.push([v, t]);
      this.value = v;
      return this;
    }
    getValueAtTime() {
      return this.value;
    }
    setValueAtTime(v: number) {
      this.value = v;
      return this;
    }
    exponentialRampToValueAtTime() {
      return this;
    }
  }
  const destination = { kind: "Destination", volume: new Param(), mute: false };
  const nodes: FakeNode[] = [];
  class FakeNode {
    kind: string;
    args: unknown[];
    targets: unknown[] = [];
    disposed = false;
    volume = new Param();
    gain = new Param(1);
    frequency = new Param(440);
    maxPolyphony = 32;
    activeVoices = 0;
    calls: unknown[][] = [];
    constructor(kind: string, args: unknown[]) {
      this.kind = kind;
      this.args = args;
      if (kind === "Gain") this.gain.value = Number(args[0] ?? 1);
      nodes.push(this);
    }
    connect(t: unknown) {
      this.targets.push(t);
      return this;
    }
    toDestination() {
      this.targets.push(destination);
      return this;
    }
    dispose() {
      this.disposed = true;
      return this;
    }
    triggerAttackRelease(...a: unknown[]) {
      this.calls.push(a);
      return this;
    }
    start() {
      return this;
    }
  }
  const make = (kind: string) =>
    class extends FakeNode {
      constructor(...args: unknown[]) {
        super(kind, args);
      }
    };
  const transport = {
    bpm: new Param(120),
    state: "stopped" as "started" | "stopped" | "paused",
    repeats: new Map<number, (time: number) => void>(),
    nextId: 1,
    start() {
      this.state = "started";
      return this;
    },
    stop() {
      this.state = "stopped";
      return this;
    },
    pause() {
      this.state = "paused";
      return this;
    },
    scheduleRepeat(cb: (time: number) => void) {
      const id = this.nextId++;
      this.repeats.set(id, cb);
      return id;
    },
    clear(id: number) {
      this.repeats.delete(id);
      return this;
    },
  };
  return { Param, FakeNode, nodes, destination, transport, make };
});
type FakeNode = InstanceType<typeof fake.FakeNode>;

vi.mock("tone", () => ({
  start: () => Promise.resolve(),
  now: () => 0,
  getDestination: () => fake.destination,
  getTransport: () => fake.transport,
  dbToGain: (db: number) => 10 ** (db / 20),
  Frequency: (n: string) => ({ toFrequency: () => 440, transpose: () => ({ toNote: () => n }) }),
  Time: () => ({ toSeconds: () => 0.25 }),
  Gain: fake.make("Gain"),
  Reverb: fake.make("Reverb"),
  Freeverb: fake.make("Freeverb"),
  Filter: fake.make("Filter"),
  Chorus: fake.make("Chorus"),
  PolySynth: fake.make("PolySynth"),
  Synth: fake.make("Synth"),
  FMSynth: fake.make("FMSynth"),
  MonoSynth: fake.make("MonoSynth"),
  MembraneSynth: fake.make("MembraneSynth"),
  NoiseSynth: fake.make("NoiseSynth"),
}));

let engine: typeof import("./engine");
let clock = 0;

/** Fires the Transport's repeat callbacks `n` times, one 16th apart. */
function runTicks(n: number) {
  for (let i = 0; i < n; i++) {
    clock += 0.125;
    for (const cb of [...fake.transport.repeats.values()]) cb(clock);
  }
}
const node = (x: unknown) => x as FakeNode;
const live = () => engine.musicSessions().live!;
const polys = (s: ReturnType<typeof live>) => (s.nodes as unknown as FakeNode[]).filter((n) => n.kind === "PolySynth");
const busDb = (db: number) => 10 ** (db / 20);

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  fake.nodes.length = 0;
  fake.transport.repeats.clear();
  fake.transport.state = "stopped";
  clock = 0;
  engine = await import("./engine");
  await engine.start();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("music sessions", () => {
  it("give the melody its own lead synth on the music bus, apart from the effects voice", () => {
    engine.startMusic("dreamlight", "calm", 7);
    const s = live();
    const lead = node(s.lead);
    expect(lead.kind).toBe("PolySynth");
    expect(lead.targets).toEqual([s.reverb]);
    expect(node(s.reverb).targets).toEqual([s.bus]);
    expect(node(s.bus).targets).toEqual([fake.destination]);
    // Only the bus reaches the destination, so fades, ducking and stops cover every layer.
    for (const n of s.nodes as unknown as FakeNode[]) if (n !== node(s.bus)) expect(n.targets).not.toContain(fake.destination);

    runTicks(48);
    expect(lead.calls.length).toBeGreaterThan(0);

    engine.play("dreamlight", "tap");
    const effects = fake.nodes.filter((n) => n.kind === "PolySynth" && !(s.nodes as unknown[]).includes(n));
    expect(effects).toHaveLength(1);
    expect(effects[0].calls).toHaveLength(1);
    expect(effects[0]).not.toBe(lead);
  });

  it("stop scheduling the moment music stops, fade the bus, then dispose the lead with the band", () => {
    engine.startMusic("anime-sky", "bright", 3);
    const s = live();
    const lead = node(s.lead);
    runTicks(40);
    const played = lead.calls.length;
    expect(played).toBeGreaterThan(0);
    const [tickFn] = [...fake.transport.repeats.values()];

    engine.stopMusic();
    expect(fake.transport.repeats.size).toBe(0);
    tickFn(99); // even a tick already in flight plays nothing
    runTicks(64);
    expect(lead.calls.length).toBe(played);
    expect(node(s.bus).gain.ramps.at(-1)).toEqual([0, 0.8]);
    expect(lead.disposed).toBe(false);

    vi.advanceTimersByTime(1400);
    expect(lead.disposed).toBe(true);
    expect((s.nodes as unknown as FakeNode[]).every((n) => n.disposed)).toBe(true);
    expect(engine.musicSessions()).toEqual({ live: null, retiring: [] });
  });

  it("crossfade between worlds: the old bus fades out while the new one fades in", () => {
    engine.startMusic("dreamlight", "bright", 1);
    const a = live();
    runTicks(8);
    engine.startMusic("terrarium", "bright", 1);
    expect(live()).toBe(a); // the switch settles first
    vi.advanceTimersByTime(300);
    const b = live();
    expect(b).not.toBe(a);
    expect(b.pack).toBe("terrarium");
    expect(engine.musicSessions().retiring).toEqual([a]);
    expect(node(a.bus).gain.ramps.at(-1)).toEqual([0, 1.5]);
    const [to, over] = node(b.bus).gain.ramps.at(-1)!;
    expect(to).toBeCloseTo(busDb(-24), 9);
    expect(over).toBe(1.5);
    expect(fake.transport.repeats.size).toBe(1);

    vi.advanceTimersByTime(2100);
    expect((a.nodes as unknown as FakeNode[]).every((n) => n.disposed)).toBe(true);
    expect((b.nodes as unknown as FakeNode[]).some((n) => n.disposed)).toBe(false);
  });

  it("settle a burst of world changes into one crossfade, and never run two sessions", () => {
    engine.startMusic("dreamlight", "calm", 1);
    const a = live();
    const before = fake.nodes.length;
    engine.startMusic("terrarium", "calm", 1);
    vi.advanceTimersByTime(100);
    engine.startMusic("toon-pop", "calm", 1);
    vi.advanceTimersByTime(100);
    engine.startMusic("anime-sky", "calm", 1);
    vi.advanceTimersByTime(299);
    expect(live()).toBe(a);
    expect(fake.nodes.length).toBe(before); // nothing built for the worlds skipped past
    vi.advanceTimersByTime(1);
    expect(live().pack).toBe("anime-sky");
    expect(engine.musicSessions().retiring).toEqual([a]);
    expect(fake.transport.repeats.size).toBe(1);

    // Coming back to the playing world cancels a pending switch.
    engine.startMusic("dreamlight", "calm", 1);
    engine.startMusic("anime-sky", "bright", 1);
    vi.advanceTimersByTime(1000);
    expect(live().pack).toBe("anime-sky");
  });

  it("let the Beat switch silence only the bass and drums, and follow the place until chosen", () => {
    engine.startMusic("idol-stage", "calm", 8); // learning: Beat off by default
    const s = live();
    const beatBus = node(s.beatBus);
    expect(s.beatOn).toBe(false);
    expect(beatBus.gain.value).toBe(0);
    expect(beatBus.targets).toEqual([s.bus]);
    const kick = (s.nodes as unknown as FakeNode[]).find((n) => n.kind === "MembraneSynth")!;
    const bass = (s.nodes as unknown as FakeNode[]).find((n) => n.kind === "MonoSynth")!;
    expect(kick.targets).toEqual([s.beatBus]);
    expect(bass.targets).toEqual([s.beatBus]);
    runTicks(16);
    expect(bass.calls).toHaveLength(0);
    expect(node(s.lead).calls.length).toBeGreaterThan(0);

    engine.startMusic("idol-stage", "driving", 8); // the Arcade: Beat on by default, at the bar line
    runTicks(16);
    expect(s.beatOn).toBe(true);
    expect(beatBus.gain.ramps.at(-1)![0]).toBe(1);
    expect(kick.calls.length).toBeGreaterThan(0);

    engine.setBeat(false); // the child turns it off: at once, and it sticks
    expect(beatBus.gain.ramps.at(-1)![0]).toBe(0);
    const kicks = kick.calls.length;
    const leads = node(s.lead).calls.length;
    runTicks(32);
    expect(kick.calls).toHaveLength(kicks);
    expect(node(s.lead).calls.length).toBeGreaterThan(leads);

    engine.setBeat(null); // back to the place's default
    expect(s.beatOn).toBe(true);
  });

  it("let a screen release the music after a pause, unless the next screen picks it up", () => {
    engine.startMusic("dreamlight", "calm", 2);
    const s = live();
    engine.releaseMusic(800);
    vi.advanceTimersByTime(500);
    engine.startMusic("dreamlight", "bright", 2); // the next area carries on
    vi.advanceTimersByTime(2000);
    expect(live()).toBe(s);

    engine.releaseMusic(800);
    vi.advanceTimersByTime(900);
    expect(engine.musicSessions().live).toBeNull();
    expect(fake.transport.repeats.size).toBe(0);
  });

  it("keep playing through a mood change in the same world and switch at the next bar line", () => {
    engine.startMusic("idol-stage", "calm", 5);
    const s = live();
    runTicks(3);
    engine.startMusic("idol-stage", "driving", 5);
    expect(live()).toBe(s);
    expect(s.mood).toBe("calm");
    expect(fake.transport.repeats.size).toBe(1);
    const kick = (s.nodes as unknown as FakeNode[]).find((n) => n.kind === "MembraneSynth")!;

    runTicks(13); // up to the last 16th of bar 1
    expect(s.mood).toBe("calm");
    expect(kick.calls).toHaveLength(0);

    runTicks(1); // the bar line
    expect(s.mood).toBe("driving");
    expect(kick.calls.length).toBeGreaterThan(0);
    const [bpm, over] = fake.transport.bpm.ramps.at(-1)!;
    expect(bpm).toBe(s.plan.bpm + s.plan.heatBpm); // full heat by default
    expect(over).toBe(1.5);
    expect(node(s.bus).gain.ramps.filter(([v]) => v === 0)).toHaveLength(0); // no fade, no restart
  });

  it("let Arcade heat in only at bar lines, and only when driving", () => {
    engine.setMusicHeat(0);
    engine.startMusic("idol-stage", "driving", 2);
    const s = live();
    const glitter = polys(s)[2]; // lead, pad, then the answering voice that plays the arpeggios
    runTicks(30); // most of bars 1 and 2
    expect(glitter.calls).toHaveLength(0);
    expect(fake.transport.bpm.value).toBe(s.plan.bpm);

    engine.setMusicHeat(1);
    runTicks(2); // the end of bar 2: heat waits for the bar line
    expect(glitter.calls).toHaveLength(0);
    runTicks(16);
    expect(glitter.calls.length).toBeGreaterThan(0);
    expect(fake.transport.bpm.ramps.at(-1)![0]).toBe(s.plan.bpm + s.plan.heatBpm);
  });

  it("duck only when the state changes, so a running fade is never cut short", () => {
    engine.startMusic("toon-pop", "bright", 4);
    const gain = node(live().bus).gain;
    const n = gain.ramps.length;
    engine.setDucked(false);
    expect(gain.ramps).toHaveLength(n);
    engine.setDucked(true);
    expect(gain.ramps).toHaveLength(n + 1);
    expect(gain.ramps.at(-1)![0]).toBeCloseTo(busDb(-34), 9);
    engine.setDucked(true);
    expect(gain.ramps).toHaveLength(n + 1);
  });

  it("pause and fade out when the tab hides, and resume when it returns", () => {
    engine.startMusic("terrarium", "calm", 6);
    const gain = node(live().bus).gain;
    expect(fake.transport.state).toBe("started");
    engine.setHidden(true);
    expect(fake.transport.state).toBe("paused");
    expect(gain.ramps.at(-1)![0]).toBe(0);
    engine.setHidden(false);
    expect(fake.transport.state).toBe("started");
    expect(gain.ramps.at(-1)![0]).toBeCloseTo(busDb(-24), 9);
  });

  it("treat starting the same world, mood and seed as a no-op, and never start before audio is unlocked", async () => {
    engine.startMusic("dreamlight", "calm", 9);
    const s = live();
    engine.startMusic("dreamlight", "calm", 9);
    expect(live()).toBe(s);
    expect(engine.musicSessions().retiring).toHaveLength(0);

    vi.resetModules();
    const cold = await import("./engine");
    cold.startMusic("dreamlight", "calm", 9);
    expect(cold.musicSessions().live).toBeNull();
  });
});
