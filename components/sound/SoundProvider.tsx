"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme/ThemeRoot";
import type { Band, PackId } from "@/components/theme/packs";
import { PACK_SOUNDS, defaultBeatOn, defaultMusicOn, defaultSoundOn, type PropSound, type SoundEvent } from "@/lib/sound/palette";
import { moodForPath } from "@/lib/sound/music/mood";
import type { ThemeMood } from "@/lib/sound/music/schema";
import { getServerSnapshot, getSnapshot, parsePrefs, savePrefs, subscribe } from "@/lib/sound/prefs";

type Engine = typeof import("@/lib/sound/engine");

/**
 * One seed per tab: the sign-in and kid areas each mount their own provider,
 * and a shared seed lets the theme carry on across them instead of restarting.
 */
let tabSeed = 0;
const seedForTab = () => (tabSeed ||= 1 + Math.floor(Math.random() * (2 ** 31 - 1)));
/** The engine module once any provider has loaded it. */
let loadedEngine: Engine | null = null;

type SoundContextValue = {
  /** Sound effects (and ambience, if chosen) are audible. */
  on: boolean;
  setOn: (on: boolean) => void;
  ambienceOn: boolean;
  setAmbienceOn: (on: boolean) => void;
  /** The composed theme for the current pack. */
  musicOn: boolean;
  setMusicOn: (on: boolean) => void;
  /** The music's bass and drums (the tune plays either way). Off by default for learning. */
  beatOn: boolean;
  setBeatOn: (on: boolean) => void;
  /** Ducks the music bed (mic recording); Kix's speech ducks it automatically. */
  duck: (on: boolean) => void;
  /** The current pack's ambience name, or null when the pack has none. */
  ambienceLabel: string | null;
  /** Plays a UI sound in the current pack (or `pack`). Silent when sound is off. */
  play: (event: SoundEvent, pack?: PackId) => void;
  /** Plays a living-scene prop sound (lamp, drawer, crystal...). `step` picks a scale note for chimes. */
  prop: (kind: PropSound, opts?: { pack?: PackId; step?: number }) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

/**
 * Reads the route in a Suspense island: `usePathname` blocks static prerender
 * in a layout-level provider, so the mood resolves client-side after hydration.
 */
function PathMood({ onMood }: { onMood: (mood: ThemeMood) => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onMood(moodForPath(pathname ?? "/"));
  }, [pathname, onMood]);
  return null;
}

export function useSound(): SoundContextValue {
  const value = useContext(SoundContext);
  if (!value) throw new Error("useSound must be used inside <SoundProvider>");
  return value;
}

