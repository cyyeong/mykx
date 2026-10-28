"use client";

// Neon Strike (board NeonStrike; GAMES.md §3, the Teen look): a science question appears, and typing its answer
// fires beams at the drone, one per right key; its ring fills as the word lands. A wrong key holds the shot (a
// silent "glitch", no penalty beyond accuracy) and resets the combo. Words a minute and the combo show up top; the
// neon arena heats up with the combo. The round runs on the pure engine (lib/games/typing/session.ts) and the
// server scores it with the deterministic rules (teens need 25 wpm for ★★★). Practice only: never mastery (rule 5).
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/components/account/api";
import { LivingArt } from "@/components/scene/LivingArt";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import { scoreRound } from "@/lib/games/progress";
import type { Blast } from "@/lib/games/typing/answers";
import { wordsPerMinute } from "@/lib/games/typing/score";
import { expectedKey, press, roundOver, startRound, wordIn, type TypingState } from "@/lib/games/typing/session";
import type { LivingArtData } from "@/lib/scene/livingArt";
import neon from "@/public/art/living/neon-arena.json";
import { GhostKeyboard, type HandsMode } from "./GhostKeyboard";
import { NeonAmbience } from "./NeonAmbience";
import "./neonStrike.css";

const LINES = ["Type it, fire it.", "Clean. Keep the rhythm.", "Eyes up. Fingers know the way.", "Combo rising.", "One more. You have this."];
type Result = { stars: number; accuracy: number; wpm: number; next: { stage: number; level: number } | null; saved: boolean };

