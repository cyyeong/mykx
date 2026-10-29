"use client";

// "Who's learning?": a door per kid on a family device, ported from the KidDoors board (canvas row 9).
// Junior kids get the storybook door, teens the glass portal; their own world's Kix peeks out from behind it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { DEFAULT_SECRET_KIND, type Door } from "@/lib/auth/schemas";
import type { LivingArtData } from "@/lib/scene/livingArt";
import twilightCity from "@/public/art/living/city-twilight.json";
import { LOOKS, kixSprite, lookFor } from "./looks";
import "./kidDoors.css";

const STARS: [number, number, number, number, number?][] = [
  [6, 8, 3, -0.4, 3.1], [15, 21, 2, -1.9], [24, 5, 3, -2.6, 4], [33, 15, 2, -0.9], [43, 3, 2, -3.1, 2.8], [57, 11, 3, -1.3],
  [66, 23, 2, -2.2, 3.8], [74, 6, 3, -0.2], [85, 17, 2, -1.6, 2.9], [93, 8, 3, -2.9], [51, 26, 2, -0.7, 4.3], [20, 31, 2, -3.4], [80, 30, 2, -1.1, 3.6],
];
const SPARKS: [number, number, number, number, number?][] = [[11, 13, 18, -1], [62, 4, 14, -2.7, 3.6], [89, 25, 16, -0.3, 5], [37, 24, 12, -3.3]];
const LANTERNS: CSSProperties[] = [
  { left: "12%", "--kd-still": "-60vh", animationDuration: "28s", animationDelay: "-7s" } as CSSProperties,
  { left: "79%", "--kd-still": "-44vh", animationDuration: "24s", animationDelay: "-16s" } as CSSProperties,
  { left: "46%", "--kd-still": "-72vh", width: 12, height: 17, animationDuration: "32s", animationDelay: "-22s" } as CSSProperties,
];

const arrow = <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />;