export function SoundProvider({ children, kidArea = false }: { children: ReactNode; kidArea?: boolean }) {
  const { pack, band: themeBand } = useTheme();
  // ThemeRoot still opens junior everywhere (its Day-3 profile wiring is a
  // later task's); sound defaults read the signed-in kid's real band instead.
  const [meBand, setMeBand] = useState<Band | null>(null);
  useEffect(() => {
    // Grown-up and door screens have no kid session; asking would only 401.
    if (!kidArea) return;
    let live = true;
    fetch("/api/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: unknown) => {
        const band = (body as { kid?: { band?: unknown } } | null)?.kid?.band;
        if (live && (band === "junior" || band === "teen")) setMeBand(band);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [kidArea]);
  const band = meBand ?? themeBand;
  const prefs = parsePrefs(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot));
  const on = prefs.on ?? defaultSoundOn(band);
  const ambienceOn = prefs.ambience ?? false;
  const musicOn = prefs.music ?? defaultMusicOn(band);
  // Prerender-safe defaults (the island below resolves the real route after
  // hydration; the seed is minted with the first tap, when audio unlocks).
  const [mood, setMood] = useState<ThemeMood>("calm");
  const [seed, setSeed] = useState(0);
  const beatOn = prefs.beat ?? defaultBeatOn(mood);
  const [micDuck, setMicDuck] = useState(false);
  const [ready, setReady] = useState(false);
  const engine = useRef<Engine | null>(null);
  const loading = useRef<Promise<Engine> | null>(null);
  const onRef = useRef(on);
  useEffect(() => {
    onRef.current = on;
  }, [on]);

  // Tone.js is fetched when the page is idle (never in the first load) and started inside the
  // first tap: iOS Safari only lets audio start synchronously within a user gesture.
  const fetched = useRef<Engine | null>(null);
  const fetchEngine = useCallback((): Promise<Engine> => {
    loading.current ??= import("@/lib/sound/engine").then((m) => {
      fetched.current = m;
      loadedEngine = m;
      return m;
    });
    return loading.current;
  }, []);

  const begin = useCallback((m: Engine) => {
    if (engine.current) return;
    setSeed(seedForTab());
    const started = m.start(); // resumes the AudioContext synchronously, inside the gesture when possible
    engine.current = m;
    void started.then(() => {
      document.documentElement.dataset.sound = "ready";
      setReady(true);
    });
  }, []);

  const load = useCallback((): Promise<Engine> => {
    if (fetched.current) {
      begin(fetched.current);
      return Promise.resolve(fetched.current);
    }
    return fetchEngine().then((m) => {
      begin(m);
      return m;
    });
  }, [begin, fetchEngine]);

  useEffect(() => {
    if (!on) return;
    // Audio was unlocked on an earlier screen (the sign-in area has its own
    // provider): carry straight on, with no new tap and no restart.
    if (loadedEngine?.isStarted()) {
      void load();
      return;
    }
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => void fetchEngine());
    return () => cancel(handle);
  }, [on, fetchEngine, load]);

  // Leaving the sound area lets the music go, unless the next screen picks it straight back up.
  useEffect(() => () => loadedEngine?.releaseMusic(), []);

  useEffect(() => {
    const unlock = () => {
      if (onRef.current) void load();
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [load]);

  useEffect(() => {
    engine.current?.setMuted(!on);
  }, [on, ready]);

  useEffect(() => {
    engine.current?.setAmbience(on && ambienceOn ? pack : null);
  }, [on, ambienceOn, pack, ready]);

  // The Beat switch: the child's choice, or (unset) the place's default.
  useEffect(() => {
    if (ready) engine.current?.setBeat(prefs.beat ?? null);
  }, [prefs.beat, ready]);

  // The composed theme follows the pack and the place (mood); it starts with
  // the first tap like everything else, because browsers block audio before that.
  useEffect(() => {
    if (!ready) return;
    if (on && musicOn) engine.current?.startMusic(pack, mood, seed);
    else engine.current?.stopMusic();
  }, [on, musicOn, pack, mood, seed, ready]);

  // Duck the bed while Kix speaks (device voice) or the mic records.
  const micDuckRef = useRef(micDuck);
  useEffect(() => {
    micDuckRef.current = micDuck;
    if (!ready || typeof window === "undefined" || !("speechSynthesis" in window)) {
      engine.current?.setDucked(micDuck);
      return;
    }
    const tick = () => engine.current?.setDucked(window.speechSynthesis.speaking || micDuckRef.current);
    tick();
    const handle = window.setInterval(tick, 400);
    return () => window.clearInterval(handle);
  }, [ready, micDuck]);

  const play = useCallback(
    (event: SoundEvent, target: PackId = pack) => {
      if (!onRef.current) return;
      if (engine.current) engine.current.play(target, event);
      else void load().then((m) => m.play(target, event));
    },
    [pack, load],
  );

  const prop = useCallback(
    (kind: PropSound, opts: { pack?: PackId; step?: number } = {}) => {
      if (!onRef.current) return;
      const target = opts.pack ?? pack;
      if (engine.current) engine.current.prop(target, kind, opts.step);
      else void load().then((m) => m.prop(target, kind, opts.step));
    },
    [pack, load],
  );

  const setOn = useCallback(
    (next: boolean) => {
      savePrefs({ ...prefs, on: next });
      if (next) void load();
    },
    [prefs, load],
  );

  const setAmbienceOn = useCallback(
    (next: boolean) => {
      savePrefs({ ...prefs, ambience: next });
      if (next) void load();
    },
    [prefs, load],
  );

  const setMusicOn = useCallback(
    (next: boolean) => {
      savePrefs({ ...prefs, music: next });
      if (next) void load();
    },
    [prefs, load],
  );

  const setBeatOn = useCallback((next: boolean) => savePrefs({ ...prefs, beat: next }), [prefs]);

  const duck = useCallback((next: boolean) => setMicDuck(next), []);

  return (
    <SoundContext
      value={{ on, setOn, ambienceOn, setAmbienceOn, musicOn, setMusicOn, beatOn, setBeatOn, duck, ambienceLabel: PACK_SOUNDS[pack].ambienceLabel, play, prop }}
    >
      <Suspense fallback={null}>
        <PathMood onMood={setMood} />
      </Suspense>
      {children}
    </SoundContext>
  );
}
