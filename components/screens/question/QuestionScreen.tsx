// Question player (Junior): one frog life cycle question per screen, marked by
// POST /api/attempts (deterministic, server-side). Day 3 replaces the Day 2
// fixture: the item, session position and next step come from the server;
// the answer key never reaches the client.
"use client";

import { InlineMarkup, speakable, StemText, type StemFigure } from "./StemText";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KixBubble } from "@/components/ui/KixBubble";
import { CareCard, type Care } from "@/components/guardian/CareCard";
import { useTheme } from "@/components/theme/ThemeRoot";
import { TalkButton } from "@/components/voice/TalkButton";
import { useKixVoice } from "@/components/voice/useKixVoice";
import "./questionScreen.css";

/** p3-science → "P3 Science", s2-science → "Sec 2 Science". */
function packName(id: string): string {
  const [lvl, ...rest] = id.split("-");
  return `${lvl.startsWith("s") ? `Sec ${lvl.slice(1)}` : lvl.toUpperCase()} ${rest.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ")}`;
}

export interface PlayerItem {
  id: string;
  /** Item markup: paragraphs, "| a | b |" tables, **bold** (rendered by StemText, never shown raw). */
  stem: string;
  options: string[];
  hints: string[];
  /** The item's diagram from its skill pack (an inlined SVG), when it has one. */
  figure?: StemFigure | null;
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
  /** This stop's reward card: shown only when the answer earns stars. */
  card: { label: string; art: string };
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
  /** The child's reason held distress words: Kix's caring reply and the helplines (rule 12). */
  care: Care | null;
  /** The reason, checked in code (lib/domain/reason.ts); `better` once the answer is right or shown. */
  reason?: { quality: "none" | "short" | "off-topic" | "on-topic"; used: string[]; better: string | null };
  /** The right answer, once reached or shown ("Show me how" highlights it). */
  answer?: number | string | null;
}

/** Kix's feedback on the child's reason (/api/kix/reason): narration only, never the stars. */
type Coach = { verdict: "good" | "partly" | "not-yet"; feedback: string; better: string | null };
/** The opening line, from code: the answer's result and the reason's verdict, said plainly and apart. */
function coachLead(correct: boolean, verdict: Coach["verdict"]): string {
  if (correct) return verdict === "good" ? "Right answer, and a strong reason!" : verdict === "partly" ? "Right answer! Your reason is on the right track:" : "Right answer! But your reason needs work:";
  return verdict === "not-yet" ? "Not this answer yet, and your reason needs work too:" : "Not this answer yet. Your reason uses some science:";
}
const COACH_RING: Record<Coach["verdict"], string> = { good: "var(--success)", partly: "var(--reward)", "not-yet": "var(--warn)" };

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

function optionStyle(selected: boolean, state: "idle" | "right" | "wrong" | "answer"): CSSProperties {
  if (state === "answer") return { ...OPTION, background: "var(--surface-raised)", fontWeight: 900, boxShadow: "inset 0 0 0 4px var(--success), 0 0 0 4px rgba(46, 160, 90, 0.18)" };
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
  return outcome.awards.map((a) => `+${a.amount} stars: ${RULE_LINES[a.rule] ?? a.rule}.`).join(" ");
}

