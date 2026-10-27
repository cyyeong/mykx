// Treasure Realm (Junior, Dreamlight), ported from docs/design/boards/Treasure.dc.html: scripts/port-board.ts, then
// by hand. Static port with the board's fixture cards. Day 4 reads the cards from the reward ledger.
import type { CSSProperties } from "react";
import { Critters } from "@/components/scene/Critters";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { HoloCard, type HoloCardProps } from "@/components/ui/HoloCard";
import type { LivingArtData } from "@/lib/scene/livingArt";
import treasureLiving from "@/public/art/living/treasure-vault.json";
import "./treasureScreen.css";

/** Every card here was earned (deterministic ledger); the note says when and why. */
const CARDS: (HoloCardProps & { id: string })[] = [
  { id: "kix", art: "/art/kix/dreamlight", alt: "Kix in Dreamlight style, waving", chip: "Sidekick", title: "Kix, Dreamlight", note: "Earned 20 Oct: made your sidekick" },
  { id: "shadows", art: "/art/cards/light-and-shadows", alt: "Kix making a rabbit shadow with a torch", chip: "P4 Science", title: "Light and shadows", note: "Earned 27 Oct: solved a fresh question with no hints" },
];

/** Rising lanterns: horizontal position and start offset (hidden under reduced motion). */
const LANTERNS = [
  ["10.9%", "0s"],
  ["20.3%", "6s"],
  ["32.8%", "11s"],
  ["46.1%", "3s"],
  ["56.3%", "14s"],
  ["68.8%", "8s"],
  ["78.9%", "1.5s"],
  ["89.8%", "10s"],
] as const;

const PANEL_TITLE: CSSProperties = { margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, lineHeight: "28px" };
const POLAROID: CSSProperties = { width: 84, height: 100, flex: "none", boxSizing: "border-box", padding: "8px 8px 22px", borderRadius: 6, background: "#F4F1FF", boxShadow: "var(--shadow-raised)" };
const TEXT_BTN: CSSProperties = { alignSelf: "flex-start" };

