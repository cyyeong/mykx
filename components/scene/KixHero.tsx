"use client";

// Tap Kix: a hop, a spin, a wiggle or a squish, and a short line (a hint, a hello or a true critter fact).
// Cosmetic only; it never changes anything a child earns.
import { useState, type CSSProperties } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import type { PackId } from "@/components/theme/packs";
import { Art } from "@/components/ui/Art";
import { useVariety } from "./LivingScene";
import "./kixHero.css";

const MOVES = ["hop", "spin", "wiggle", "squish"] as const;
const LINES = [
  "Hee hee! That tickles!",
  "Psst… the fireflies can sing. Tap them!",
  "Frogs don't sip water. They soak it up through their skin!",
  "Tadpoles breathe with gills, like little fish.",
  "Ready when you are, explorer!",
  "Try tapping the glass…",
];

export function KixHero({ base, alt, pack, className, sizes, style }: { base: string; alt: string; pack: PackId; className?: string; sizes?: string; style?: CSSProperties }) {
  const { prop } = useSound();
  const { pick } = useVariety();
  const [react, setReact] = useState<{ n: number; move: string; line: string } | null>(null);

  const tap = () => {
    const move = MOVES[pick("move", MOVES.length)];
    prop(move === "squish" ? "pop" : "chime", { pack, step: pick("note", 5) + 2 });
    setReact((r) => ({ n: (r?.n ?? 0) + 1, move, line: LINES[pick("line", LINES.length)] }));
  };

  return (
    <button type="button" className="kh-btn" onClick={tap} aria-label={`${alt}. Tap to say hi.`}>
      <span key={react?.n ?? 0} className={`kh-move ${react ? `kh-${react.move}` : ""}`}>
        <Art base={base} alt="" className={className} sizes={sizes} style={style} />
      </span>
      {react && (
        <span key={`l${react.n}`} className="kh-line" role="status">
          {react.line}
        </span>
      )}
    </button>
  );
}
