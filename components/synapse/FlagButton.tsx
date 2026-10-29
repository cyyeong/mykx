"use client";

// Kix Synapse's flag (docs/prd/SYNAPSE.md §4.2; board SynapseFlag): a small flag on anything a model said or a
// question that was marked. It opens a sheet with what might be wrong, an optional note (typed or held-to-talk), and
// "Send to Kix's crew". Then the flag shows "Checking…" and, when the crew has looked, what came back: fixed, or why
// Kix was right. No points for reports (rule 5).
import { useEffect, useId, useRef, useState } from "react";
import { TalkButton } from "@/components/voice/TalkButton";
import "./flag.css";

export type FlagSurface = "learn" | "ask-kix" | "critter";
export interface SignedFlag {
  token: string;
  shown: string;
  ask: string | null;
}
type Kind = "typo" | "marked-wrong" | "figure" | "hint" | "question-wrong" | "answer-wrong" | "confusing" | "pet-wrong" | "other";
type Outcome = { state: "checking" | "fixed" | "right" | "closed"; note: string | null };

const ICON: Record<Kind, string> = {
  typo: "M3 18l5-12 5 12M5 14h6M14.5 18c1.2-1.6 2.4-1.6 3.5 0s2.3 1.6 3.5 0",
  "marked-wrong": "M4 12.5l4 4 8-9M15 15.5l5 5M20 15.5l-5 5",
  figure: "M3.5 5h17v14h-17zM3.5 15.5l5-4.5 4 3.5 3-2.5 5 4M15.5 9.5h.01",
  hint: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  "question-wrong": "M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.2-1.5 2.2v.6M12 18h.01",
  "answer-wrong": "M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  confusing: "M4 6h16M4 12h10M4 18h7M17 14l4 4M21 14l-4 4",
  "pet-wrong": "M12 21c-4.5-2.5-8-6-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 4-3.5 7.5-8 10zM9.5 11.5l5 0",
  other: "M6 12h.01M12 12h.01M18 12h.01",
};
const FLAG = "M6 21V4M6 4.5h11.5l-2.6 4 2.6 4H6";
const LOCK = "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3";

type Mine = { id: string; surface: string; itemId: string | null; state: Outcome["state"]; note: string | null };
let mine: Promise<Mine[]> | null = null;
/** The kid's own reports, fetched once per page load and shared by every flag on it. */
function mineOnce(): Promise<Mine[]> {
  mine ??= fetch("/api/synapse/report")
    .then((r) => (r.ok ? r.json() : { reports: [] }))
    .then((d: { reports?: Mine[] }) => d.reports ?? [])
    .catch(() => []);
  return mine;
}

function kindsFor(surface: FlagSurface, o: { marked: boolean; figure: boolean }): [Kind, string][] {
  if (surface === "ask-kix") return [["answer-wrong", "Kix's answer looks wrong"], ["typo", "A typo"], ["confusing", "Doesn't make sense"], ["other", "Something else"]];
  if (surface === "critter") return [["pet-wrong", "That's not true for this stage"], ["confusing", "Doesn't make sense"], ["other", "Something else"]];
  const list: [Kind, string][] = [["typo", "A word is spelt wrong"]];
  if (o.marked) list.push(["marked-wrong", "My answer was marked wrong"]);
  if (o.figure) list.push(["figure", "The picture doesn't match"]);
  list.push(["hint", "The hint didn't help"], ["question-wrong", "The question looks wrong"], ["other", "Something else"]);
  return list;
}

