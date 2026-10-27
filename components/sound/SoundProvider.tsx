"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "@/components/theme/ThemeRoot";
import type { PackId } from "@/components/theme/packs";
import { PACK_SOUNDS, defaultSoundOn, type PropSound, type SoundEvent } from "@/lib/sound/palette";
import { getServerSnapshot, getSnapshot, parsePrefs, savePrefs, subscribe } from "@/lib/sound/prefs";

type Engine = typeof import("@/lib/sound/engine");

type SoundContextValue = {
  /** Sound effects (and ambience, if chosen) are audible. */
  on: boolean;
  setOn: (on: boolean) => void;
  ambienceOn: boolean;
  setAmbienceOn: (on: boolean) => void;
  /** The current pack's ambience name, or null when the pack has none. */
  ambienceLabel: string | null;
  /** Plays a UI sound in the current pack (or `pack`). Silent when sound is off. */
  play: (event: SoundEvent, pack?: PackId) => void;
  /** Plays a living-scene prop sound (lamp, drawer, crystal...). `step` picks a scale note for chimes. */
  prop: (kind: PropSound, opts?: { pack?: PackId; step?: number }) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function useSound(): SoundContextValue {
  const value = useContext(SoundContext);
  if (!value) throw new Error("useSound must be used inside <SoundProvider>");
  return value;
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const { pack, band } = useTheme();
  const prefs = parsePrefs(useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot));
  const on = prefs.on ?? defaultSoundOn(band);
  const ambienceOn = prefs.ambience ?? false;
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
      return m;
    });
    return loading.current;
  }, []);

  const begin = useCallback((m: Engine) => {
    if (engine.current) return;
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
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => void fetchEngine());
    return () => cancel(handle);
  }, [on, fetchEngine]);

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

  return (
    <SoundContext value={{ on, setOn, ambienceOn, setAmbienceOn, ambienceLabel: PACK_SOUNDS[pack].ambienceLabel, play, prop }}>
      {children}
    </SoundContext>
  );
}
