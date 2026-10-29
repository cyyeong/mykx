"use client";

// Vibe Zone (design board VibeZone): "I keep forgetting the frog life cycle" → flashcards Kix makes with the kid.
// The kid asks in their own words (typed, or hold-to-talk); Muse Spark writes a validated spec; trusted components
// draw it (rule 4). Change something makes a new version; Save to Treasure pays +5 once; Share sends one version to
// the grown-up, who can see it until the kid stops sharing.
import { useEffect, useState } from "react";
import { CareCard, type Care } from "@/components/guardian/CareCard";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import { TalkButton } from "@/components/voice/TalkButton";
import type { Creation } from "@/lib/auth/store";
import { QUICK_CHANGES, type Card, type FlashcardSpec } from "@/lib/vibe/flashcards";
import s from "./vibe.module.css";

const FRAME: Record<string, string> = { frogspawn: "0%", tadpole: "33.333%", froglet: "66.667%", frog: "100%" };

function Flashcard({ card, n }: { card: Card; n: number }) {
  const [flipped, setFlipped] = useState(false);
  const { play } = useSound();
  return (
    <button
      type="button"
      className={s.card}
      data-flipped={flipped}
      aria-pressed={flipped}
      aria-label={flipped ? `Card ${n} answer: ${card.back}` : `Card ${n}: ${card.front}. Tap to see the answer.`}
      onClick={() => {
        setFlipped((f) => !f);
        play("flip");
      }}
    >
      <span className={s.inner}>
        <span className={s.front}>
          <span className={s.cardN}>Card {n}</span>
          {card.picture && <span className={s.picture} style={{ backgroundPosition: `${FRAME[card.picture]} 52%` }} aria-hidden="true" />}
          <span className={s.q}>{card.front}</span>
          <span className={s.tap}>Tap to see the answer</span>
        </span>
        <span className={s.back}>
          <span className={s.cardN}>Answer</span>
          <span className={s.a}>{card.back}</span>
        </span>
      </span>
    </button>
  );
}