export function NeonStrike({ questions, level, school, band }: { questions: Blast[]; level: number; school: string; band: "junior" | "teen" }) {
  const { play } = useSound();
  const answers = questions.map((q) => q.a);
  const [s, setS] = useState<TypingState>(() => startRound(answers, 1));
  const [hands, setHands] = useState<HandsMode>(band === "teen" ? "fade" : "on");
  const [beams, setBeams] = useState<number[]>([]);
  const [hit, setHit] = useState("");
  const [glitch, setGlitch] = useState<{ key: string; n: number } | null>(null);
  const [combo, setCombo] = useState({ now: 0, best: 0 });
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const seq = useRef(0);
  const sent = useRef(false);
  const done = roundOver(s);

  const type = useCallback(
    (key: string) => {
      if (done) return;
      const out = press(s, key, Date.now());
      if (out.result.kind === "ignored") return;
      seq.current += 1;
      const n = seq.current;
      setNow(Date.now());
      if (out.result.kind === "miss") {
        setGlitch({ key: key.toLowerCase(), n });
        setTimeout(() => setGlitch((g) => (g && g.n === n ? null : g)), 1000);
        setCombo((c) => ({ ...c, now: 0 }));
        setS(out.state);
        return;
      }
      setBeams((b) => [...b, n].slice(-3));
      setHit(n % 2 ? "a" : "b");
      setGlitch(null);
      if (out.result.done) {
        setCombo((c) => ({ now: c.now + 1, best: Math.max(c.best, c.now + 1) }));
        play("correct");
      } else play("tap");
      setS(out.state);
    },
    [s, done, play],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      e.preventDefault();
      type(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [type]);

  useEffect(() => {
    if (!done || sent.current) return;
    sent.current = true;
    const report = { stage: 1, level, hits: s.hits, misses: s.misses, correctChars: s.correctChars, ms: s.startedAt !== null && s.lastAt !== null ? s.lastAt - s.startedAt : 0, finished: true, keys: s.keys };
    const local = scoreRound(report, band, 7);
    play("reward");
    void api<{ stars: number; accuracy: number; wpm: number; next: { stage: number; level: number } }>("POST", "/api/games/round", { game: "neon-strike", ...report }).then((r) =>
      setResult(r.ok && r.data ? { ...r.data, saved: true } : { ...local, next: null, saved: false }),
    );
  }, [done, s, level, band, play]);

  const qi = Math.min(s.slots[0] ?? questions.length - 1, questions.length - 1);
  const answer = wordIn(s, 0) ?? answers[answers.length - 1];
  const typedN = s.target === 0 ? s.typed : 0;
  const next = expectedKey(s);
  const total = s.hits + s.misses;
  const acc = total ? s.hits / total : 1;
  const wpm = wordsPerMinute({ correctChars: s.correctChars, startedAt: s.startedAt, lastAt: s.lastAt ?? now });
  const heat = combo.now >= 4 ? 3 : combo.now >= 2 ? 2 : combo.now >= 1 ? 1 : 0;

  const restart = () => {
    setS(startRound(answers, 1));
    setBeams([]);
    setCombo({ now: 0, best: 0 });
    setResult(null);
    sent.current = false;
  };

  return (
    <div className="ns-root" data-theme="idol-stage" data-band="teen">
      <Art base="/art/games/neon-arena" alt="" className="ns-bg" sizes="100vw" />
      <LivingArt data={neon as LivingArtData} ox="50%" oy="60%" />
      <NeonAmbience heat={heat} pulse={hit} />
      <header className="ns-hud">
        <Link className="ns-chip" href="/arcade">
          ‹ Arcade
        </Link>
        <div className="ns-title">
          <strong>NEON STRIKE</strong>
          <span>
            Answer blast · level {level} of 5 · {school} Science
          </span>
        </div>
        <span className="ns-chip">
          Combo <strong>x{combo.now}</strong>
        </span>
        <span className="ns-chip">
          <strong>{wpm}</strong> wpm
        </span>
        <span className="ns-chip">
          <strong>{Math.round(acc * 100)}%</strong> right
        </span>
        <div className="ns-seg" role="group" aria-label="Ghost hands">
          {(
            [
              ["on", "Hands"],
              ["fade", "Fade"],
              ["off", "Off"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={hands === id} onClick={() => setHands(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <main className="ns-stage">
        <div className="ns-q">
          <small>
            Question {Math.min(s.finished + 1, questions.length)} of {questions.length} · type the answer to fire
          </small>
          <p>{questions[qi]?.q}</p>
        </div>
        <div className="ns-drone" style={{ "--p": `${Math.round((typedN / answer.length) * 100)}%` } as React.CSSProperties} data-hit={hit} aria-hidden="true">
          <div className="ns-ring" />
          <div className="ns-core" />
          {beams.map((b) => (
            <span key={b} className="ns-beam" style={{ animationName: b % 2 ? "ns-beam" : "ns-beam2" }} />
          ))}
        </div>
        <div className="ns-slots" aria-label={`${typedN} of ${answer.length} letters`}>
          {answer.split("").map((ch, i) => (
            <span key={`${qi}-${i}`} data-s={i < typedN ? "done" : i === typedN ? "now" : "todo"}>
              {i < typedN ? ch.toUpperCase() : ""}
            </span>
          ))}
        </div>
        {glitch && next && (
          <span key={glitch.n} className="ns-glitch" role="status">
            Glitch. Shot held: {next.toUpperCase()} is next.
          </span>
        )}
      </main>
      <aside className="ns-kix">
        <Art base="/art/kix/anime-sky" alt="" sizes="56px" />
        <p>{LINES[(s.finished + combo.now) % LINES.length]}</p>
      </aside>
      <section className="ns-keys">
        <GhostKeyboard nextKey={next} wrongKey={glitch?.key ?? null} hands={hands} onKey={type} />
      </section>
      {done && (
        <div className="ns-clear" role="dialog" aria-label="Round clear">
          <div className="ns-card">
            <h2>Round clear</h2>
            {result ? (
              <>
                <div className="ns-stars" aria-label={`${result.stars} of 3 stars`}>
                  <b>{"★".repeat(result.stars)}</b>
                  <span>{"★".repeat(3 - result.stars)}</span>
                </div>
                <div className="ns-grid">
                  <div>
                    <strong>{Math.round(result.accuracy * 100)}%</strong>right first time
                  </div>
                  <div>
                    <strong>{result.wpm}</strong>words a minute
                  </div>
                  <div>
                    <strong>x{combo.best}</strong>best combo
                  </div>
                </div>
                <p className="ns-note">★ finish · ★★ 90% right · ★★★ 96% right{band === "teen" ? " and 25 wpm" : ""}. Game rounds never change your mastery scores; they&apos;re practice.</p>
                {!result.saved && <p className="ns-note">Couldn&apos;t save this round: your stars still count here.</p>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="mk-btn mk-btn--secondary" type="button" onClick={restart}>
                    Run it back
                  </button>
                  {result.next && result.next.level !== level ? (
                    <a className="mk-btn mk-btn--primary ns-next" href={`/arcade/neon-strike?level=${result.next.level}`}>
                      Next level
                    </a>
                  ) : (
                    <Link className="mk-btn mk-btn--primary ns-next" href="/arcade">
                      Back to the Arcade
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="ns-note">Counting your stars…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
