"use client";

// The teen study room (art: /art/scenes/study-room, plus two Muse Image edits of the same framing: lamp off,
// drawer open). Poke the lamp, the window, the drawer, the headphones, the plant or the cactus.
import { useState, type CSSProperties } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import type { PackId } from "@/components/theme/packs";
import { Hotspot, LivingScene, SceneLayer, boxStyle, useBursts, useLocalHour, useSceneFlag, useVariety, type Box } from "../LivingScene";
import "./studyRoom.css";

const ASPECT = 1600 / 1067;
const SPOTS = {
  lamp: { x: 9, y: 49, w: 12.5, h: 16 },
  window: { x: 25, y: 14, w: 25, h: 54 },
  drawer: { x: 21, y: 87, w: 22, h: 13 },
  headphones: { x: 12.5, y: 78.5, w: 7.5, h: 8 },
  plant: { x: 20.5, y: 63, w: 7, h: 15 },
  cactus: { x: 0.5, y: 2, w: 5, h: 13 },
} satisfies Record<string, Box>;
/** The main window panes (the mullion is masked out in CSS), where sky events happen. */
const PANES: Box = { x: 24.6, y: 13.4, w: 25.9, h: 55.4 };

const NOTES = [
  "Small steps still count.",
  "Future you says thanks.",
  "Breaks are part of the plan.",
  "Curiosity beats perfect.",
  "Water first. Then crush it.",
  "You've done more than you think.",
];
type Sky = "star" | "birds" | "plane" | "firework" | "moon" | "lights";
type Fx = Sky | "note" | "notes" | "leaf" | "bug" | "spark" | "flicker";