export function VibeZone({ nickname }: { nickname: string }) {
  const { play } = useSound();
  const [request, setRequest] = useState("");
  const [kind, setKind] = useState<"flashcards" | null>(null);
  const [spec, setSpec] = useState<FlashcardSpec | null>(null);
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creation, setCreation] = useState<Creation | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [mine, setMine] = useState<Creation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetch("/api/vibe")
      .then((r) => r.json())
      .then((d: { ok: boolean; creations?: Creation[] }) => live && d.ok && setMine(d.creations ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [creation]);

  const make = async (change?: string) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/vibe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "make", request: request.trim() || "flashcards for what I'm learning", ...(change && spec ? { revise: { spec, change } } : {}) }),
      });
      const d = (await res.json()) as { ok: boolean; spec?: FlashcardSpec | null; sample?: boolean; care?: Care | null };
      if (!d.ok) throw new Error();
      setCare(d.care ?? null);
      if (d.spec) {
        setSpec(d.spec);
        setSample(Boolean(d.sample));
        play("reward");
      }
    } catch {
      setError("Kix couldn't make them just now. Try again in a moment.");
    }
    setBusy(false);
  };

  const save = async () => {
    if (!spec) return;
    setBusy(true);
    const res = await fetch("/api/vibe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", id: creation?.id ?? null, spec }) });
    const d = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; creation?: Creation; awards?: { amount: number }[]; capReached?: boolean };
    if (!d.ok) setError("Couldn't save just now. Try again.");
    if (d.ok && d.creation) {
      setCreation(d.creation);
      const stars = (d.awards ?? []).reduce((n, a) => n + a.amount, 0);
      setSaved(`Saved as version ${d.creation.currentVersion}.${stars ? ` +${stars} stars!` : d.capReached ? " You've earned today's 15 stars." : ""}`);
      if (stars) play("reward");
    }
    setBusy(false);
  };

  const share = async (on: boolean) => {
    if (!creation) return;
    const res = await fetch("/api/vibe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "share", id: creation.id, share: on }) });
    const d = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; creation?: Creation };
    if (d.ok && d.creation) setCreation(d.creation);
  };

  return (
    <main className={s.page}>
      <section className={s.chat} aria-labelledby="vibe-title">
        <div className={s.head}>
          <h1 id="vibe-title" className={s.title}>
            Vibe Zone
          </h1>
          <p className={s.lede}>Make something with Kix, {nickname}.</p>
        </div>

        <div className={s.thread}>
          <div className={s.kixRow}>
            <Art base="/art/kix/expressions/idle" alt="Kix" sizes="56px" className={s.kix} />
            <p className={s.kixSays}>What do you want to remember better? Tell me, or hold the mic.</p>
          </div>
          <form
            className={s.ask}
            onSubmit={(e) => {
              e.preventDefault();
              if (request.trim()) setKind((k) => k ?? null);
            }}
          >
            <TalkButton onTranscript={(t) => setRequest(t)} />
            <label htmlFor="vibe-ask" className={s.sr}>
              What do you want to make?
            </label>
            <input id="vibe-ask" value={request} maxLength={400} onChange={(e) => setRequest(e.target.value)} placeholder="I keep forgetting the frog life cycle…" />
          </form>
          {request.trim() && (
            <>
              <div className={s.kixRow}>
                <Art base="/art/kix/expressions/hint" alt="" sizes="56px" className={s.kix} />
                <p className={s.kixSays}>Let&apos;s make something to help. Flashcards or a planner?</p>
              </div>
              <div className={s.choices} role="group" aria-label="What to make">
                <button type="button" className={s.choice} aria-pressed={kind === "flashcards"} onClick={() => setKind("flashcards")}>
                  Flashcards
                </button>
                <button type="button" className={s.choice} disabled title="Planners come in a later version">
                  Planner <small>soon</small>
                </button>
                <button type="button" className={s.choice} disabled title="Vibing an app is coming soon">
                  An app <small>soon</small>
                </button>
              </div>
            </>
          )}
          {kind === "flashcards" && (
            <div className={s.brief}>
              <span className={s.label}>Your brief</span>
              <ul>
                <li>4–6 flashcards: {request.trim().slice(0, 80)}</li>
                <li>A question on the front, the answer on the back</li>
                <li>Checked against your level&apos;s syllabus</li>
              </ul>
              <button type="button" className="mk-btn mk-btn--reward" disabled={busy} onClick={() => void make()}>
                {busy ? "Kix is making them…" : spec ? "Make them again" : "Make it"}
              </button>
            </div>
          )}
          {care && <CareCard care={care} />}
          {error && <p className={s.warn}>{error}</p>}
        </div>

        {/* Roadmap (founder, 29 Oct): apps follow the same rule as flashcards. Kix writes a checked spec and trusted
            components build it; no code a model wrote ever runs (AGENTS.md rule 4). */}
        <aside className={s.soon} aria-label="Coming soon">
          <span className={s.soonChip}>Coming soon</span>
          <p className={s.soonTitle}>Vibe an app</p>
          <p className={s.soonText}>Describe a tiny app, like a revision timer, a quiz game or a habit tracker, and Kix builds it from safe parts you can play with.</p>
        </aside>

        {mine.length > 0 && (
          <div className={s.mine}>
            <span className={s.label}>Your creations</span>
            <ul>
              {mine.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCreation(c);
                      setSpec(c.versions[c.currentVersion - 1] ?? null);
                      setKind("flashcards");
                      setSample(false);
                      setSaved(null);
                    }}
                  >
                    {c.title} <small>v{c.currentVersion}{c.sharedVersion ? " · shared" : ""}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={s.stage} aria-label="Your flashcards" aria-live="polite">
        {spec ? (
          <>
            <div className={s.stageHead}>
              <div>
                <h2 className={s.setTitle}>{spec.title}</h2>
                <p className={s.muted}>
                  {creation ? `Version ${creation.currentVersion}` : "Not saved yet"} · built from a checked template{sample ? " · sample set (Kix is offline)" : ""}
                </p>
              </div>
            </div>
            <p className={s.kixLine}>{spec.kixSays}</p>
            <div className={s.cards}>
              {spec.cards.map((c, i) => (
                <Flashcard key={`${creation?.currentVersion ?? 0}-${i}-${c.front}`} card={c} n={i + 1} />
              ))}
            </div>
            <div className={s.changes} role="group" aria-label="Change something">
              <span className={s.label}>Change something</span>
              {QUICK_CHANGES.map((c) => (
                <button key={c} type="button" className={s.chip} disabled={busy} onClick={() => void make(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className={s.actions}>
              <button type="button" className="mk-btn mk-btn--reward" disabled={busy} onClick={() => void save()}>
                Save to Treasure
              </button>
              {creation && (creation.sharedVersion ? (
                <button type="button" className="mk-btn mk-btn--secondary" onClick={() => void share(false)}>
                  Stop sharing
                </button>
              ) : (
                <button type="button" className="mk-btn mk-btn--secondary" onClick={() => void share(true)}>
                  Share with my grown-up
                </button>
              ))}
            </div>
            <p className={s.muted}>
              {saved ?? "+5 stars the first time you save a creation."}
              {creation?.sharedVersion ? ` Your grown-up can open version ${creation.sharedVersion}. New versions stay private until you share them.` : ""}
            </p>
          </>
        ) : (
          <div className={s.empty}>
            <p className={s.emptyTitle}>Your flashcards appear here</p>
            <p className={s.muted}>Tell Kix what you keep forgetting, pick Flashcards, then tap Make it.</p>
          </div>
        )}
      </section>
    </main>
  );
}
