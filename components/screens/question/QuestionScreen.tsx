// Question and reward (Junior, Toon Pop), ported from docs/design/boards/Question.dc.html: scripts/port-board.ts,
// then by hand. Static port: the board's one fixture question, marked in the browser. Day 3 wires the attempts
// route (marking, mastery and the reward ledger stay server-side and deterministic).
"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Art } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { KixBubble } from "@/components/ui/KixBubble";
import { ROUTES } from "../routes";
import "./questionScreen.css";

type OptionId = "wood" | "frosted" | "glass" | "card";
type Result = "none" | "correct" | "wrong";
type Mood = "idle" | "hint" | "thinking" | "cheer";

const CORRECT: OptionId = "glass";
const STARS_BEFORE = 86;

const OPTIONS: { id: OptionId; label: string; art: ReactNode }[] = [
  {
    id: "wood",
    label: "Wooden block",
    art: (
      <svg className="qp-opt-art" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="22" y="14" width="76" height="56" rx="6" fill="#B9824A" stroke="#2A1E5C" strokeWidth="3" />
        <path d="M30 30h52M34 44h46M30 58h40" stroke="#8A5A2B" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "frosted",
    label: "Frosted plastic",
    art: (
      <svg className="qp-opt-art" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="22" y="14" width="76" height="56" rx="6" fill="#E9E4F7" stroke="#2A1E5C" strokeWidth="3" />
        <circle cx="44" cy="34" r="8" fill="#FFFFFF" opacity=".9" />
        <circle cx="72" cy="50" r="10" fill="#FFFFFF" opacity=".7" />
      </svg>
    ),
  },
  {
    id: "glass",
    label: "Clear glass",
    art: (
      <svg className="qp-opt-art" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="22" y="14" width="76" height="56" rx="6" fill="#DFF3FF" fillOpacity=".35" stroke="#2A1E5C" strokeWidth="3" />
        <path d="M34 24l14 -6M34 36l26 -12" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "card",
    label: "Cardboard box",
    art: (
      <svg className="qp-opt-art" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="22" y="14" width="76" height="56" rx="4" fill="#D7B47E" stroke="#2A1E5C" strokeWidth="3" />
        <path d="M22 30h76M60 14v16" stroke="#2A1E5C" strokeWidth="3" />
      </svg>
    ),
  },
];

const KIX: Record<Mood, { art: string; alt: string }> = {
  idle: { art: "/art/kix/expressions/idle", alt: "Kix smiling and waiting" },
  hint: { art: "/art/kix/expressions/hint", alt: "Kix holding up a glowing hint" },
  thinking: { art: "/art/kix/expressions/thinking", alt: "Kix thinking it over with you" },
  cheer: { art: "/art/kix/expressions/cheer", alt: "Kix jumping for joy" },
};

/** Sparkles around Kix on a correct answer: position, size (% of Kix) and stagger. */
const BURSTS: CSSProperties[] = [
  { left: "-12.5%", top: "4.17%", width: "18.33%", height: "18.33%" },
  { right: "-10.83%", top: "-4.17%", width: "15%", height: "15%", animationDelay: ".3s" },
  { right: "-16.67%", top: "62.5%", width: "12.5%", height: "12.5%", animationDelay: ".6s" },
  { left: "-6.67%", bottom: "-4.17%", width: "10.83%", height: "10.83%", animationDelay: ".9s" },
];

const SPARKLE = "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z";

// Layout (direction, size, padding) lives in .qp-option so the size classes can change it.
const OPTION: CSSProperties = { border: 0, borderRadius: "var(--radius-lg)", fontFamily: "var(--font-text)", color: "var(--ink)" };

function optionStyle(id: OptionId, selected: OptionId | null, result: Result): CSSProperties {
  if (result === "correct" && id === CORRECT) return { ...OPTION, background: "var(--success)", color: "var(--on-success)", boxShadow: "inset 0 0 0 3px var(--border-control)" };
  if (result === "wrong" && id === selected) return { ...OPTION, background: "var(--warn)", color: "var(--on-warn)", boxShadow: "inset 0 0 0 3px var(--border-control)" };
  if (id === selected) return { ...OPTION, background: "var(--surface)", boxShadow: "inset 0 0 0 4px var(--accent), 4px 4px 0 var(--accent)" };
  return { ...OPTION, background: "var(--surface)", boxShadow: "inset 0 0 0 3px var(--line)" };
}

function kixLine(selected: OptionId | null, result: Result, hint: boolean): string {
  if (result === "correct") return "Yes! Clear glass lets almost all the light through, so there’s no shadow.";
  if (result === "wrong") {
    return selected === "frosted"
      ? "Close! Some light gets through frosted plastic, but it still makes a faint shadow. Try again."
      : "Not quite. Light can’t get through that one, so it makes a dark shadow. Try again.";
  }
  if (hint) return "Picture holding each one up to a window. Can you see clearly through it?";
  return "Take your time. Think about which blocks light can pass through.";
}

export function QuestionScreen() {
  const [selected, setSelected] = useState<OptionId | null>(null);
  const [result, setResult] = useState<Result>("none");
  const [hint, setHint] = useState(false);
  const [collected, setCollected] = useState(false);

  const mood: Mood = result === "correct" ? "cheer" : result === "wrong" ? "thinking" : hint ? "hint" : "idle";
  const kix = KIX[mood];
  const isCorrect = result === "correct";
  const reward = hint ? 2 : 5;
  const stars = collected ? STARS_BEFORE + reward : STARS_BEFORE;
  const earnedNote = hint
    ? `+${reward} stars: first try, with one hint. Your next fresh question can earn the full card bonus.`
    : `+${reward} stars: you solved a fresh question on your own.`;

  function pick(id: OptionId) {
    if (result === "correct") return;
    setSelected(id);
    setResult("none");
  }

  function check() {
    if (selected) setResult(selected === CORRECT ? "correct" : "wrong");
  }

  function retry() {
    setSelected(null);
    setResult("none");
  }

  return (
    <div
      data-theme="toon-pop"
      data-band="junior"
      className="qp-root"
      style={{ width: "100%", minHeight: "100vh", boxSizing: "border-box", position: "relative", overflow: "clip", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      <div aria-hidden="true" style={{ position: "absolute", right: "-9.375%", top: 0, width: "40.625%", aspectRatio: "1 / 1", transform: "translateY(-30.77%)", borderRadius: "50%", background: "var(--accent-2)", opacity: 0.22 }} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-10.9375%", bottom: 0, width: "35.9375%", aspectRatio: "1 / 1", transform: "translateY(43.48%)", borderRadius: "50%", background: "var(--reward)", opacity: 0.3 }} />

      <div className="qp-wrap">
        <header className="qp-header">
          <Link
            href={ROUTES.quest}
            aria-label="Leave quest"
            style={{ width: 56, height: 56, flex: "none", display: "grid", placeItems: "center", borderRadius: "var(--radius-pill)", background: "var(--surface-raised)", color: "var(--ink)", boxShadow: "inset 0 0 0 3px var(--border-control)" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
              <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Link>
          <div className="qp-progress" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: "22px", fontWeight: 800 }}>Shadows · question 2 of 3</span>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ flex: 1, height: 12, borderRadius: "var(--radius-pill)", background: "var(--success)" }} />
              <span style={{ flex: 1, height: 12, borderRadius: "var(--radius-pill)", background: "var(--accent)" }} />
              <span style={{ flex: 1, height: 12, borderRadius: "var(--radius-pill)", background: "var(--line)" }} />
            </div>
          </div>
          <span
            style={{ marginLeft: "auto", flex: "none", display: "flex", alignItems: "center", gap: 8, height: 56, padding: "0 20px", borderRadius: "var(--radius-pill)", background: "var(--reward)", color: "var(--on-reward)", fontSize: 18, fontWeight: 800, boxShadow: "inset 0 0 0 3px var(--border-control)" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
              <path fill="currentColor" d={SPARKLE} />
            </svg>
            {stars} stars
          </span>
        </header>

        <div className="qp-body">
          <div className="qp-cardbg" aria-hidden="true" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control), var(--shadow-raised)" }} />

          <main className="qp-main" style={{ boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ padding: "3px 12px", borderRadius: "var(--radius-pill)", background: "var(--accent-2)", color: "var(--on-accent-2)", fontSize: 14, lineHeight: "22px", fontWeight: 800 }}>
                Shadows
              </span>
              <span style={{ padding: "3px 12px", borderRadius: "var(--radius-pill)", background: "var(--surface)", color: "var(--ink)", fontSize: 14, lineHeight: "22px", fontWeight: 800, boxShadow: "inset 0 0 0 2px var(--line)" }}>
                Fresh question
              </span>
            </div>
            <h1 className="qp-q" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400 }}>
              Kix shines a torch at four blocks. Which block makes no shadow?
            </h1>
            <div className="qp-options" role="group" aria-label="Answer options">
              {OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className="q-option qp-option"
                  type="button"
                  onClick={() => pick(o.id)}
                  aria-pressed={o.id === selected}
                  style={optionStyle(o.id, selected, result)}
                >
                  {o.art}
                  <span style={{ fontSize: 20, lineHeight: "26px", fontWeight: 800 }}>{o.label}</span>
                </button>
              ))}
            </div>
          </main>

          <p className="qp-note" style={{ margin: 0, fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>
            Your first try counts toward mastery. Hints are fine; Kix notes them for your parent.
          </p>

          <div className="qp-dock">
            <aside className="qp-aside">
              <KixBubble className="qp-bubble" outlined chip={hint ? "Hint 1 of 2" : null} aria-live="polite" style={{ fontSize: 20, lineHeight: "28px", fontWeight: 700 }}>
                {kixLine(selected, result, hint)}
              </KixBubble>
              <div className="q-kix qp-kix" style={{ position: "relative" }}>
                <Art
                  base={kix.art}
                  alt={kix.alt}
                  sizes="(max-width: 599px) 64px, (max-width: 1023px) 160px, (min-width: 1600px) 300px, 240px"
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block", background: "#E6E6E8", boxShadow: "0 0 0 6px var(--surface-raised), 0 0 0 9px var(--border-control)" }}
                />
                {isCorrect &&
                  BURSTS.map((style, i) => (
                    <svg key={i} className="q-burst" viewBox="0 0 24 24" aria-hidden="true" style={style}>
                      <path fill="currentColor" stroke="#2A1E5C" strokeWidth="1.2" d={SPARKLE} />
                    </svg>
                  ))}
              </div>
              {isCorrect && (
                <div className="q-rise qp-reward" style={{ display: "flex", gap: 16, padding: 14, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control), var(--shadow-glow)" }}>
                  <div style={{ position: "relative", width: 108, height: 140, flex: "none", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    <Art base="/art/cards/light-and-shadows" sizes="108px" alt="New card: Kix making a rabbit shadow" style={{ width: 108, height: 140, objectFit: "cover", display: "block" }} />
                    <div
                      aria-hidden="true"
                      style={{ position: "absolute", inset: 0, mixBlendMode: "color-dodge", opacity: 0.35, background: "conic-gradient(from 90deg at 30% 20%, var(--kix-lavender), var(--kix-mint), var(--accent-2), var(--star-gold), var(--kix-lavender))" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "var(--radius-pill)", background: "var(--reward)", color: "var(--on-reward)", fontSize: 13, lineHeight: "20px", fontWeight: 800 }}>
                      New card
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: "28px" }}>Light and shadows</span>
                    <span style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{earnedNote}</span>
                    {collected ? (
                      <Link
                        href={ROUTES.treasure}
                        style={{ marginTop: "auto", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 56, fontSize: 16, lineHeight: "22px", fontWeight: 800, color: "var(--accent)" }}
                      >
                        Added to your Treasure
                      </Link>
                    ) : (
                      <Button variant="reward" onClick={() => setCollected(true)} style={{ marginTop: "auto", alignSelf: "flex-start" }}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="currentColor" d={SPARKLE} />
                        </svg>
                        Collect card
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </aside>

            <div className="qp-actions">
              <Button variant="secondary" onClick={() => setHint(true)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-2 18h4v2h-4z" />
                </svg>
                Ask Kix for a hint
              </Button>
              {result === "none" && (
                <Button onClick={check} disabled={selected === null}>
                  Check my answer
                </Button>
              )}
              {result === "wrong" && <Button onClick={retry}>Try again</Button>}
              {isCorrect && (
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, padding: "0 18px", borderRadius: "var(--radius-pill)", background: "var(--success)", color: "var(--on-success)", fontSize: 18, fontWeight: 800 }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20 }}>
                    <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L19 7" />
                  </svg>
                  Correct
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
