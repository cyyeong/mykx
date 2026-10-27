"use client";

// Ari's terrarium (art: /art/scenes/terrarium). Rustle the fern, tap the glass (sometimes it fogs up and a
// smiley gets drawn in it), fireflies sing notes and a dragonfly loops when caught.
import type { CSSProperties } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import { Critters } from "../Critters";
import { Hotspot, LivingScene, useBursts, useVariety, type Box } from "../LivingScene";
import "./terrarium.css";

const ASPECT = 1600 / 1067;
const FERN: Box = { x: 3, y: 14, w: 20, h: 22 };
const GLASS_L: Box = { x: 0, y: 28, w: 4.5, h: 60 };
const GLASS_R: Box = { x: 95.5, y: 22, w: 4.5, h: 62 };

type Fx = "spores" | "drops" | "shine" | "fog";

export function TerrariumScene({ className = "" }: { className?: string }) {
  const { prop } = useSound();
  const { pick } = useVariety();
  const { bursts, fire } = useBursts<Fx>();

  const fern = () => {
    prop("rustle", { pack: "terrarium" });
    fire(pick("fern", 2) ? "spores" : "drops", 2600, Math.random());
  };
  const glass = (side: number) => {
    prop("tink", { pack: "terrarium" });
    if (pick("glass", 3) === 0) fire("fog", 4200, side);
    else fire("shine", 1500, side);
  };

  return (
    <>
      <LivingScene art="/art/scenes/terrarium" aspect={ASPECT} className={className}>
        {bursts.map((b) => {
          const v = { "--v": b.v } as CSSProperties;
          if (b.kind === "spores")
            return (
              <span key={b.id} className="ls-fx te-spores" style={v} aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} style={{ "--i": i } as CSSProperties} />
                ))}
              </span>
            );
          if (b.kind === "drops")
            return (
              <span key={b.id} className="ls-fx te-drops" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ "--i": i } as CSSProperties} />
                ))}
              </span>
            );
          if (b.kind === "shine") return <span key={b.id} className={`ls-fx te-shine ${b.v ? "te-shine--rtl" : ""}`} aria-hidden="true" />;
          return (
            <span key={b.id} className={`ls-fx te-fog ${b.v ? "te-fog--r" : ""}`} aria-hidden="true">
              <svg viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.4" />
                <circle cx="14.5" cy="16" r="1.8" fill="rgba(255,255,255,.9)" />
                <circle cx="25.5" cy="16" r="1.8" fill="rgba(255,255,255,.9)" />
                <path d="M13 24q7 7 14 0" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>
          );
        })}
        <Hotspot box={FERN} label="Rustle the fern" onTap={fern} />
        <Hotspot box={GLASS_L} label="Tap the glass" onTap={() => glass(0)} />
        <Hotspot box={GLASS_R} label="Tap the glass" onTap={() => glass(1)} />
      </LivingScene>
      <Critters pack="terrarium" dragonfly />
    </>
  );
}
