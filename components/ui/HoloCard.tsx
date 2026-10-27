"use client";

import type { PointerEvent } from "react";
import { Art } from "./Art";

export type HoloCardProps = {
  /** Card art without extension, e.g. "/art/cards/light-and-shadows". */
  art: string;
  alt: string;
  /** Subject chip, e.g. "P4 Science". */
  chip: string;
  title: string;
  /** What was earned and why, from the reward ledger. Never random-rarity language. */
  note: string;
  className?: string;
  sizes?: string;
};

const TILT = ["--mx", "--my", "--rx", "--ry"] as const;
const MAX_TILT_DEG = 10;

/**
 * A collectible reward card (`mk-holo`): the foil and glare follow the pointer and the card tilts up to
 * 10°. Tilt is written straight to CSS variables, so moving the pointer never re-renders React.
 * Reduced motion keeps the card flat (components.css); the foil still follows.
 */
export function HoloCard({ art, alt, chip, title, note, className, sizes = "248px" }: HoloCardProps) {
  function move(e: PointerEvent<HTMLElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--ry", `${((x - 0.5) * 2 * MAX_TILT_DEG).toFixed(1)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 2 * MAX_TILT_DEG).toFixed(1)}deg`);
    el.style.boxShadow = "var(--shadow-raised), var(--shadow-glow)";
  }

  function leave(e: PointerEvent<HTMLElement>) {
    const el = e.currentTarget;
    for (const prop of TILT) el.style.removeProperty(prop);
    el.style.removeProperty("box-shadow");
  }

  return (
    <article className={["mk-holo", className].filter(Boolean).join(" ")} onPointerMove={move} onPointerLeave={leave}>
      <div className="mk-holo__art">
        <Art base={art} alt={alt} sizes={sizes} />
      </div>
      <div className="mk-holo__foil" />
      <div className="mk-holo__glare" />
      <div className="mk-holo__meta">
        <span className="mk-holo__chip">{chip}</span>
        <h2 className="mk-holo__title">{title}</h2>
        <p className="mk-holo__note">{note}</p>
      </div>
    </article>
  );
}
