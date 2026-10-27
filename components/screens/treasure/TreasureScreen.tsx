// Treasure Realm (Junior, Dreamlight): every entry here was earned (nothing is
// random). Cards come from the reward ledger; the constellation lights up only
// on fresh evidence. Task 2 wires the data; the visual spec stays the board's.
import type { CSSProperties } from "react";
import Link from "next/link";
import { Critters } from "@/components/scene/Critters";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import type { LedgerEntry } from "@/lib/domain/rewards";
import type { LivingArtData } from "@/lib/scene/livingArt";
import treasureLiving from "@/public/art/living/treasure-vault.json";
import "./treasureScreen.css";

/** One earned ledger entry, in the child's own words of when and why. */
export interface TreasureCard {
  id: string;
  title: string;
  note: string;
}

/** One constellation node per quest stop: lit only with fresh evidence. */
export interface TreasureNode {
  label: string;
  lit: boolean;
  current: boolean;
}

export interface TreasureProps {
  nickname: string;
  stars: number;
  starsToday: number;
  evidenceLabel: string;
  cards: TreasureCard[];
  nodes: TreasureNode[];
  questHref: string;
  questTitle: string;
}

const RULE_TITLES: Record<string, string> = {
  first_attempt: "First try",
  retry_revised: "Revised retry",
  fresh_transfer: "Fresh transfer",
};

/** One card per paid-out ledger entry (cap notes pay 0, so they never show). Refs render through `labels` so a child never sees an item id. */
export function cardsFromLedger(entries: readonly LedgerEntry[], labels: Record<string, string> = {}): TreasureCard[] {
  return entries
    .filter((e) => e.amount > 0)
    .map((e) => ({
      id: e.key,
      title: RULE_TITLES[e.rule] ?? e.rule,
      note: `${e.at.slice(0, 10)} · +${e.amount} stars${e.ref && labels[e.ref] ? ` · ${labels[e.ref]}` : ""}`,
    }));
}

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

const NODE_X = [24, 92, 168, 236, 298];

export function TreasureScreen({ nickname, stars, starsToday, evidenceLabel, cards, nodes, questHref, questTitle }: TreasureProps) {
  const litPath = nodes
    .map((n, i) => ({ ...n, i }))
    .filter((n) => n.lit)
    .map((n) => n.i);
  const solid = litPath.length > 1 ? `M${litPath.map((i) => `${NODE_X[i]} 70`).join(" L")}` : null;
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
            <h1 className="tr-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600 }}>{nickname}&apos;s Treasure</h1>
            <p className="tr-lede" style={{ margin: 0, fontWeight: 600, color: "var(--ink-muted)" }}>Every card here was earned. Nothing is random.</p>
          </GlassPanel>

          <GlassPanel radius="pill" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 800, color: "var(--reward)" }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
                <path fill="currentColor" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
              </svg>
              {stars} stars
            </span>
            <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 700, color: "var(--ink-muted)" }}>Today {starsToday} of 15</span>
          </GlassPanel>
        </div>

        <div className="tr-cards">
          {cards.length ? (
            cards.map((card) => (
              <GlassPanel key={card.id} className="tr-card" radius="xl" blur={12} style={{ boxSizing: "border-box", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 40, height: 40, color: "var(--reward)" }}>
                  <path fill="currentColor" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
                </svg>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: "26px" }}>{card.title}</span>
                <span className="tr-slot-note" style={{ fontWeight: 600, color: "var(--ink-muted)" }}>{card.note}</span>
              </GlassPanel>
            ))
          ) : (
            <GlassPanel className="tr-card" radius="xl" blur={12} style={{ boxSizing: "border-box", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: "26px" }}>Your first card is waiting in your first quest</span>
              <ButtonLink href={questHref} variant="secondary" style={{ alignSelf: "flex-start" }}>
                Start today&apos;s quest
              </ButtonLink>
            </GlassPanel>
          )}
          <GlassPanel className="tr-slot" ring="control" radius="xl" blur={12} style={{ boxSizing: "border-box" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 56, height: 56, color: "var(--ink-muted)" }}>
              <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
            </svg>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: "26px" }}>Next card</span>
            <span className="tr-slot-note" style={{ fontWeight: 600, color: "var(--ink-muted)" }}>
              Finish the next stop on <Link href={questHref} style={{ color: "var(--accent)", fontWeight: 800 }}>{questTitle}</Link> to earn it.
            </span>
          </GlassPanel>
        </div>

        <div className="tr-base">
          <GlassPanel as="section" className="tr-panel tr-cons" aria-label="Your constellation" style={{ boxSizing: "border-box", padding: "20px 24px", display: "flex", gap: 20 }}>
            <div className="tr-cons-text" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 style={PANEL_TITLE}>Your constellation</h2>
              <p className="tr-cons-p" style={{ margin: 0, fontWeight: 600, color: "var(--ink-muted)" }}>A new line appears when a skill gets fresh evidence. {evidenceLabel}</p>
            </div>
            <svg className="tr-cons-svg" viewBox="0 0 320 150" role="img" aria-label={`${questTitle} constellation: ${nodes.filter((n) => n.lit).length} of ${nodes.length} stops with fresh evidence`} style={{ overflow: "visible" }}>
              <path d="M24 70 L92 70 L168 70 L236 70 L298 70" fill="none" stroke="var(--border-control)" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" />
              {solid && <path d={solid} fill="none" stroke="var(--reward)" strokeWidth="3" strokeLinecap="round" />}
              {nodes.slice(0, NODE_X.length).map((n, i) => (
                <g key={n.label}>
                  <circle
                    cx={NODE_X[i]}
                    cy="70"
                    r={n.current ? 11 : 9}
                    fill={n.lit ? "var(--reward)" : "var(--border-control)"}
                    {...(n.current ? { stroke: "var(--reward)", strokeWidth: 3 } : {})}
                  />
                  <text x={NODE_X[i]} y="100" fill="var(--ink-muted)" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="Nunito, sans-serif">
                    Stop {i + 1}
                  </text>
                </g>
              ))}
            </svg>
          </GlassPanel>

          <GlassPanel as="section" className="tr-panel" aria-label="Your creations" style={{ boxSizing: "border-box", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={PANEL_TITLE}>Your creations</h2>
            <p className="tr-cap" style={{ margin: 0, fontWeight: 600, color: "var(--ink-muted)" }}>
              Things you make in Vibe Zone will live here. Vibe Zone opens in a later quest.
            </p>
          </GlassPanel>
        </div>
      </div>
      <Critters pack="dreamlight" kind="lantern" count={8} />
    </div>
  );
}
