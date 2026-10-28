// Study deck (Teen), ported from docs/design/boards/StudyDeck.dc.html: scripts/port-board.ts, then by hand.
// The teen landing page: the deck sits over a living study room (lamp, window, drawer...: components/scene).
// The deck's topics and rings are the board's sample week until Day 4 reads mastery from the database.
"use client";

import { useState, type CSSProperties } from "react";
import { GuardianChips } from "@/components/guardian/GuardianChips";
import { StudyRoom } from "@/components/scene/rooms/StudyRoom";
import { getPack, wordmarkFor, type PackId } from "@/components/theme/packs";
import { Art } from "@/components/ui/Art";
import "./studyDeckScreen.css";

const TABS = ["Physics", "Chemistry", "Maths", "English"];
const TAB: CSSProperties = { minHeight: 44, padding: "0 18px", border: 0, borderRadius: "var(--radius-pill)", font: "600 15px/1 var(--font-text)" };

export function StudyDeckScreen({ kid }: { kid: { nickname: string; level: string; pack: PackId } }) {
  const [tab, setTab] = useState("Physics");
  const pack = getPack(kid.pack);

  return (
    <div className="sd-root" data-theme={kid.pack} data-band="teen" style={{ width: "100%", minHeight: "var(--screen-h, 100dvh)", boxSizing: "border-box", position: "relative", overflow: "hidden", isolation: "isolate", display: "flex", flexDirection: "column", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
      <div className="sd-wrap">
        <section className="sd-panel" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-glass)", backdropFilter: "blur(20px)", boxShadow: "inset 0 0 0 1px var(--line), var(--shadow-raised)" }}>
          <div className="sd-span" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wordmarkFor(pack)} alt="myKx" style={{ height: "22px", width: "auto" }} />
            <span style={{ marginLeft: "auto", fontSize: "14px", lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{`${kid.nickname} · ${kid.level} · ${pack.name}`}</span>
          </div>
          {/* Rule 15: while a grown-up has location sharing or the home cameras on, the teen sees it here. */}
          <GuardianChips className="sd-span" />
          <div className="sd-span" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h1 className="sd-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800 }}>Forces, week 3</h1>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", color: "var(--ink-muted)" }}>Physics test in 18 days. Scope from the school notice, added 24 Oct.</p>
          </div>
          <div className="sd-tabs sd-span" role="group" aria-label="Subject" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
            {TABS.map((label) => (
              <button
                key={label}
                className="sd-tab"
                type="button"
                onClick={() => setTab(label)}
                aria-pressed={tab === label}
                style={{ ...TAB, ...(tab === label ? { background: "var(--accent)", color: "var(--on-accent)" } : { background: "transparent", color: "var(--ink)" }) }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="sd-rings sd-span">
            <div className="sd-ring" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", display: "grid", placeItems: "center", background: "conic-gradient(var(--accent) 64%, var(--line) 0)" }}>
                <span style={{ width: "50px", height: "50px", borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface-raised)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "18px" }}>64</span>
              </div>
              <span className="sd-ring-label" style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 600 }}>Resultant force</span>
              <span className="sd-ring-cap" style={{ fontSize: "13px", lineHeight: "18px", fontWeight: 500, color: "var(--ink-muted)" }}>Developing evidence · 6 families</span>
            </div>
            <div className="sd-ring" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", display: "grid", placeItems: "center", background: "conic-gradient(var(--accent) 41%, var(--line) 0)" }}>
                <span style={{ width: "50px", height: "50px", borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface-raised)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "18px" }}>41</span>
              </div>
              <span className="sd-ring-label" style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 600 }}>Newton&apos;s second law</span>
              <span className="sd-ring-cap" style={{ fontSize: "13px", lineHeight: "18px", fontWeight: 500, color: "var(--ink-muted)" }}>Limited evidence · 2 families</span>
            </div>
            <div className="sd-ring" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
              <div style={{ width: "64px", height: "64px", boxSizing: "border-box", borderRadius: "50%", display: "grid", placeItems: "center", border: "2px dashed var(--border-control)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "18px", color: "var(--ink-muted)" }}>–</span>
              </div>
              <span className="sd-ring-label" style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 600 }}>Free-body diagrams</span>
              <span className="sd-ring-cap" style={{ fontSize: "13px", lineHeight: "18px", fontWeight: 500, color: "var(--ink-muted)" }}>Not yet assessed</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "22px", borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 2px var(--accent)" }}>
            <div className="sd-next-head">
              <h2 style={{ margin: 0, fontSize: "24px", lineHeight: "30px", fontWeight: 600 }}>Next: 3 fresh questions</h2>
              <span style={{ fontSize: "14px", lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>About 12 min</span>
            </div>
            <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", color: "var(--ink-muted)" }}>Newton&apos;s second law first, because it has the least evidence and it&apos;s in your test scope. One resultant-force check to see if yesterday&apos;s fix stuck.</p>
            <div className="sd-actions">
              <button className="mk-btn mk-btn--primary" type="button">Start session</button>
              <button className="mk-btn mk-btn--secondary" type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 9v4l3 2M9 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                25 min focus
              </button>
            </div>
          </div>
          <div className="sd-kix">
            <Art base={pack.kix} sizes="72px" alt="Kix" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", flex: "none", boxShadow: "0 0 0 3px var(--surface-raised), 0 0 0 5px var(--accent)" }} />
            <p className="sd-bubble" style={{ margin: 0, padding: "12px 16px", borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>You fixed a sign error on retry yesterday. One fresh question will show if it stuck.</p>
            <button className="mk-btn mk-btn--secondary" type="button">Ask Kix</button>
          </div>
        </section>
      </div>
      <StudyRoom pack={kid.pack} className="sd-scene" />
    </div>
  );
}
