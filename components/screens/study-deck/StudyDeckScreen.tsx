// Study deck (Teen), ported from docs/design/boards/StudyDeck.dc.html: scripts/port-board.ts, then by hand.
// The teen landing page and the teen Learn pages: the deck sits over a living study room (lamp, window, drawer...:
// components/scene). Real data since 29 Oct: the tabs are the kid's own subjects (their level's packs), the rings
// are that subject's topics with mastery from the kid's attempts and honest evidence labels, the Next card is the
// session code chose (what and why), Start session starts it, and the focus timer is only a timer (it never touches
// a score). Home shows three rings; Learn ("learn") lists every topic with its skills and a session per topic.
"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useLearningSession } from "@/components/camera/learningSession";
import { GuardianChips } from "@/components/guardian/GuardianChips";
import { AnimeRoom } from "@/components/scene/rooms/AnimeRoom";
import { StudyRoom } from "@/components/scene/rooms/StudyRoom";
import { getPack, wordmarkFor, type PackId } from "@/components/theme/packs";
import { Art } from "@/components/ui/Art";
import type { SubjectView, TopicCard } from "@/lib/learn/views";
import "./studyDeckScreen.css";

const TAB: CSSProperties = { minHeight: 44, padding: "0 18px", border: 0, borderRadius: "var(--radius-pill)", font: "600 15px/1 var(--font-text)" };
const FOCUS_MS = 25 * 60_000;

export interface StudyDeckProps {
  kid: { nickname: string; level: string; pack: PackId };
  /** The kid's own subjects (lib/learn/views.ts), in school order. */
  subjects: SubjectView[];
  /** The subject shown first (a pack id); else the first one. */
  initial?: string | null;
  /** Home: three rings. Learn: every topic, its skills, and a session per topic. */
  variant?: "home" | "learn";
  /** Kix's word for today when it differs (a gentle start after a hard day, lib/kix/today.ts). */
  kixLine?: string | null;
  /** School subjects this level has no pack for yet. */
  missing?: string[];
}

/** Home's three rings: the next session's topic, then topics with the most evidence, then ones ready to start. */
function homeRings(v: SubjectView): TopicCard[] {
  const ready = (t: TopicCard) => t.questions + t.written + t.cards > 0;
  const first = v.topics.find((t) => t.id === v.next?.topicId);
  const rest = v.topics
    .filter((t) => t !== first && ready(t))
    .sort((a, b) => b.families - a.families || (b.mastery ?? -1) - (a.mastery ?? -1));
  // A thin pack shows its gaps honestly: topics with no questions yet fill the row, labelled as such.
  const waiting = v.topics.filter((t) => !ready(t));
  return [...(first ? [first] : []), ...rest, ...waiting].slice(0, 3);
}

/** Kix's line from the numbers: the strongest and weakest assessed topics, or that nothing is assessed yet. */
function summaryLine(v: SubjectView): string {
  const assessed = v.topics.filter((t) => t.mastery !== null);
  if (!assessed.length) return `Nothing in ${v.name} is assessed yet. One session starts the evidence, and every number here comes from your own answers.`;
  const sorted = [...assessed].sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0));
  const best = sorted[0];
  const weak = sorted[sorted.length - 1];
  if (sorted.length === 1) return `${best.title} is at ${best.mastery} so far, on ${best.families === 1 ? "one question family" : `${best.families} question families`}. The other topics aren't assessed yet.`;
  const thin = assessed.every((t) => t.families < 5);
  return `${best.title} is your strongest so far (${best.mastery}); ${weak.title} needs the most work (${weak.mastery}).${thin ? " The evidence is still thin: a few more sessions will firm it up." : ""}`;
}