export function KidDoors({ grownUp, kids }: { grownUp: string; kids: Door[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { prop } = useSound();

  // The sky answers taps: lanterns sing a note, the flying Kix loops (decorative, pointer only).
  const onSkyTap = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tap]");
    if (!el) return;
    if (el.dataset.tap === "lantern") prop("chime", { pack: "dreamlight", step: Number(el.dataset.i ?? 0) + 2 });
    else prop("flutter", { pack: "dreamlight" });
    el.classList.remove("kd-tapped");
    void el.offsetWidth;
    el.classList.add("kd-tapped");
  };

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const switchGrownUp = async () => {
    setLeaving(true);
    await fetch("/api/auth/signout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => null);
    router.replace("/signin");
  };

  return (
    <div
      className={`kd-root ${hidden ? "kd-paused" : ""}`}
      data-theme="dreamlight"
      data-band="junior"
      style={{ position: "relative", width: "100%", minHeight: "100dvh", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      <div className="kd-bg">
        <Art base="/art/login/city-twilight" className="kd-bg-img" alt="" fetchPriority="high" />
        <LivingArt data={twilightCity as LivingArtData} oy="85%" />
      </div>
      <div
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(14, 12, 43, 0.74) 0%, rgba(14, 12, 43, 0.38) 22%, rgba(14, 12, 43, 0) 44%, rgba(14, 12, 43, 0) 66%, rgba(14, 12, 43, 0.44) 100%)" }}
      />
      {/* The living city */}
      <div className="kd-sky" aria-hidden="true" onClick={onSkyTap}>
        {STARS.map(([x, y, s, d, u], i) => (
          <span key={i} className="kd-star kd-anim" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${d}s`, animationDuration: u ? `${u}s` : undefined }} />
        ))}
        {SPARKS.map(([x, y, s, d, u], i) => (
          <svg key={i} className="kd-spark kd-anim" viewBox="0 0 24 24" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${d}s`, animationDuration: u ? `${u}s` : undefined }}>
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 2v20M2 12h20M8.5 8.5l7 7M15.5 8.5l-7 7" />
          </svg>
        ))}
        <span className="kd-shoot kd-anim" />
        {LANTERNS.map((style, i) => (
          <span key={i} className="kd-lantern kd-anim kd-tap" data-tap="lantern" data-i={i} style={style} />
        ))}
        <div className="kd-fly kd-anim kd-tap" data-tap="flyer">
          <span className="kd-trail" />
          <span className="kd-trail-dot" style={{ top: "38%", right: "112%", width: 5, height: 5 }} />
          <span className="kd-trail-dot" style={{ top: "60%", right: "150%", width: 4, height: 4, opacity: 0.8 }} />
          <span className="kd-trail-dot" style={{ top: "44%", right: "196%", width: 3, height: 3, opacity: 0.6 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/login/kix.webp" className="kd-fly-img kd-anim" alt="" />
        </div>
      </div>

      <div className="kd-wrap">
        <header className="kd-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-on-dark.svg" className="kd-logo" alt="myKx" />
        </header>
        <div className="kd-titles">
          <h1 className="kd-h1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.01em", textShadow: "0 2px 24px rgba(14, 12, 43, 0.7)" }}>
            Who&apos;s learning?
          </h1>
          <p className="kd-who" style={{ margin: 0, background: "var(--surface-glass)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", boxShadow: "inset 0 0 0 1px var(--line)", fontSize: 18, lineHeight: "24px", fontWeight: 700, color: "var(--ink-muted)" }}>
            <span>
              Signed in as <strong style={{ color: "var(--ink)", fontWeight: 800 }}>{grownUp}</strong>
            </span>
            <span className="kd-dot" aria-hidden="true">
              ·
            </span>
            <button className="kd-switch" type="button" onClick={switchGrownUp} disabled={leaving}>
              Switch grown-up
            </button>
          </p>
        </div>

        <ul className="kd-doors" role="list" aria-label="Kids in this family">
          {kids.map((kid) => {
            const id = lookFor((kid.secretKind ?? DEFAULT_SECRET_KIND[kid.band]) === "pictures" ? "junior" : "teen", kid.pack);
            const v = id === "junior" ? "j" : id === "sky" ? "s" : "t";
            const look = LOOKS[id];
            return (
              <li key={kid.id} className="kd-item">
                <Link href={`/doors/${kid.id}`} className="kd-door">
                  <span className={`kd-stage kd-stage-${v}`} aria-hidden="true">
                    <span className={`kd-halo kd-halo-${v}`} />
                    <span className="kd-ground" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={kixSprite(kid.pack)} className="kd-kix" alt="" />
                    <span className={`kd-light kd-light-${v}`} />
                    <span className="kd-leaves">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={look.leafL} className="kd-leaf kd-leaf-l" alt="" draggable="false" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={look.leafR} className="kd-leaf kd-leaf-r" alt="" draggable="false" />
                    </span>
                    <span className={`kd-seam kd-seam-${v}`} />
                  </span>
                  <span className={`kd-plate kd-plate-${v}`}>
                    <span className="kd-plate-text">
                      <span className="kd-sr">Sign in as </span>
                      <span className="kd-name">{kid.nickname}</span>
                      <span className="kd-sr">, </span>
                      <span className={`kd-level kd-level-${v}`}>{kid.level}</span>
                      {kid.locked && <span className="kd-sr">, resting for a minute</span>}
                    </span>
                    <span className="kd-go" aria-hidden="true">
                      <svg viewBox="0 0 24 24">{arrow}</svg>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="kd-item kd-item-add">
            <Link href="/family" className="kd-add">
              <span className="kd-add-arch" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="kd-add-text">
                <span className="kd-add-title">{kids.length ? "Add a kid" : "Add your first kid"}</span>
                <span className="kd-add-note">For grown-ups</span>
              </span>
            </Link>
          </li>
        </ul>

        <footer className="kd-foot">
          <Link href="/family" className="kd-manage">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.2a3 3 0 0 0-2.2-2.9M15.5 4.3a3.5 3.5 0 0 1 0 6.4" />
            </svg>
            <span>Grown-ups: manage your family</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, color: "var(--ink-muted)" }}>
              <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </footer>
      </div>
    </div>
  );
}