const Svg = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function FlagButton(props: {
  surface: FlagSurface;
  band?: "junior" | "teen" | null;
  /** Learn: the question, the kid's answer and whether it was marked. */
  itemId?: string | null;
  answer?: string | null;
  marked?: boolean | null;
  figure?: boolean;
  /** AI replies: the signed turn from the route. Without one there's nothing to flag (a cached sample). */
  flag?: SignedFlag | null;
  /** What the flag is on, for screen readers ("this question", "Kix's reply"). */
  what?: string;
  className?: string;
}) {
  const { surface, band, itemId, answer, marked, figure, flag, what = surface === "learn" ? "this question" : surface === "critter" ? "what your pet said" : "Kix's reply" } = props;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [care, setCare] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const kinds = kindsFor(surface, { marked: marked !== null && marked !== undefined, figure: Boolean(figure) });

  // A new question or reply starts fresh.
  const key = `${surface}:${itemId ?? ""}:${flag?.token ?? ""}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setOpen(false);
    setKind(null);
    setNote("");
    setReportId(null);
    setOutcome(null);
    setCare(null);
    setError(null);
  }

  // Coming back to a question already reported: show how it went.
  useEffect(() => {
    if (surface !== "learn" || !itemId) return;
    let live = true;
    void mineOnce().then((list) => {
      const r = list.find((x) => x.itemId === itemId && x.surface === "learn");
      if (live && r) {
        setReportId(r.id);
        setOutcome({ state: r.state, note: r.note });
      }
    });
    return () => {
      live = false;
    };
  }, [surface, itemId]);

  // Ask the crew how it went, every few seconds for a few minutes.
  useEffect(() => {
    if (!reportId || reportId === "guest" || (outcome && outcome.state !== "checking")) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries += 1;
      if (tries > 45) return clearInterval(t);
      try {
        const res = await fetch(`/api/synapse/report?id=${encodeURIComponent(reportId)}`);
        const data = (await res.json()) as { reports?: { state: Outcome["state"]; note: string | null }[] };
        const r = data.reports?.[0];
        if (r && r.state !== "checking") {
          setOutcome({ state: r.state, note: r.note });
          setShowOutcome(true);
          clearInterval(t);
        }
      } catch {
        // try again next tick
      }
    }, 4000);
    return () => clearInterval(t);
  }, [reportId, outcome]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    dialog.current?.querySelector<HTMLElement>("button[data-kind]")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (surface !== "learn" && !flag) return null;

  async function send() {
    if (!kind) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/synapse/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ surface, kind, note: note.trim() || null, itemId: itemId ?? null, answer: answer ?? null, marked: marked ?? null, token: flag?.token ?? null, shown: flag?.shown ?? null, ask: flag?.ask ?? null }),
      });
      const data = (await res.json()) as { ok: boolean; reason?: string; care?: { reply: string } | null; report?: { id: string; state: Outcome["state"]; note: string | null } | null };
      if (data.care) {
        setCare(data.care.reply);
        return;
      }
      if (!res.ok || !data.report) {
        setError(
          data.reason === "daily-limit"
            ? "That's 10 reports today. Thank you! Kix's crew will check those first."
            : data.reason === "not-configured"
              ? "Kix's crew isn't taking reports here yet. Please tell your grown-up."
              : "That didn't send. Try again in a moment.",
        );
        return;
      }
      setReportId(data.report.id);
      setOutcome({ state: data.report.state, note: data.report.note });
      setOpen(false);
      mine = null;
    } catch {
      setError("That didn't send. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const state = outcome?.state;
  return (
    <span className={`sy-flagwrap ${props.className ?? ""}`} data-band={band === "junior" ? "junior" : "teen"}>
      {state && (
        <button type="button" className={`sy-status sy-${state}`} onClick={() => setShowOutcome((v) => !v)} aria-expanded={showOutcome}>
          {state === "checking" ? <i className="sy-dot" /> : <Svg d={state === "fixed" ? "M5 12.5l4.5 4.5L19 7.5" : FLAG} size={14} />}
          {state === "checking" ? "Checking… Kix's crew has it" : state === "fixed" ? "Fixed by your report" : state === "right" ? "Kix double-checked" : "Kix's crew looked"}
        </button>
      )}
      {state !== "checking" && (
        <button
          type="button"
          className="sy-flag"
          onClick={() => {
            setKind(null);
            setNote("");
            setError(null);
            setCare(null);
            setOpen(true);
          }}
          aria-label={`Something not right with ${what}? Tell Kix's crew`}
          title="Something not right?"
        >
          <Svg d={FLAG} size={band === "junior" ? 22 : 18} />
        </button>
      )}
      {showOutcome && outcome && outcome.state !== "checking" && (
        <span className="sy-outcome" role="status">
          <b>{outcome.state === "fixed" ? "Fixed, thanks to you!" : outcome.state === "right" ? "Kix double-checked" : "Thanks for telling us"}</b>
          {outcome.note && <span>{outcome.note}</span>}
          <button type="button" className="sy-got" onClick={() => setShowOutcome(false)}>
            Got it
          </button>
        </span>
      )}
      {open && (
        <div className="sy-scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="sy-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog}>
            <div className="sy-top">
              <span className="sy-mark">
                <Svg d={FLAG} size={22} />
              </span>
              <div>
                <h2 id={titleId}>{surface === "learn" ? "What's not right?" : "What's off?"}</h2>
                <p>Tell Kix&apos;s crew. They check every report.</p>
              </div>
            </div>
            {care ? (
              <p className="sy-care">{care}</p>
            ) : (
              <>
                <div className="sy-kinds" role="radiogroup" aria-label="What's wrong">
                  {kinds.map(([k, label]) => (
                    <button key={k} type="button" data-kind={k} role="radio" aria-checked={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
                      <span className="sy-i">
                        <Svg d={ICON[k]} />
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
                <label className="sy-label" htmlFor={`${titleId}-note`}>
                  Tell Kix more <small>(you can skip this)</small>
                </label>
                <div className="sy-note">
                  <textarea id={`${titleId}-note`} value={note} maxLength={300} rows={2} placeholder={surface === "learn" ? "What did you notice?" : "What looks wrong?"} onChange={(e) => setNote(e.target.value)} />
                  <TalkButton onTranscript={(t) => setNote((n) => (n ? `${n} ${t}` : t).slice(0, 300))} />
                </div>
                {error && <p className="sy-error">{error}</p>}
                <div className="sy-actions">
                  <button type="button" className="sy-cancel" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="sy-send" disabled={!kind || busy} onClick={send}>
                    <Svg d={FLAG} size={18} />
                    {busy ? "Sending…" : "Send to Kix's crew"}
                  </button>
                </div>
                <p className="sy-fine">
                  <Svg d={LOCK} size={14} />
                  Kix&apos;s crew sees {surface === "learn" ? "this question and what you said" : "this reply, your question and what you said"}. Not your other chats.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