export function StudyRoom({ pack, className = "" }: { pack: PackId; className?: string }) {
  const { prop } = useSound();
  const { pick, chance } = useVariety();
  const { bursts, fire } = useBursts<Fx>();
  const hour = useLocalHour();
  const [lamp, setLamp] = useSceneFlag("mykx.scene.study.lamp", true);
  const [drawer, setDrawer] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [bloom, setBloom] = useState(false);

  const toggleLamp = () => {
    prop("click", { pack });
    if (!lamp && chance(0.35)) fire("flicker", 800);
    setLamp(!lamp);
  };

  const poke = (kind: Sky) => {
    const ms = { star: 2200, birds: 5200, plane: 5600, firework: 2600, moon: 7000, lights: 3200 }[kind];
    fire(kind, ms, Math.random());
    if (kind === "birds" || kind === "plane") prop("flutter", { pack });
    else if (kind === "firework") prop("pop", { pack });
    else prop("chime", { pack, step: pick("sky-note", 5) });
  };
  const lookOut = () => {
    // Dusk and night favour stars, fireworks and the moon; daytime favours birds and paper planes.
    const night = hour === null || hour >= 18 || hour < 6;
    const pool: Sky[] = night ? ["star", "firework", "moon", "lights", "birds", "star"] : ["birds", "plane", "birds", "lights", "star", "plane"];
    poke(pool[pick("sky", pool.length)]);
  };

  const toggleDrawer = () => {
    prop("creak", { pack });
    if (!drawer) {
      if (chance(0.6)) window.setTimeout(() => fire("spark", 1400), 380);
      window.setTimeout(() => fire("note", 3600, pick("note", NOTES.length)), 520);
    }
    setDrawer(!drawer);
  };

  const listen = () => {
    if (playing) return;
    setPlaying(true);
    prop("beat", { pack });
    fire("notes", 6200, Math.random());
    window.setTimeout(() => setPlaying(false), 6200);
  };

  const rustle = () => {
    prop("rustle", { pack });
    fire(pick("plant", 2) ? "leaf" : "bug", 4200, Math.random());
  };

  const cactus = () => {
    prop("pop", { pack });
    if (!bloom) setBloom(true);
    else fire("spark", 1400, 1);
  };

  const flickering = bursts.some((b) => b.kind === "flicker");

  return (
    <LivingScene art="/art/scenes/study-room" aspect={ASPECT} className={className}>
      <SceneLayer art="/art/scenes/study-room-lamp-off" visible={!lamp} className={flickering ? "sr-flicker" : ""} mask="linear-gradient(90deg, #000 50%, transparent 58%)" />
      <span className="ls-fx sr-glow" data-on={lamp ? "yes" : "no"} aria-hidden="true" />
      <SceneLayer art="/art/scenes/study-room-drawer" visible={drawer} className={`sr-drawer ${lamp ? "" : "sr-dim"}`} mask="radial-gradient(ellipse 13% 11% at 32.5% 92%, #000 70%, transparent 100%)" />
      {bloom && <span className="ls-fx sr-bloom" aria-hidden="true" />}

      <div className="ls-clip sr-panes" style={boxStyle(PANES)} aria-hidden="true">
        {bursts.map((b) => {
          const v = { "--v": b.v } as CSSProperties;
          if (b.kind === "star") return <span key={b.id} className="sr-star" style={v} />;
          if (b.kind === "birds")
            return (
              <span key={b.id} className="sr-birds" style={v}>
                {[0, 1, 2].map((i) => (
                  <svg key={i} viewBox="0 0 24 12" className="sr-bird" style={{ "--i": i } as CSSProperties}>
                    <path d="M1 7q5-6 11 0q6-6 11 0" fill="none" stroke="#2A2440" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ))}
              </span>
            );
          if (b.kind === "plane")
            return (
              <svg key={b.id} viewBox="0 0 32 16" className="sr-plane" style={v}>
                <path d="M1 9 31 1 12 15l-2-5z" fill="#FFFDF5" stroke="#B9A7F5" strokeWidth="1" strokeLinejoin="round" />
                <path d="M10 10 31 1" stroke="#B9A7F5" strokeWidth="1" />
              </svg>
            );
          if (b.kind === "firework")
            return (
              <span key={b.id} className="sr-firework" style={v}>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} style={{ "--a": `${i * 30}deg` } as CSSProperties} />
                ))}
              </span>
            );
          if (b.kind === "moon") return <span key={b.id} className="sr-moon" style={v} />;
          if (b.kind === "lights")
            return (
              <span key={b.id} className="sr-lights">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} style={{ left: `${8 + ((i * 37 + b.v * 50) % 84)}%`, top: `${50 + ((i * 23 + b.v * 30) % 40)}%`, animationDelay: `${i * 0.18}s` }} />
                ))}
              </span>
            );
          return null;
        })}
      </div>

      {bursts.map((b) => {
        if (b.kind === "note")
          return (
            <span key={b.id} className="ls-note sr-note">
              {NOTES[b.v]}
            </span>
          );
        if (b.kind === "spark") return <span key={b.id} className={`ls-fx sr-spark ${b.v ? "sr-spark--cactus" : ""}`} aria-hidden="true" />;
        if (b.kind === "notes")
          return (
            <span key={b.id} className="ls-fx sr-music" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <svg key={i} viewBox="0 0 24 24" style={{ "--i": i, "--s": (i % 2 ? -1 : 1) * (8 + b.v * 10) } as CSSProperties}>
                  <path d={i % 2 ? "M9 18V6l10-2v12" : "M12 18V5l6 2"} fill="none" stroke="#FFE38A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={i % 2 ? 7 : 10} cy="18" r="2.5" fill="#FFE38A" />
                  {i % 2 ? <circle cx="17" cy="16" r="2.5" fill="#FFE38A" /> : null}
                </svg>
              ))}
            </span>
          );
        if (b.kind === "leaf")
          return (
            <svg key={b.id} viewBox="0 0 20 20" className="ls-fx sr-leaf" style={{ "--v": b.v } as CSSProperties} aria-hidden="true">
              <path d="M3 17C3 8 9 3 17 3c0 8-5 14-14 14z" fill="#6E9B4A" />
              <path d="M4 16 15 5" stroke="#3F6B2C" strokeWidth="1.2" />
            </svg>
          );
        if (b.kind === "bug")
          return (
            <svg key={b.id} viewBox="0 0 20 20" className="ls-fx sr-bug" aria-hidden="true">
              <ellipse cx="10" cy="11" rx="6" ry="6.5" fill="#D8362B" />
              <path d="M10 4.5v13" stroke="#2A1A14" strokeWidth="1.2" />
              <circle cx="10" cy="4.5" r="2.6" fill="#2A1A14" />
              <circle cx="7.5" cy="9.5" r="1.2" fill="#2A1A14" />
              <circle cx="12.5" cy="12.5" r="1.2" fill="#2A1A14" />
              <circle cx="7.8" cy="14" r="1" fill="#2A1A14" />
            </svg>
          );
        return null;
      })}

      <Hotspot box={SPOTS.lamp} label={lamp ? "Turn the desk lamp off" : "Turn the desk lamp on"} pressed={lamp} onTap={toggleLamp} />
      <Hotspot box={SPOTS.window} label="Look out of the window" onTap={lookOut} />
      <Hotspot box={SPOTS.drawer} label={drawer ? "Close the desk drawer" : "Open the desk drawer"} pressed={drawer} onTap={toggleDrawer} />
      <Hotspot box={SPOTS.headphones} label="Put on the headphones" onTap={listen} round />
      <Hotspot box={SPOTS.plant} label="Touch the plant" onTap={rustle} round />
      <Hotspot box={SPOTS.cactus} label="Poke the cactus" onTap={cactus} round />
    </LivingScene>
  );
}
