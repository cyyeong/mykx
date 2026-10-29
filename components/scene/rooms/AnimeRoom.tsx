"use client";

// The Anime Sky teen's room (founder, 29 Oct: Abby's own workspace; art: /art/scenes/anime-room, Muse Image, original
// characters only). Gentle and pastel: posters, figurines, plushies and a standee everywhere. Poke the window, the
// lamp, any poster, the shelf, the plushies, the standee, the sketchbook or the headphones. Cosmetic only (never
// rewards), like every living scene.
import type { CSSProperties } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import type { PackId } from "@/components/theme/packs";
import { Hotspot, LivingScene, boxStyle, useBursts, useLocalHour, useSceneFlag, useVariety, type Box } from "../LivingScene";
import "./animeRoom.css";

const ASPECT = 1920 / 1280;
const SPOTS = {
  window: { x: 1, y: 1, w: 33, h: 56 },
  lamp: { x: 35, y: 54, w: 8, h: 12 },
  heroine: { x: 37, y: 5, w: 11, h: 21 },
  catGirl: { x: 49.5, y: 9, w: 9.5, h: 17 },
  pilot: { x: 43, y: 27, w: 9, h: 16 },
  bigPoster: { x: 65, y: 6, w: 18.5, h: 42 },
  shelf: { x: 86, y: 28, w: 14, h: 23 },
  plushies: { x: 57, y: 51, w: 23, h: 18 },
  standee: { x: 88, y: 54, w: 11, h: 40 },
  sketchbook: { x: 1, y: 73, w: 24, h: 15 },
  headphones: { x: 26, y: 67, w: 11, h: 10 },
} satisfies Record<string, Box>;
type Spot = keyof typeof SPOTS;
const ORDER = Object.keys(SPOTS) as Spot[];

/** What the characters on the wall say: small, warm, never about scores. */
const CHEERS = [
  "You've got this!",
  "One page at a time.",
  "Believe in future you.",
  "Water break, hero!",
  "Ten more minutes, then a doodle.",
  "Mistakes are just sketches.",
  "Curious is a superpower.",
];
const STANDEE = ["Study buddy reporting in!", "I'll guard your desk.", "Wave back!", "Nice focus today."];
const SKETCH = ["New idea: Kix as a magical girl.", "Draw the answer as a comic?", "Sketch break after this bit."];

type Fx = "petals" | "shoot" | "sparkle" | "say" | "hearts" | "notes" | "hop";
const at = (spot: Spot, dx = 0.5, dy = 0.3): CSSProperties => {
  const b = SPOTS[spot];
  return { left: `${b.x + b.w * dx}%`, top: `${b.y + b.h * dy}%` };
};

