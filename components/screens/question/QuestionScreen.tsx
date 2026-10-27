// Question player (Junior): one frog life cycle question per screen, marked by
// POST /api/attempts (deterministic, server-side). Day 3 replaces the Day 2
// fixture: the item, session position and next step come from the server;
// the answer key never reaches the client.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KixBubble } from "@/components/ui/KixBubble";
import "./questionScreen.css";

export interface PlayerItem {
  id: string;
  stem: string;
  options: string[];
  hints: string[];
}

export interface QuestionPlayerProps {
  item: PlayerItem;
  questSlug: string;
  questTitle: string;
  /** 1-based position in today's session. */
  position: number;
  total: number;
  /** Session picks already attempted before this one. */
  doneCount: number;
  /** Next session pick, or null: the session is done. */
  nextId: string | null;
  starsToday: number;
}

type Phase = "answering" | "checking" | "wrong" | "correct" | "revealed";

interface AttemptOutcome {
  correct: boolean | null;
  mastery: string;
  note: string | null;
  working: string[] | null;
  awards: { rule: string; amount: number; note?: string }[];
  starsToday: number;
  capReached: boolean;
}

type Mood = "idle" | "hint" | "thinking" | "cheer";

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
const TREASURE = "M6 4h12l4 5.5L12 20 2 9.5zm0 0L12 20M2 9.5h20M9.5 9.5 12 20M14.5 9.5 12 20";

// Layout (direction, size, padding) lives in .qp-option so the size classes can change it.
const OPTION: CSSProperties = { border: 0, borderRadius: "var(--radius-lg)", fontFamily: "var(--font-text)", color: "var(--ink)" };

function optionStyle(selected: boolean, state: "idle" | "right" | "wrong"): CSSProperties {
  if (state === "right") return { ...OPTION, background: "var(--success)", color: "var(--on-success)", boxShadow: "inset 0 0 0 3px var(--border-control)" };
  if (state === "wrong") return { ...OPTION, background: "var(--warn)", color: "var(--on-warn)", boxShadow: "inset 0 0 0 3px var(--border-control)" };
  if (selected) return { ...OPTION, background: "var(--surface)", boxShadow: "inset 0 0 0 4px var(--accent), 4px 4px 0 var(--accent)" };
  return { ...OPTION, background: "var(--surface)", boxShadow: "inset 0 0 0 3px var(--line)" };
}

const RULE_LINES: Record<string, string> = {
  first_attempt: "first try, with your own explanation",
  retry_revised: "retry with a revised explanation",
  fresh_transfer: "fresh success after a tricky one",
};

function awardLine(outcome: AttemptOutcome): string {
  if (!outcome.awards.length) {
    return outcome.capReached
      ? "You've earned today's 15 stars. Your learning still counts."
      : "Solved! Stars need your own explanation — say why next time.";
  }
  return outcome.awards.map((a) => `+${a.amount} stars: ${RULE_LINES[a.rule] ?? a.rule}.`).join(" ");
}

