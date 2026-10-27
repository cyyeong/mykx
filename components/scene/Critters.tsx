"use client";

// Ambient critters that live on top of a scene's art (screen-positioned, so they show wherever the UI leaves
// room): fireflies or lanterns that each sing one note of the pack's scale when tapped (so taps make tunes),
// and a dragonfly that crosses now and then and loops when caught. Pointer-only and cosmetic: the scene's
// hotspots are the keyboard path.
import { useState, type CSSProperties } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import type { PackId } from "@/components/theme/packs";
import "./critters.css";

/** Where each glow floats (vw/vh-ish percentages of the critter layer), kept to the screen's edges and gaps. */
const SPOTS = [
  [4, 22], [10, 62], [3, 84], [36, 30], [40, 70], [62, 6], [96, 18], [93, 58], [97, 88], [52, 92],
];

export function Critters({
  pack,
  kind = "firefly",
  count = 7,
  dragonfly = false,
  className = "",
}: {
  pack: PackId;
  kind?: "firefly" | "lantern" | "spark";
  count?: number;
  dragonfly?: boolean;
  className?: string;
}) {
  const { prop } = useSound();
  // Each tap remounts that glow with a new flight; `v` varies the direction.
  const [zips, setZips] = useState<Record<number, { n: number; v: number }>>({});
  const [loop, setLoop] = useState(0);

  const tap = (i: number) => {
    prop("chime", { pack, step: i });
    setZips((z) => ({ ...z, [i]: { n: (z[i]?.n ?? 0) + 1, v: Math.random() } }));
  };

  return (
    <div className={`cr-layer ${className}`} aria-hidden="true">
      {SPOTS.slice(0, count).map(([x, y], i) => {
        const z = zips[i];
        return (
          <button
            key={`${i}-${z?.n ?? 0}`}
            type="button"
            tabIndex={-1}
            className={`cr-glow cr-${kind} ${z ? "cr-zip" : ""}`}
            style={{ left: `${x}%`, top: `${y}%`, "--d": `${-((i * 1.7) % 6)}s`, "--v": z?.v ?? 0.5 } as CSSProperties}
            onClick={() => tap(i)}
          >
            <span />
          </button>
        );
      })}
      {dragonfly && (
        <button
          key={loop}
          type="button"
          tabIndex={-1}
          className={`cr-dragonfly ${loop ? "cr-loop" : ""}`}
          onClick={() => {
            prop("flutter", { pack });
            setLoop((l) => l + 1);
          }}
        >
          <svg viewBox="0 0 64 32">
            <g className="cr-wings">
              <ellipse cx="26" cy="9" rx="14" ry="5" fill="rgba(210,240,255,.75)" stroke="#9FD9E8" strokeWidth=".8" transform="rotate(-14 26 9)" />
              <ellipse cx="38" cy="9" rx="14" ry="5" fill="rgba(210,240,255,.75)" stroke="#9FD9E8" strokeWidth=".8" transform="rotate(14 38 9)" />
            </g>
            <rect x="8" y="14" width="40" height="4" rx="2" fill="#2C7A8A" />
            <circle cx="50" cy="16" r="5" fill="#1C6C84" />
            <circle cx="52" cy="14.5" r="1.6" fill="#FFF" />
          </svg>
        </button>
      )}
    </div>
  );
}
