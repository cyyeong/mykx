"use client";

// Living scenes: the art behind a kid's screen has things to poke (a lamp, a drawer, a pond, crystals).
// Everything here is cosmetic and never touches mastery or rewards (AGENTS.md rule 5). Spec:
// docs/design/living-scenes.md.
//
// <LivingScene> draws the art cover-fitted (like object-fit: cover) inside a box with the art's aspect ratio,
// so children placed in art percentages (layers, hotspots, effects) stay on the painted objects at any size.
// The frame's object position comes from --ox / --oy, which a screen's CSS may change per breakpoint.
import { useCallback, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Art } from "@/components/ui/Art";
import "./scene.css";

export function LivingScene({
  art,
  aspect,
  className = "",
  sizes = "100vw",
  children,
}: {
  /** Art path without extension, for <Art base>. */
  art: string;
  /** Width / height of the art. */
  aspect: number;
  className?: string;
  sizes?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`ls-frame ${className}`}>
      <div className="ls-box" style={{ "--ar": aspect } as CSSProperties}>
        <Art base={art} alt="" className="ls-art" sizes={sizes} fetchPriority="high" />
        {children}
      </div>
    </div>
  );
}

/** Another state of the same art (same framing), cross-faded in. `mask` limits it to a patch. */
export function SceneLayer({ art, visible, mask, className = "", sizes = "100vw" }: { art: string; visible: boolean; mask?: string; className?: string; sizes?: string }) {
  return (
    <Art
      base={art}
      alt=""
      sizes={sizes}
      className={`ls-layer ${className}`}
      data-on={visible ? "yes" : "no"}
      style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
    />
  );
}

/** A rectangle in art percentages. */
export type Box = { x: number; y: number; w: number; h: number };

export const boxStyle = ({ x, y, w, h }: Box): CSSProperties => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

/**
 * A poke-able thing in the art. A real button (keyboard and screen readers reach it), invisible until hovered
 * or focused, with an occasional glint so kids discover it. Its glint waits a different time per hotspot.
 */
export function Hotspot({ box, label, onTap, pressed, round = false }: { box: Box; label: string; onTap: () => void; pressed?: boolean; round?: boolean }) {
  const delay = `${(-(box.x * 7 + box.y * 3) % 11).toFixed(1)}s`;
  return (
    <button
      type="button"
      className={`ls-spot ${round ? "ls-spot--round" : ""}`}
      style={{ ...boxStyle(box), "--glint-delay": delay } as CSSProperties}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onTap}
    >
      <span className="ls-glint" aria-hidden="true" />
    </button>
  );
}

/**
 * Cosmetic variety: `pick(n)` never repeats the last choice for that key, `chance(p)` is a plain coin.
 * Only for how a prop reacts, never for anything a child earns.
 */
export function useVariety() {
  const last = useRef(new Map<string, number>());
  const pick = useCallback((key: string, n: number) => {
    const prev = last.current.get(key);
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === prev) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    last.current.set(key, i);
    return i;
  }, []);
  const chance = useCallback((p: number) => Math.random() < p, []);
  return { pick, chance };
}

/** One-shot effects: `fire(kind)` mounts an effect with a fresh key; it unmounts after `ms`. */
export function useBursts<K extends string>() {
  const [bursts, setBursts] = useState<{ id: number; kind: K; v: number }[]>([]);
  const next = useRef(0);
  const fire = useCallback((kind: K, ms: number, v = 0) => {
    const id = ++next.current;
    setBursts((b) => [...b, { id, kind, v }]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), ms);
  }, []);
  return { bursts, fire };
}

// A remembered prop state per device (the lamp stays as you left it). Storage may be blocked: then it's per visit.
const listeners = new Set<() => void>();
const readFlag = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
export function useSceneFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [fallback, setFallback] = useState(initial);
  const stored = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => readFlag(key),
    () => null,
  );
  const value = stored === null ? fallback : stored === "1";
  const set = useCallback(
    (v: boolean) => {
      setFallback(v);
      try {
        window.localStorage.setItem(key, v ? "1" : "0");
      } catch {
        /* per visit only */
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}

/** Local hour on the child's device, or null on the server (the server doesn't know the child's clock). */
export function useLocalHour(): number | null {
  return useSyncExternalStore(
    (cb) => {
      const id = window.setInterval(cb, 5 * 60_000);
      return () => clearInterval(id);
    },
    () => new Date().getHours(),
    () => null,
  );
}
