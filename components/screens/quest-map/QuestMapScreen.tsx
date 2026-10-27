// Quest map (Junior, Dreamlight): Ari's frog life cycle from task 2. The stops,
// their states and the panel all come from the server (real mastery and the
// ledger); this component only renders them.
import type { CSSProperties } from "react";
import { Critters } from "@/components/scene/Critters";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { KixBubble } from "@/components/ui/KixBubble";
import type { LivingArtData } from "@/lib/scene/livingArt";
import questMapLiving from "@/public/art/living/quest-map.json";
import { QuestNode, type QuestNodeState } from "@/components/ui/QuestNode";
import "./questMapScreen.css";

export interface MapStop {
  itemId: string;
  label: string;
  state: QuestNodeState;
  /** 0–100 for mastered stops, else null (no score without evidence). */
  mastery: number | null;
}

export interface QuestMapProps {
  questTitle: string;
  levelLabel: string;
  blurb: string;
  stops: MapStop[];
  /** Where "Start today's quest" goes: the first open pick, or the done page. */
  startHref: string;
  startLabel: string;
  sessionCount: number;
  /** Why today's session was picked, e.g. "fresh families first". */
  reason: string | null;
  evidenceLabel: string;
  masteredCount: number;
}

const LABEL_TEXT: CSSProperties = { fontWeight: 800 };

export function QuestMapScreen({ questTitle, levelLabel, blurb, stops, startHref, startLabel, sessionCount, reason, evidenceLabel, masteredCount }: QuestMapProps) {
  return (
    <div
      data-theme="dreamlight"
      data-band="junior"
      className="qm-root"
      style={{ width: "100%", boxSizing: "border-box", position: "relative", overflow: "clip", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      {/* The map's own waterfalls, clouds, grass, crystals and stepping stones move (living art). */}
      <div className="qm-art">
        <Art base="/art/scenes/quest-map" className="qm-art-img" alt="" fetchPriority="high" />
        <LivingArt data={questMapLiving as LivingArtData} />
      </div>

      <div className="qm-wrap">
        <GlassPanel as="header" className="qm-header" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-on-dark.svg" alt="myKx" style={{ height: 26, width: "auto", alignSelf: "flex-start" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "var(--radius-pill)", background: "var(--accent-2)", color: "var(--on-accent-2)", fontSize: 14, lineHeight: "22px", fontWeight: 800 }}>
              {levelLabel}
            </span>
            <h1 className="qm-h1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600 }}>{questTitle}</h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600, color: "var(--ink-muted)" }}>
              {masteredCount} of {stops.length} stops mastered
            </p>
          </div>
        </GlassPanel>

        <div className="qm-trail">
          {stops.map((stop, i) => {
            const n = i + 1;
            return (
              <div key={stop.itemId} className={`qm-stop qm-stop--${n}`}>
                <QuestNode state={stop.state} mastery={stop.mastery ?? 0} className="qm-node" />
                {stop.state === "current" ? (
                  <GlassPanel
                    className={`qm-label qm-label--${n}`}
                    ring="accent"
                    radius="md"
                    blur={12}
                    style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 16px" }}
                  >
                    <span style={{ fontSize: 18, lineHeight: "24px", fontWeight: 800 }}>{stop.label}</span>
                    <span style={{ fontSize: 14, lineHeight: "18px", fontWeight: 600, color: "var(--ink-muted)" }}>Today&apos;s quest · {evidenceLabel}</span>
                  </GlassPanel>
                ) : (
                  <GlassPanel className={`qm-label qm-label--${n}`} ring="none" radius="pill" blur={12} style={{ padding: "6px 14px" }}>
                    <span className="qm-labtxt" style={stop.state === "locked" ? { ...LABEL_TEXT, color: "var(--ink-muted)" } : LABEL_TEXT}>
                      {stop.label}
                      {stop.state === "mastered" && stop.mastery !== null ? ` · ${stop.mastery}` : ""}
                    </span>
                  </GlassPanel>
                )}
              </div>
            );
          })}

          <div className="qm-stop qm-stop--6">
            <div
              className="qm-chest"
              style={{ display: "grid", placeItems: "center", borderRadius: "var(--radius-pill)", background: "var(--surface-glass)", backdropFilter: "blur(12px)", boxShadow: "inset 0 0 0 3px var(--reward), var(--shadow-glow)", color: "var(--reward)" }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 36, height: 36 }}>
                <path fill="currentColor" d="M3 9l2-4h14l2 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm2.3 0h13.4l-1-2H6.3zM5 11v8h14v-8h-5v2h-4v-2z" />
              </svg>
            </div>
            <GlassPanel className="qm-label qm-label--6" ring="none" radius="pill" blur={12} style={{ padding: "6px 14px" }}>
              <span className="qm-labtxt" style={LABEL_TEXT}>End of quest: a new card</span>
            </GlassPanel>
          </div>
        </div>

        <GlassPanel
          as="section"
          className="qm-panel"
          aria-label="Today's quest"
          raised
          radius="xl"
          style={{ boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18 }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Art
              base="/art/kix/dreamlight"
              alt="Kix"
              sizes="72px"
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", flex: "none", boxShadow: "0 0 0 3px var(--accent)" }}
            />
            <KixBubble tail="start" style={{ padding: "12px 16px", fontSize: 18, lineHeight: "26px", fontWeight: 600 }}>
              {reason ? `Ready? ${reason}` : blurb}
            </KixBubble>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 32, lineHeight: "38px" }}>{questTitle}</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600, color: "var(--ink-muted)" }}>
              {sessionCount} questions · about {sessionCount * 3} minutes
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, lineHeight: "22px", fontWeight: 800 }}>
              <span>Quest progress</span>
              <span>
                {masteredCount} / {stops.length} stops
              </span>
            </div>
            <div style={{ height: 12, borderRadius: "var(--radius-pill)", background: "var(--line)", overflow: "hidden" }}>
              <div style={{ width: `${stops.length ? Math.round((masteredCount / stops.length) * 100) : 0}%`, height: 12, borderRadius: "var(--radius-pill)", background: "var(--accent)" }} />
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{evidenceLabel}</p>
          </div>
          <div className="qm-cta">
            <ButtonLink href={startHref} style={{ width: "100%" }}>
              {startLabel}
            </ButtonLink>
          </div>
        </GlassPanel>
      </div>
      <Critters pack="dreamlight" kind="spark" count={8} />
    </div>
  );
}