function Ring({ topic, size = 64 }: { topic: TopicCard; size?: number }) {
  const inner = size - 14;
  if (topic.mastery === null) {
    return (
      <div className="sd-ring-dial" style={{ width: size, height: size, boxSizing: "border-box", borderRadius: "50%", display: "grid", placeItems: "center", border: "2px dashed var(--border-control)" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--ink-muted)" }}>–</span>
      </div>
    );
  }
  return (
    <div className="sd-ring-dial" role="img" aria-label={`${topic.title}: ${topic.mastery} out of 100`} style={{ width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(var(--accent) ${topic.mastery}%, var(--line) 0)` }}>
      <span style={{ width: inner, height: inner, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface-raised)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>{topic.mastery}</span>
    </div>
  );
}

const caption = (t: TopicCard) => (t.questions + t.written + t.cards === 0 ? "Questions on the way" : t.evidence);

function FocusTimer() {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [done, setDone] = useState(false);
  // The focus camera may run while a focus block is on (only if a grown-up switched it on; counts only, rule 12).
  useLearningSession(end !== null);
  useEffect(() => {
    if (end === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= end) {
        setEnd(null);
        setDone(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end]);
  const left = end === null ? 0 : Math.max(0, end - now);
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  return (
    <>
      <button
        className="mk-btn mk-btn--secondary"
        type="button"
        aria-pressed={end !== null}
        onClick={() => {
          setDone(false);
          setEnd(end === null ? Date.now() + FOCUS_MS : null);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 9v4l3 2M9 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {end === null ? "25 min focus" : `Stop focus · ${mm}:${String(ss).padStart(2, "0")}`}
      </button>
      <span className="sd-focus-note" aria-live="polite">
        {done ? "25 minutes done. Take a five-minute break." : end !== null ? "Focus block on. It's only a timer: it never changes a score." : null}
      </span>
    </>
  );
}

export function StudyDeckScreen({ kid, subjects, initial, variant = "home", kixLine, missing = [] }: StudyDeckProps) {
  const [tab, setTab] = useState(() => subjects.find((s) => s.id === initial)?.id ?? subjects[0]?.id ?? null);
  const pack = getPack(kid.pack);
  const view = subjects.find((s) => s.id === tab) ?? subjects[0] ?? null;
  const learn = variant === "learn";
  const rings = view ? (learn ? view.topics : homeRings(view)) : [];

  const nextCard = (v: SubjectView) => (
    <div className="sd-next" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 2px var(--accent)" }}>
      <div className="sd-next-head">
        <h2 style={{ margin: 0, fontSize: "24px", lineHeight: "30px", fontWeight: 600 }}>
          {v.next ? `Next: ${v.next.count} ${v.next.reviewOnly ? "review" : "fresh"} ${v.next.count === 1 ? "question" : "questions"}` : "Nothing new this week"}
        </h2>
        {v.next && <span style={{ fontSize: "14px", lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>About {v.next.minutes} min</span>}
      </div>
      <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", color: "var(--ink-muted)" }}>{v.next ? v.next.line : v.empty}</p>
      <div className="sd-actions">
        {v.next && (
          <Link className="mk-btn mk-btn--primary" href={v.next.href}>
            Start session
          </Link>
        )}
        <FocusTimer />
      </div>
    </div>
  );

  const kixRow = (
    <div className="sd-kix">
      <Art base={pack.kix} sizes="72px" alt="Kix" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", flex: "none", boxShadow: "0 0 0 3px var(--surface-raised), 0 0 0 5px var(--accent)" }} />
      <p className="sd-bubble" style={{ margin: 0, padding: "12px 16px", borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
        {kixLine ?? (view ? summaryLine(view) : `Hi ${kid.nickname}. Your subjects will show here as soon as they're ready.`)}
      </p>
      <Link className="mk-btn mk-btn--secondary" href="/ask">
        Ask Kix
      </Link>
    </div>
  );

  return (
    <div className="sd-root" data-theme={kid.pack} data-band="teen" data-variant={variant} style={{ width: "100%", minHeight: "var(--screen-h, 100dvh)", boxSizing: "border-box", position: "relative", overflow: "hidden", isolation: "isolate", display: "flex", flexDirection: "column", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
      <div className="sd-wrap">
        <section className="sd-panel" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-glass)", backdropFilter: "blur(20px)", boxShadow: "inset 0 0 0 1px var(--line), var(--shadow-raised)" }}>
          <div className="sd-span" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wordmarkFor(pack)} alt="myKx" style={{ height: "22px", width: "auto" }} />
            <span style={{ marginLeft: "auto", fontSize: "14px", lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{`${kid.nickname} · ${kid.level} · ${pack.name}`}</span>
          </div>
          {/* Rule 15: while a grown-up has location sharing or the home cameras on, the teen sees it here. */}
          <GuardianChips className="sd-span" />
          {view ? (
            <>
              <div className="sd-span" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h1 className="sd-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800 }}>{view.label}</h1>
                <p style={{ margin: 0, fontSize: "16px", lineHeight: "24px", color: "var(--ink-muted)" }}>
                  {view.started} of {view.topics.length} topics started · {view.evidence}
                  {!learn && (
                    <>
                      {" "}
                      <Link href={`/learn/${view.id}`} className="sd-more">
                        All {view.topics.length} topics
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="sd-tabs sd-span" role="group" aria-label="Subject" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    className="sd-tab"
                    type="button"
                    onClick={() => setTab(s.id)}
                    aria-pressed={s.id === view.id}
                    style={{ ...TAB, ...(s.id === view.id ? { background: "var(--accent)", color: "var(--on-accent)" } : { background: "transparent", color: "var(--ink)" }) }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {learn ? (
                <div className="sd-body sd-span">
                  <ul className="sd-list" aria-label={`${view.name} topics`}>
                    {rings.map((t) => (
                      <li key={t.id} className="sd-row" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                        <Ring topic={t} size={56} />
                        <details className="sd-row-detail">
                          <summary>
                            <span className="sd-row-title">
                              {t.title}
                              {t.id === view.next?.topicId && <span className="sd-today">Next session starts here</span>}
                            </span>
                            <span className="sd-row-cap">{caption(t)}</span>
                          </summary>
                          <ul className="sd-skills">
                            {t.subskills.map((s) => (
                              <li key={s.id}>
                                <span>{s.name}</span>
                                <span>{s.label}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                        {t.startHref ? (
                          <Link href={t.startHref} className="mk-btn mk-btn--secondary sd-row-go" aria-label={`Practise ${t.title}`}>
                            Practise
                          </Link>
                        ) : (
                          <span className="sd-row-empty">{t.questions + t.written + t.cards ? "Done this week" : "On the way"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="sd-side">
                    {nextCard(view)}
                    {view.gap && <p className="sd-gap">{view.gap}</p>}
                    {missing.length > 0 && (
                      <p className="sd-gap">
                        {kid.level} {missing.join(" and ")} {missing.length === 1 ? "is" : "are"} on the way.
                      </p>
                    )}
                    {kixRow}
                  </div>
                </div>
              ) : (
                <>
                  <div className="sd-rings sd-span">
                    {rings.map((t) => (
                      <div key={t.id} className="sd-ring" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                        <Ring topic={t} />
                        <span className="sd-ring-label" style={{ fontSize: "16px", lineHeight: "22px", fontWeight: 600 }}>
                          {t.title}
                        </span>
                        <span className="sd-ring-cap" style={{ fontSize: "13px", lineHeight: "18px", fontWeight: 500, color: "var(--ink-muted)" }}>
                          {caption(t)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {nextCard(view)}
                  {kixRow}
                </>
              )}
            </>
          ) : (
            <>
              <div className="sd-span" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h1 className="sd-title" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800 }}>
                  {kid.level} subjects are on the way
                </h1>
                <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", color: "var(--ink-muted)" }}>No skill pack for {kid.level} is published yet, so there&apos;s nothing to practise here today.</p>
              </div>
              {kixRow}
            </>
          )}
        </section>
      </div>
      {/* An Anime Sky teen gets their own anime room (founder, 29 Oct); everyone else, the study room. */}
      {kid.pack === "anime-sky" ? <AnimeRoom pack={kid.pack} className="sd-scene" /> : <StudyRoom pack={kid.pack} className="sd-scene" />}
    </div>
  );
}