export function AnimeRoom({ pack, className = "" }: { pack: PackId; className?: string }) {
  const { prop } = useSound();
  const { pick, chance } = useVariety();
  const { bursts, fire } = useBursts<Fx>();
  const hour = useLocalHour();
  const [lamp, setLamp] = useSceneFlag("mykx.scene.anime.lamp", true);

  // v packs which spot (and which line) a burst belongs to: spot index * 100 + line index.
  const say = (spot: Spot, lines: readonly string[], key: string) => {
    fire("sparkle", 1400, ORDER.indexOf(spot) * 100);
    fire("say", 3400, ORDER.indexOf(spot) * 100 + pick(key, lines.length));
  };
  const poster = (spot: Spot) => {
    prop("chime", { pack, step: pick("poster-note", 5) });
    if (chance(0.3)) fire("hearts", 2600, ORDER.indexOf(spot) * 100);
    say(spot, CHEERS, "cheer");
  };
  const lookOut = () => {
    const night = hour === null || hour >= 18 || hour < 6;
    if (night && chance(0.5)) {
      prop("tink", { pack });
      fire("shoot", 1800, Math.random() * 100);
    } else {
      prop("flutter", { pack });
      fire("petals", 4200, Math.random() * 100);
    }
  };
  const toggleLamp = () => {
    prop("click", { pack });
    setLamp(!lamp);
  };
  const shelf = () => {
    prop("chime", { pack, step: pick("shelf-note", 5) });
    fire("hop", 1200, ORDER.indexOf("shelf") * 100);
    fire("sparkle", 1400, ORDER.indexOf("shelf") * 100);
  };
  const squish = () => {
    prop("pop", { pack });
    fire("hearts", 2600, ORDER.indexOf("plushies") * 100);
  };
  const listen = () => {
    prop("beat", { pack });
    fire("notes", 5200, ORDER.indexOf("headphones") * 100);
  };

  const sayLine = (v: number) => {
    const spot = ORDER[Math.floor(v / 100)];
    const i = v % 100;
    return spot === "standee" ? STANDEE[i] : spot === "sketchbook" ? SKETCH[i] : CHEERS[i];
  };

  return (
    <LivingScene art="/art/scenes/anime-room" aspect={ASPECT} className={className}>
      <span className="ls-fx ar-glow" data-on={lamp ? "yes" : "no"} aria-hidden="true" />
      <span className="ls-fx ar-dim" data-on={lamp ? "no" : "yes"} aria-hidden="true" />

      <div className="ls-clip ar-window" style={boxStyle(SPOTS.window)} aria-hidden="true">
        {bursts.map((b) => {
          if (b.kind === "petals")
            return (
              <span key={b.id} className="ar-petals" style={{ "--v": b.v / 100 } as CSSProperties}>
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} style={{ "--i": i } as CSSProperties} />
                ))}
              </span>
            );
          if (b.kind === "shoot") return <span key={b.id} className="ar-shoot" style={{ "--v": b.v / 100 } as CSSProperties} />;
          return null;
        })}
      </div>

      {bursts.map((b) => {
        const spot = ORDER[Math.floor(b.v / 100)];
        if (b.kind === "sparkle") return <span key={b.id} className="ls-fx ar-sparkle" style={at(spot, 0.5, 0.25)} aria-hidden="true" />;
        if (b.kind === "say")
          return (
            <span key={b.id} className="ls-note ar-say" style={at(spot, 0.5, 0.05)}>
              {sayLine(b.v)}
            </span>
          );
        if (b.kind === "hearts")
          return (
            <span key={b.id} className="ls-fx ar-hearts" style={at(spot, 0.5, 0.3)} aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <svg key={i} viewBox="0 0 24 24" style={{ "--i": i } as CSSProperties}>
                  <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.3 5 6.6 5c2.1 0 3.6 1.2 4.4 2.5C11.8 6.2 13.3 5 15.4 5 18.7 5 21 8.3 19.5 11.8 17.5 16.4 12 21 12 21z" fill={i % 2 ? "#F7B6CF" : "#FFD3E3"} />
                </svg>
              ))}
            </span>
          );
        if (b.kind === "notes")
          return (
            <span key={b.id} className="ls-fx ar-notes" style={at(spot, 0.5, 0)} aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <svg key={i} viewBox="0 0 24 24" style={{ "--i": i } as CSSProperties}>
                  <path d={i % 2 ? "M9 18V6l10-2v12" : "M12 18V5l6 2"} fill="none" stroke="#B9A7F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={i % 2 ? 7 : 10} cy="18" r="2.5" fill="#B9A7F5" />
                  {i % 2 ? <circle cx="17" cy="16" r="2.5" fill="#B9A7F5" /> : null}
                </svg>
              ))}
            </span>
          );
        if (b.kind === "hop") return <span key={b.id} className="ls-fx ar-hop" style={boxStyle(SPOTS.shelf)} aria-hidden="true" />;
        return null;
      })}

      <Hotspot box={SPOTS.window} label="Look out of the window" onTap={lookOut} />
      <Hotspot box={SPOTS.lamp} label={lamp ? "Turn the lamp off" : "Turn the lamp on"} pressed={lamp} onTap={toggleLamp} round />
      <Hotspot box={SPOTS.heroine} label="Tap the magical girl poster" onTap={() => poster("heroine")} />
      <Hotspot box={SPOTS.catGirl} label="Tap the cat-eared hero poster" onTap={() => poster("catGirl")} />
      <Hotspot box={SPOTS.pilot} label="Tap the sky pilot poster" onTap={() => poster("pilot")} />
      <Hotspot box={SPOTS.bigPoster} label="Tap the big poster" onTap={() => poster("bigPoster")} />
      <Hotspot box={SPOTS.shelf} label="Tap the figurines" onTap={shelf} />
      <Hotspot box={SPOTS.plushies} label="Squeeze the plushies" onTap={squish} round />
      <Hotspot
        box={SPOTS.standee}
        label="Wave to the standee"
        onTap={() => {
          prop("knock", { pack });
          say("standee", STANDEE, "standee");
        }}
      />
      <Hotspot
        box={SPOTS.sketchbook}
        label="Flip the sketchbook"
        onTap={() => {
          prop("rustle", { pack });
          say("sketchbook", SKETCH, "sketch");
        }}
      />
      <Hotspot box={SPOTS.headphones} label="Put on the headphones" onTap={listen} round />
    </LivingScene>
  );
}