export function QuestionPlayer({ item, questSlug, questTitle, position, total, doneCount, nextId, starsToday }: QuestionPlayerProps) {
  const router = useRouter();
  const { play } = useSound();
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [explanation, setExplanation] = useState("");
  const [hintIdx, setHintIdx] = useState(0);
  const [tries, setTries] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [collected, setCollected] = useState(false);
  const [stars, setStars] = useState(starsToday);
  const [failed, setFailed] = useState(false);
  const key = useRef<string>(crypto.randomUUID());
  const cardRef = useRef<HTMLDivElement>(null);

  const isMcq = item.options.length > 0;
  const resolved = phase === "correct" || phase === "revealed";
  const mood: Mood = phase === "correct" ? "cheer" : phase === "wrong" ? "thinking" : hintIdx > 0 && !resolved ? "hint" : "idle";
  const kix = KIX[mood];
  const nextHref = nextId ? `/question/${nextId}` : `/learn/${questSlug}/done`;

  const bubble: ReactNode = (() => {
    if (phase === "correct") return "Yes! That's it. Collect your card.";
    if (phase === "revealed") return "Here's how it works. Read it over, then keep going.";
    if (phase === "wrong" && outcome?.note) return outcome.note;
    if (hintIdx > 0) return item.hints[Math.min(hintIdx, item.hints.length) - 1];
    return "Take your time. Say what you think, and why.";
  })();

  async function send(revealed: boolean) {
    setPhase("checking");
    setFailed(false);
    let data: AttemptOutcome & { ok: boolean };
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          response: revealed ? null : isMcq ? (selected === null ? null : selected + 1) : typed.trim() || null,
          explanation: explanation.trim() || null,
          hintsUsed: hintIdx,
          revealed,
          key: key.current,
        }),
      });
      data = (await res.json()) as AttemptOutcome & { ok: boolean };
      if (!data.ok) throw new Error("not-ok");
    } catch {
      setPhase("answering");
      setFailed(true);
      return;
    }
    setOutcome(data);
    setStars(data.starsToday);
    if (data.correct) {
      setPhase("correct");
      play("correct");
    } else if (revealed) {
      setPhase("revealed");
    } else {
      setPhase("wrong");
      setTries((t) => t + 1);
    }
  }

  function askHint() {
    if (hintIdx >= item.hints.length) return;
    setHintIdx((h) => h + 1);
    play("hint");
  }

  /** The reward card flies to the Treasure icon in the header (600 ms arc); a fade when motion is reduced. */
  function collect() {
    play("reward");
    const card = cardRef.current;
    const target = document.getElementById("qp-treasure");
    if (!card || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCollected(true);
      return;
    }
    const from = card.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, {
      position: "fixed",
      left: `${from.left + from.width / 2 - 14}px`,
      top: `${from.top + from.height / 2 - 14}px`,
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: "var(--reward)",
      boxShadow: "var(--shadow-glow)",
      zIndex: "80",
      pointerEvents: "none",
    });
    document.body.append(dot);
    const flight = dot.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(0.4)`, opacity: 0.9 },
      ],
      { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    flight.onfinish = () => {
      dot.remove();
      setCollected(true);
    };
  }

  const bars = Array.from({ length: Math.max(total, 1) }, (_, i) => {
    const fill = i < doneCount + (resolved ? 1 : 0) ? "var(--success)" : i === doneCount ? "var(--accent)" : "var(--line)";
    return <span key={i} style={{ flex: 1, height: 12, borderRadius: "var(--radius-pill)", background: fill }} />;
  });

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
          <button
            type="button"
            aria-label="Leave quest"
            onClick={() => setLeaving(true)}
            style={{ width: 56, height: 56, flex: "none", display: "grid", placeItems: "center", borderRadius: "var(--radius-pill)", background: "var(--surface-raised)", color: "var(--ink)", boxShadow: "inset 0 0 0 3px var(--border-control)", cursor: "pointer" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
              <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="qp-progress" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: "22px", fontWeight: 800 }}>
              {questTitle} · question {position} of {total}
            </span>
            <div style={{ display: "flex", gap: 8 }}>{bars}</div>
          </div>
          <Link
            id="qp-treasure"
            href="/treasure"
            aria-label="My Treasure"
            style={{ marginLeft: "auto", flex: "none", display: "grid", placeItems: "center", width: 56, height: 56, borderRadius: "var(--radius-pill)", background: "var(--surface-raised)", color: "var(--ink)", boxShadow: "inset 0 0 0 3px var(--border-control)" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 24, height: 24 }}>
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={TREASURE} />
            </svg>
          </Link>
          <span
            style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, height: 56, padding: "0 20px", borderRadius: "var(--radius-pill)", background: "var(--reward)", color: "var(--on-reward)", fontSize: 18, fontWeight: 800, boxShadow: "inset 0 0 0 3px var(--border-control)" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
              <path fill="currentColor" d={SPARKLE} />
            </svg>
            {stars} stars
          </span>
        </header>

        {leaving && (
          <div role="alertdialog" aria-label="Leave the quest?" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control)" }}>
            <p style={{ margin: 0, fontSize: 18, lineHeight: "26px", fontWeight: 700 }}>Leave the quest? Your answers so far are saved.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => router.push(`/learn/${questSlug}`)}>
                Leave
              </Button>
              <Button onClick={() => setLeaving(false)}>Keep going</Button>
            </div>
          </div>
        )}

        <div className="qp-body">
          <div className="qp-cardbg" aria-hidden="true" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control), var(--shadow-raised)" }} />

          <main className="qp-main" style={{ boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ padding: "3px 12px", borderRadius: "var(--radius-pill)", background: "var(--accent-2)", color: "var(--on-accent-2)", fontSize: 14, lineHeight: "22px", fontWeight: 800 }}>
                {questTitle}
              </span>
              <span style={{ padding: "3px 12px", borderRadius: "var(--radius-pill)", background: "var(--surface)", color: "var(--ink)", fontSize: 14, lineHeight: "22px", fontWeight: 800, boxShadow: "inset 0 0 0 2px var(--line)" }}>
                Fresh question
              </span>
            </div>
            <h1 className="qp-q" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, whiteSpace: "pre-line" }}>
              {item.stem}
            </h1>
            {isMcq ? (
              <div className="qp-options" role="group" aria-label="Answer options">
                {item.options.map((label, i) => {
                  const state = phase === "correct" && outcome ? "idle" : phase === "wrong" && i === selected ? "wrong" : "idle";
                  return (
                    <button
                      key={i}
                      className="q-option qp-option"
                      type="button"
                      onClick={() => {
                        if (resolved || phase === "checking") return;
                        setSelected(i);
                      }}
                      aria-pressed={i === selected}
                      style={{ ...optionStyle(i === selected, state), minHeight: 56, padding: "12px 16px", textAlign: "left", cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 20, lineHeight: "26px", fontWeight: 800 }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 16, fontWeight: 700 }}>
                Your answer
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={resolved || phase === "checking"}
                  style={{ minHeight: 56, padding: "0 16px", borderRadius: "var(--radius-lg)", border: 0, background: "var(--surface)", color: "var(--ink)", fontSize: 20, boxShadow: "inset 0 0 0 3px var(--line)" }}
                />
              </label>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 16, fontWeight: 700 }}>
              Why do you think so? Say it in your own words — it earns stars.
              <input
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                disabled={resolved || phase === "checking"}
                maxLength={500}
                placeholder="Because…"
                style={{ minHeight: 56, padding: "0 16px", borderRadius: "var(--radius-lg)", border: 0, background: "var(--surface)", color: "var(--ink)", fontSize: 18, boxShadow: "inset 0 0 0 3px var(--line)" }}
              />
            </label>
          </main>

          <p className="qp-note" style={{ margin: 0, fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>
            Your first try counts toward mastery. Hints are fine; Kix notes them for your parent.
          </p>

          <div className="qp-dock">
            <aside className="qp-aside">
              <KixBubble
                className="qp-bubble"
                outlined
                chip={hintIdx > 0 && !resolved ? `Hint ${Math.min(hintIdx, item.hints.length)} of ${item.hints.length}` : null}
                aria-live="polite"
                style={{ fontSize: 20, lineHeight: "28px", fontWeight: 700 }}
              >
                {bubble}
              </KixBubble>
              <div className="q-kix qp-kix" style={{ position: "relative" }}>
                <Art
                  base={kix.art}
                  alt={kix.alt}
                  sizes="(max-width: 599px) 64px, (max-width: 1023px) 160px, (min-width: 1600px) 300px, 240px"
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block", background: "#E6E6E8", boxShadow: "0 0 0 6px var(--surface-raised), 0 0 0 9px var(--border-control)" }}
                />
                {phase === "correct" &&
                  BURSTS.map((style, i) => (
                    <svg key={i} className="q-burst" viewBox="0 0 24 24" aria-hidden="true" style={style}>
                      <path fill="currentColor" stroke="#2A1E5C" strokeWidth="1.2" d={SPARKLE} />
                    </svg>
                  ))}
              </div>
              {phase === "correct" && outcome && (
                <div ref={cardRef} className="q-rise qp-reward" style={{ display: "flex", gap: 16, padding: 14, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control), var(--shadow-glow)" }}>
                  <div style={{ position: "relative", width: 108, height: 140, flex: "none", borderRadius: "var(--radius-md)", overflow: "hidden", display: "grid", placeItems: "center", background: "var(--surface)" }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 56, height: 56, color: "var(--reward)" }}>
                      <path fill="currentColor" d={SPARKLE} />
                    </svg>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "var(--radius-pill)", background: "var(--reward)", color: "var(--on-reward)", fontSize: 13, lineHeight: "20px", fontWeight: 800 }}>
                      New card
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: "28px" }}>{questTitle}</span>
                    <span style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{awardLine(outcome)}</span>
                    <span style={{ fontSize: 13, lineHeight: "18px", fontWeight: 600, color: "var(--ink-muted)" }}>{outcome.mastery}</span>
                    {collected ? (
                      <Link
                        href="/treasure"
                        style={{ marginTop: "auto", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 56, fontSize: 16, lineHeight: "22px", fontWeight: 800, color: "var(--accent)" }}
                      >
                        Added to your Treasure
                      </Link>
                    ) : (
                      <Button variant="reward" onClick={collect} style={{ marginTop: "auto", alignSelf: "flex-start" }}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="currentColor" d={SPARKLE} />
                        </svg>
                        Collect card
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {phase === "revealed" && outcome?.working && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control)" }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>How it works</span>
                  <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 16, lineHeight: "24px" }}>
                    {outcome.working.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </aside>

            <div className="qp-actions">
              {!resolved && phase !== "checking" && (
                <Button variant="secondary" onClick={askHint} disabled={hintIdx >= item.hints.length}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-2 18h4v2h-4z" />
                  </svg>
                  {hintIdx >= item.hints.length ? "No more hints — you've got this" : "Ask Kix for a hint"}
                </Button>
              )}
              {phase === "answering" && (
                <Button onClick={() => void send(false)} disabled={isMcq ? selected === null : !typed.trim()}>
                  Check my answer
                </Button>
              )}
              {phase === "checking" && (
                <span style={{ display: "inline-flex", alignItems: "center", minHeight: 56, fontSize: 16, fontWeight: 700, color: "var(--ink-muted)" }}>
                  Kix is checking…
                </span>
              )}
              {phase === "wrong" && tries < 2 && <Button onClick={() => setPhase("answering")}>Try again</Button>}
              {phase === "wrong" && tries >= 2 && (
                <>
                  <Button variant="secondary" onClick={() => void send(true)}>
                    Show me how
                  </Button>
                  <ButtonLink href={nextHref}>Next question</ButtonLink>
                </>
              )}
              {failed && (
                <p role="alert" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--on-warn)" }}>
                  Kix couldn&apos;t reach the checker. Your answer is safe — try again.
                </p>
              )}
              {phase === "correct" && <ButtonLink href={nextHref}>{nextId ? "Next question" : "See how I did"}</ButtonLink>}
              {phase === "revealed" && <ButtonLink href={nextHref}>{nextId ? "Next question" : "See how I did"}</ButtonLink>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