export function QuestionPlayer({ item, questSlug, questTitle, position, total, doneCount, nextId, starsToday, card }: QuestionPlayerProps) {
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
  // When this try began, for the guardian's "answered in under 3 s" signal (never mastery evidence).
  const shownAt = useRef<number>(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  const cardRef = useRef<HTMLDivElement>(null);
  // Kix Tutor (/api/kix/tutor): streamed hints and answers to "why?", from the question's skill pack.
  const { band } = useTheme();
  const { speak, speaking, wordIndex } = useKixVoice(band);
  const [tutor, setTutor] = useState<string | null>(null);
  const [tutorBusy, setTutorBusy] = useState(false);
  const [skill, setSkill] = useState<string | null>(null);
  // What Kix did for the last answer (x-kix-trace): the packs it had loaded and the sections it read.
  const [trace, setTrace] = useState<{ loaded: string[]; read: string[] } | null>(null);
  const [askText, setAskText] = useState("");
  const [spoken, setSpoken] = useState<string | null>(null);
  const [askCare, setAskCare] = useState<Care | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);

  const isMcq = item.options.length > 0;
  const resolved = phase === "correct" || phase === "revealed";
  const mood: Mood = phase === "correct" ? "cheer" : phase === "wrong" ? "thinking" : hintIdx > 0 && !resolved ? "hint" : "idle";
  const kix = KIX[mood];
  const nextHref = nextId ? `/question/${nextId}` : `/learn/${questSlug}/done`;

  const say = (text: string) => {
    setSpoken(text);
    speak(text);
  };
  // The right answer in words, once it's reached or shown (bold in Kix's bubble and the "How it works" panel).
  const answerText = outcome?.answer == null ? null : typeof outcome.answer === "number" ? (item.options[outcome.answer - 1] ?? null) : String(outcome.answer);
  const bubble: ReactNode = (() => {
    if (speaking && spoken) {
      return spoken.split(/\s+/).map((w, i) => (
        <span key={i} className={i === wordIndex ? "qp-now" : undefined}>
          {w}{" "}
        </span>
      ));
    }
    if (phase === "answering" && tutor !== null) return tutor || "Kix is thinking…";
    if (phase === "correct" && coach?.verdict === "not-yet") return "Yes, that's the right answer! But your reason doesn't explain it yet. Read what I wrote under your reason.";
    if (phase === "correct") return outcome?.awards.length ? "Yes! That's it. Collect your card." : "Yes! That's it.";
    if (phase === "revealed") return answerText ? `The answer is **${answerText}**. Read how it works, then keep going.` : "Here's how it works. Read it over, then keep going.";
    if (phase === "wrong" && outcome?.note) return outcome.note;
    if (hintIdx > 0) return item.hints[Math.min(hintIdx, item.hints.length) - 1];
    return "Take your time. Say what you think, and why.";
  })();

  // When the answer is shown or reached, bring the highlighted option into view (the card scrolls on short screens).
  useEffect(() => {
    if (phase !== "revealed" && phase !== "correct") return;
    const t = setTimeout(() => {
      document.querySelector(".qp-option[data-answer]")?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 150);
    return () => clearTimeout(t);
  }, [phase]);

  // Kix's note on the reason, once it arrives, comes into view too (the bubble points to it).
  useEffect(() => {
    if (!coach) return;
    const t = setTimeout(() => {
      document.getElementById("qp-coach")?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 350);
    return () => clearTimeout(t);
  }, [coach]);

  /** A new try after a wrong answer: a fresh submission key and timer, back to "Check my answer". */
  function startRetry() {
    if (tries >= 2) return;
    key.current = crypto.randomUUID();
    shownAt.current = performance.now();
    setPhase("answering");
  }

  async function send(revealed: boolean) {
    setTutor(null);
    setCoach(null);
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
          ...(shownAt.current ? { durationMs: Math.round(performance.now() - shownAt.current) } : {}),
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
    if (!revealed && !data.care) void coachReason(data);
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

  /** Kix reads the child's reason after marking: what's right or missing, and a stronger reason once it's right. */
  async function coachReason(data: AttemptOutcome) {
    const reason = explanation.trim();
    const better = data.reason?.better ?? null;
    if (!reason) {
      setCoach(data.correct ? { verdict: "not-yet", feedback: "You didn't give a reason yet. Next time, say why in your own words: it earns stars.", better } : null);
      return;
    }
    // The check in code answers at once; Kix's own words replace it when they arrive.
    const quality = data.reason?.quality;
    setCoach(quality === "on-topic" ? null : { verdict: "not-yet", feedback: `Your reason, "${reason.slice(0, 60)}", doesn't explain the science yet.`, better });
    setCoachBusy(true);
    try {
      const res = await fetch("/api/kix/reason", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: item.id, choice: isMcq ? (selected === null ? null : selected + 1) : typed.trim() || null, reason, correct: Boolean(data.correct) }),
      });
      const json = (await res.json()) as { ok: boolean; coach: Coach | null };
      if (json.ok && json.coach) setCoach(json.coach);
    } catch {
      // Keep the check in code's feedback.
    }
    setCoachBusy(false);
  }

  /** Asks Kix Tutor; every ask counts as a hint (a helped answer is never mastery evidence). */
  async function streamTutor(hint: number, ask?: string, readAloud = false) {
    setTutorBusy(true);
    setTutor("");
    setAskCare(null);
    let text = "";
    try {
      const res = await fetch("/api/kix/tutor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: item.id, hint, ...(ask ? { ask } : {}) }) });
      setSkill(res.headers.get("x-kix-skill"));
      try {
        const raw = res.headers.get("x-kix-trace");
        setTrace(raw ? (JSON.parse(decodeURIComponent(raw)) as { loaded: string[]; read: string[] }) : null);
      } catch {
        setTrace(null);
      }
      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = (await res.json()) as { care?: Care };
        if (data.care) {
          setAskCare(data.care);
          text = data.care.reply;
        }
      } else if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setTutor(text);
        }
      }
    } catch {
      text = item.hints[Math.min(hint, item.hints.length) - 1] ?? "";
    }
    setTutor(text || item.hints[Math.min(hint, item.hints.length) - 1] || "");
    setTutorBusy(false);
    if (readAloud && text) say(text);
  }

  function askHint() {
    if (hintIdx >= item.hints.length || tutorBusy) return;
    const next = hintIdx + 1;
    setHintIdx(next);
    play("hint");
    void streamTutor(next);
  }

  function askWhy(text: string, byVoice: boolean) {
    const q = text.trim();
    if (!q || tutorBusy) return;
    const next = hintIdx + 1;
    setHintIdx(next);
    setAskText("");
    play("hint");
    void streamTutor(next, q, byVoice);
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
      style={{ width: "100%", minHeight: "var(--screen-h, 100vh)", boxSizing: "border-box", position: "relative", overflow: "clip", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
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
              {skill &&
                skill.split(", ").map((s) => (
                  <span key={s} className="qp-skill" title={`Kix is teaching from the ${s} skill pack`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM9 7h7M9 11h5" />
                    </svg>
                    {packName(s.split("@")[0])} skill loaded
                  </span>
                ))}
            </div>
            <div className="qp-qrow">
              <StemText text={item.stem} figure={item.figure} />
              <button
                type="button"
                className="qp-read"
                aria-label="Read the question aloud"
                title="Kix reads it with your device's voice"
                onClick={() => say([speakable(item.stem), ...item.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${speakable(o)}`)].join(". "))}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
                </svg>
              </button>
            </div>
            {isMcq ? (
              <div className="qp-options" role="group" aria-label="Answer options">
                {item.options.map((label, i) => {
                  // Once the answer is reached or shown, it stands out in bold with a green ring and a tick.
                  const isAnswer = resolved && typeof outcome?.answer === "number" && outcome.answer === i + 1;
                  const state = isAnswer ? "answer" : (phase === "wrong" || phase === "revealed") && i === selected ? "wrong" : "idle";
                  return (
                    <button
                      key={i}
                      className="q-option qp-option"
                      type="button"
                      onClick={() => {
                        if (resolved || phase === "checking") return;
                        // After a wrong try, picking another answer starts the next try at once.
                        if (phase === "wrong") {
                          if (tries >= 2) return;
                          startRetry();
                        }
                        setSelected(i);
                      }}
                      aria-pressed={i === selected}
                      data-answer={isAnswer || undefined}
                      style={{ ...optionStyle(i === selected, state), minHeight: 56, padding: "12px 16px", textAlign: "left", cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 20, lineHeight: "26px", fontWeight: isAnswer ? 900 : 800 }}>
                        <InlineMarkup text={label} />
                      </span>
                      {isAnswer && (
                        <span className="qp-answer-tag">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                          </svg>
                          {phase === "revealed" ? "Kix's answer" : "The answer"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 16, fontWeight: 700 }}>
                Your answer
                <input
                  value={typed}
                  onChange={(e) => {
                    if (phase === "wrong") startRetry();
                    setTyped(e.target.value);
                  }}
                  disabled={resolved || phase === "checking"}
                  style={{ minHeight: 56, padding: "0 16px", borderRadius: "var(--radius-lg)", border: 0, background: "var(--surface)", color: "var(--ink)", fontSize: 20, boxShadow: "inset 0 0 0 3px var(--line)" }}
                />
              </label>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 16, fontWeight: 700 }}>
              Why do you think so? Say it in your own words — it earns stars.
              <input
                value={explanation}
                onChange={(e) => {
                  if (phase === "wrong") startRetry();
                  setExplanation(e.target.value);
                }}
                disabled={resolved || phase === "checking"}
                maxLength={500}
                placeholder="Because…"
                aria-describedby={coach ? "qp-coach" : undefined}
                style={{ minHeight: 56, padding: "0 16px", borderRadius: "var(--radius-lg)", border: 0, background: "var(--surface)", color: "var(--ink)", fontSize: 18, boxShadow: `inset 0 0 0 3px ${coach ? COACH_RING[coach.verdict] : "var(--line)"}` }}
              />
            </label>
            {(coach || coachBusy) && (
              <section id="qp-coach" className="q-rise qp-coach" data-verdict={coach?.verdict ?? "busy"} aria-live="polite" aria-label="Kix on your reason">
                <p className="qp-coach-head">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d={coach?.verdict === "good" ? "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" : SPARKLE} />
                  </svg>
                  {coach ? "Kix on your answer" : "Kix is reading your reason…"}
                </p>
                {coach && outcome && outcome.correct !== null && <p className="qp-coach-lead">{coachLead(outcome.correct, coach.verdict)}</p>}
                {coach && <p className="qp-coach-text">{coach.feedback}</p>}
                {coach?.better && (
                  <div className="qp-better">
                    <span className="qp-better-label">{coach.verdict === "good" ? "Kix's way to say it" : "A stronger reason"}</span>
                    <p>{coach.better}</p>
                    <button type="button" className="qp-better-say" onClick={() => say(coach.better!)} aria-label="Read the stronger reason aloud">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </section>
            )}
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
                {typeof bubble === "string" ? <InlineMarkup text={bubble} /> : bubble}
              </KixBubble>
              {phase === "answering" && tutor && !tutorBusy && trace?.read.length ? (
                <p className="qp-trace" aria-label="What Kix looked up">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
                  </svg>
                  Kix read
                  {trace.read.map((t) => (
                    <span key={t} className="qp-trace-chip">
                      {t}
                    </span>
                  ))}
                </p>
              ) : null}
              {!resolved && phase !== "checking" && (
                <form
                  className="qp-ask"
                  onSubmit={(e) => {
                    e.preventDefault();
                    askWhy(askText, false);
                  }}
                >
                  <TalkButton onTranscript={(text) => askWhy(text, true)} />
                  <label htmlFor="qp-ask-input" className="qp-sr">
                    Ask Kix why
                  </label>
                  <input id="qp-ask-input" value={askText} maxLength={300} onChange={(e) => setAskText(e.target.value)} placeholder="Ask Kix why…" disabled={tutorBusy} />
                  <button type="submit" className="qp-ask-send" disabled={!askText.trim() || tutorBusy} aria-label="Ask Kix">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </form>
              )}
              {askCare && <CareCard care={askCare} />}
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
              {outcome?.care && <CareCard care={outcome.care} />}
              {phase === "correct" && outcome && outcome.awards.length > 0 && (
                <div ref={cardRef} className="q-rise qp-reward" style={{ display: "flex", gap: 16, padding: 14, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control), var(--shadow-glow)" }}>
                  <div className="qp-card-art" style={{ position: "relative", width: 108, height: 140, flex: "none", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface)" }}>
                    <Art base={card.art} alt={`Reward card: ${card.label}`} sizes="108px" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <span className="qp-card-foil" aria-hidden="true" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "var(--radius-pill)", background: "var(--reward)", color: "var(--on-reward)", fontSize: 13, lineHeight: "20px", fontWeight: 800 }}>
                      New card
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: "28px" }}>{card.label}</span>
                    <span style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{awardLine(outcome)}</span>
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
              {/* Right, but no stars this time (no explanation, or today's cap): no card is promised. */}
              {phase === "correct" && outcome && outcome.awards.length === 0 && (
                <div className="q-rise qp-reward" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 16, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: "28px" }}>Solved!</span>
                  <span style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>
                    {outcome.capReached
                      ? "You've earned today's 15 stars. Your learning still counts."
                      : "Stars come with a real reason: say why using the science, in your own words, to earn stars and this stop's card."}
                  </span>
                </div>
              )}
              {phase === "revealed" && outcome?.working && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--border-control)" }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>How it works</span>
                  {answerText && (
                    <p className="qp-how-answer">
                      The answer: <strong>{answerText}</strong>
                    </p>
                  )}
                  <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 16, lineHeight: "24px" }}>
                    {outcome.working.map((step, i) => (
                      <li key={i}>
                        <InlineMarkup text={step} />
                      </li>
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
              {/* The key is per submission, not per question: a retry of a failed
                  send reuses it (J17: sent once on reconnect), while Try again
                  and Show me how start new submissions. */}
              {phase === "checking" && (
                <span style={{ display: "inline-flex", alignItems: "center", minHeight: 56, fontSize: 16, fontWeight: 700, color: "var(--ink-muted)" }}>
                  Kix is checking…
                </span>
              )}
              {phase === "wrong" && tries < 2 && (
                <Button onClick={startRetry}>Try again</Button>
              )}
              {phase === "wrong" && tries >= 2 && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      key.current = crypto.randomUUID();
                      void send(true);
                    }}
                  >
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