export function TreasureScreen() {
  return (
    <div
      data-theme="dreamlight"
      data-band="junior"
      style={{ width: "100%", minHeight: "100vh", boxSizing: "border-box", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      {/* The realm is alive: islands float with their chests, lanterns flicker, the aurora and clouds drift. */}
      <div className="tr-bg">
        <Art base="/art/scenes/treasure-vault" className="tr-bg-img" alt="" fetchPriority="high" />
        <LivingArt data={treasureLiving as LivingArtData} />
      </div>
      <div
        className="tr-aurora"
        aria-hidden="true"
        style={{ position: "absolute", left: "-10%", top: "-10%", width: "120%", height: "55%", mixBlendMode: "screen", opacity: 0.35, background: "linear-gradient(100deg, rgba(0, 0, 0, 0) 10%, var(--kix-mint) 35%, var(--kix-lavender) 55%, rgba(255, 201, 168, 0.8) 70%, rgba(0, 0, 0, 0) 90%)", filter: "blur(40px)" }}
      />
      <div aria-hidden="true">
        {LANTERNS.map(([left, delay]) => (
          <span key={left} className="tr-lantern" style={{ left, animationDelay: delay }} />
        ))}
      </div>

      <div className="tr-wrap">
        <div className="tr-top">
          <GlassPanel as="header" className="tr-head" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "20px 26px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wordmark-on-dark.svg" alt="myKx" style={{ height: 24, width: "auto", alignSelf: "flex-start" }} />
            <h1 className="tr-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600 }}>Ari&apos;s Treasure</h1>
            <p className="tr-lede" style={{ margin: 0, fontWeight: 600, color: "var(--ink-muted)" }}>Every card here was earned. Nothing is random.</p>
          </GlassPanel>

          <GlassPanel radius="pill" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 800, color: "var(--reward)" }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
                <path fill="currentColor" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
              </svg>
              91 stars
            </span>
            <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 700, color: "var(--ink-muted)" }}>Today 7 of 15</span>
          </GlassPanel>
        </div>

        <div className="tr-cards">
          {CARDS.map(({ id, ...card }) => (
            <HoloCard key={id} className="tr-card" sizes="(max-width: 599px) 50vw, (max-width: 1023px) 33vw, 248px" {...card} />
          ))}
          <GlassPanel className="tr-slot" ring="control" radius="xl" blur={12} style={{ boxSizing: "border-box" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 56, height: 56, color: "var(--ink-muted)" }}>
              <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
            </svg>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: "26px" }}>Shadow size</span>
            <span className="tr-slot-note" style={{ fontWeight: 600, color: "var(--ink-muted)" }}>Finish the Shadow size stop on your quest to earn this card.</span>
          </GlassPanel>
        </div>

        <div className="tr-base">
          <GlassPanel as="section" className="tr-panel tr-cons" aria-label="Your constellation" style={{ boxSizing: "border-box", padding: "20px 24px", display: "flex", gap: 20 }}>
            <div className="tr-cons-text" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 style={PANEL_TITLE}>Your constellation</h2>
              <p className="tr-cons-p" style={{ margin: 0, fontWeight: 600, color: "var(--ink-muted)" }}>A new line appears when a skill gets fresh evidence.</p>
            </div>
            <svg className="tr-cons-svg" viewBox="0 0 320 150" role="img" aria-label="Light and shadows constellation: two skills mastered, Shadows in progress, two to go" style={{ overflow: "visible" }}>
              <path d="M24 118 L92 70 L168 92" fill="none" stroke="#FFE38A" strokeWidth="3" strokeLinecap="round" />
              <path d="M168 92 L236 40 L298 74" fill="none" stroke="#8F87CF" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
              <circle cx="24" cy="118" r="9" fill="#FFE38A" />
              <circle cx="92" cy="70" r="9" fill="#FFE38A" />
              <circle cx="168" cy="92" r="11" fill="#B9A7F5" stroke="#FFE38A" strokeWidth="3" />
              <circle cx="236" cy="40" r="6" fill="#8F87CF" />
              <circle cx="298" cy="74" r="6" fill="#8F87CF" />
              <text x="24" y="144" fill="#C6BFEE" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="Nunito, sans-serif">Sources</text>
              <text x="92" y="52" fill="#C6BFEE" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="Nunito, sans-serif">Lines</text>
              <text x="168" y="124" fill="#F4F1FF" fontSize="13" fontWeight="800" textAnchor="middle" fontFamily="Nunito, sans-serif">Shadows</text>
              <text x="236" y="22" fill="#C6BFEE" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="Nunito, sans-serif">See-through</text>
              <text x="298" y="100" fill="#C6BFEE" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="Nunito, sans-serif">Size</text>
            </svg>
          </GlassPanel>

          <GlassPanel as="section" className="tr-panel" aria-label="Your creations" style={{ boxSizing: "border-box", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={PANEL_TITLE}>Your creations</h2>
            <div className="tr-shelf">
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div aria-hidden="true" style={{ ...POLAROID, transform: "rotate(-4deg)" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "var(--surface-raised)", display: "flex", flexDirection: "column", gap: 5, padding: 6, boxSizing: "border-box" }}>
                    <span style={{ height: 6, width: "70%", borderRadius: 3, background: "var(--accent)" }} />
                    <span style={{ height: 6, width: "90%", borderRadius: 3, background: "var(--line)" }} />
                    <span style={{ height: 6, width: "60%", borderRadius: 3, background: "var(--accent-2)" }} />
                    <span style={{ height: 6, width: "80%", borderRadius: 3, background: "var(--line)" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 18, lineHeight: "24px", fontWeight: 800 }}>Revision planner</span>
                  <span className="tr-cap" style={{ fontWeight: 600, color: "var(--ink-muted)" }}>Version 2 · shared with Mum</span>
                  {/* Day 5: share and revoke. */}
                  <button className="tr-text-btn" type="button" style={TEXT_BTN}>Stop sharing</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div aria-hidden="true" style={{ ...POLAROID, transform: "rotate(3deg)" }}>
                  <div style={{ height: "100%", borderRadius: 3, overflow: "hidden" }}>
                    <Art base="/art/cards/light-and-shadows" alt="" sizes="68px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 18, lineHeight: "24px", fontWeight: 800 }}>Shadow flashcards</span>
                  <span className="tr-cap" style={{ fontWeight: 600, color: "var(--ink-muted)" }}>Version 1 · only you</span>
                  <button className="tr-text-btn" type="button" style={TEXT_BTN}>Share with family</button>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
      <Critters pack="dreamlight" kind="lantern" count={8} />
    </div>
  );
}
