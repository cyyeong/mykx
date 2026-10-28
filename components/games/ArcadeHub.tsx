"use client";

// The Arcade (board Arcade; GAMES.md §2): cabinets for the games that fit the child's band and level, each with
// its syllabus tag, their stage and stars, over the living space scene. Games count toward screen time, shown up
// top. Stars come from how you play, never luck; personal bests only (rule 5).
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { Art } from "@/components/ui/Art";
import { LivingArt } from "@/components/scene/LivingArt";
import type { LivingArtData } from "@/lib/scene/livingArt";
import type { Cabinet } from "@/lib/games/server";
import space from "@/public/art/living/space.json";
import { SpaceAmbience } from "./SpaceAmbience";
import "./arcade.css";

/** A taste of each game on its cabinet screen, in the child's own level's words. */
const WORDS: Record<string, Record<string, [string, number, number][]>> = {
  "star-typer": { P3: [["frog", 14, 22], ["pond", 58, 40]], P6: [["habitat", 12, 22], ["gravity", 56, 40]], "Sec 2": [["voltage", 12, 22], ["element", 56, 40]] },
  "word-garden": { P3: [["tadpole", 20, 30]], P6: [["germination", 16, 30]], "Sec 2": [["embryo", 26, 30]] },
  "neon-strike": { P3: [["magnet", 32, 34]], P6: [["friction", 30, 34]], "Sec 2": [["current", 30, 34]] },
  "number-dash": { P3: [["7 × 8", 36, 30]], P6: [["3/4 of 20", 28, 30]], "Sec 2": [["2x + 5", 34, 30]] },
  "stroke-quest": { P3: [["写", 44, 28]], P6: [["书", 44, 28]], "Sec 2": [["学", 44, 28]] },
  "ratio-rescue": { P3: [["12 ÷ 3", 34, 30]], P6: [["3 : 5", 38, 30]], "Sec 2": [["4 : 7", 38, 30]] },
  "circuit-builder": { P3: [["N  S", 40, 30]], P6: [["bulb", 40, 30]], "Sec 2": [["R = V / I", 26, 30]] },
};

export function ArcadeHub({ nickname, band, level, cabinets, playMin, allowance }: { nickname: string; band: "junior" | "teen"; level: string; cabinets: Cabinet[]; playMin: number; allowance: number }) {
  const [filter, setFilter] = useState<"all" | "typing" | "subjects">("all");
  const teen = band === "teen";
  const shown = cabinets.filter((c) => filter === "all" || (filter === "typing" ? c.kind === "typing" : c.kind !== "typing"));
  const kixLine = teen ? `Every game here uses your own ${level} words and questions. Warm up with Neon Strike?` : `These games use your own spelling and science words. Ready to fly, ${nickname}?`;
  return (
    <div className="ar-root" data-theme="dreamlight" data-band={band} data-variant={band}>
      <Art base="/art/games/space" alt="" className="ar-bg" sizes="100vw" />
      <LivingArt data={space as LivingArtData} ox="50%" oy="50%" />
      <div className="ar-veil" />
      <SpaceAmbience />
      <div className="ar-wrap">
        <header className="ar-head">
          <Link className="ar-chip" href="/home">
            ‹ Home
          </Link>
          <h1 className="ar-h1">Arcade</h1>
          <span className="ar-chip">
            {nickname} · {level}
          </span>
          <span className="ar-chip" title="Games count toward screen time">
            Play today: {playMin} of {allowance} min
          </span>
          <div className="ar-kix">
            <Art base={teen ? "/art/kix/anime-sky" : "/art/kix/terrarium"} alt="" sizes="72px" />
            <p>{kixLine}</p>
          </div>
        </header>
        <div className="ar-tabs" role="group" aria-label="Show">
          {(
            [
              ["all", "All games"],
              ["typing", "Typing"],
              ["subjects", "Subjects"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="ar-grid">
          {shown.map((g) => {
            const inner = (
              <>
                <div className="ar-marquee">{g.name}</div>
                <div className="ar-screen">
                  <Art base={g.art} alt="" sizes="(max-width: 599px) 50vw, 300px" />
                  {(WORDS[g.id]?.[level] ?? WORDS[g.id]?.P3 ?? []).map(([t, x, y]) => (
                    <span key={t} className="ar-word" style={{ left: `${x}%`, top: `${y}%` } as CSSProperties}>
                      {t}
                    </span>
                  ))}
                  <span className="ar-blink">{g.soon ? "COMING SOON" : "PRESS START"}</span>
                </div>
                <div className="ar-body">
                  <span className="ar-tag">{g.tag}</span>
                  <p className="ar-desc">{g.pitch}</p>
                  <div className="ar-prog">
                    <span>{g.stage}</span>
                    <span>{g.stars}</span>
                  </div>
                </div>
              </>
            );
            return g.href ? (
              <Link key={g.id} className="ar-cab" href={g.href} data-soon="no" aria-label={`${g.name}. ${g.tag}. ${g.stage}. ${g.stars}`}>
                {inner}
              </Link>
            ) : (
              <div key={g.id} className="ar-cab" data-soon="yes" aria-label={`${g.name}. ${g.tag}. Coming soon`}>
                {inner}
              </div>
            );
          })}
        </div>
        <footer className="ar-foot">
          <span>
            <strong>Stars come from how you play, never luck.</strong> Your best is only compared with your own best.
          </span>
        </footer>
      </div>
    </div>
  );
}
