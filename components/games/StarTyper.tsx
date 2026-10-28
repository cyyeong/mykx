"use client";

// Star Typer (board StarTyper; GAMES.md §3): word meteors over the living space scene. Each right key fires one of
// Kix's star-bolts; finishing a word bursts it into stardust. A wrong key fires nothing and makes no sound (the
// kindness rule): the letter wobbles, the ghost hand shows the right finger, and you try again. Calm mode: no
// timer, the meteors wait. The round runs on the pure engine (lib/games/typing/session.ts) and the server scores
// it with the deterministic rules; stars are this game's own, never the reward ledger or mastery (rule 5).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { api } from "@/components/account/api";
import { LivingArt } from "@/components/scene/LivingArt";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import { scoreRound } from "@/lib/games/progress";
import { expectedKey, press, roundOver, startRound, wordIn, type TypingState } from "@/lib/games/typing/session";
import type { LivingArtData } from "@/lib/scene/livingArt";
import space from "@/public/art/living/space.json";
import { GhostKeyboard, type HandsMode } from "./GhostKeyboard";
import { SpaceAmbience } from "./SpaceAmbience";
import "./starTyper.css";

const SPOTS: [number, number][] = [
  [22, 30],
  [50, 18],
  [78, 34],
];

type Result = { stars: number; accuracy: number; wpm: number; next: { stage: number; level: number } | null; saved: boolean };

export function StarTyper({ words, stage, level, stageName, band, nickname }: { words: string[]; stage: number; level: number; stageName: string; band: "junior" | "teen"; nickname: string }) {
  const { play } = useSound();
  const [s, setS] = useState<TypingState>(() => startRound(words, 3));
  const [hands, setHands] = useState<HandsMode>(band === "teen" ? "fade" : "on");
  const [hit, setHit] = useState<(string | null)[]>([null, null, null]);
  const [bolts, setBolts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [wrong, setWrong] = useState<{ key: string; expected: string | null; n: number } | null>(null);
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
      if (out.result.kind === "miss") {
        setWrong({ key: key.toLowerCase(), expected: out.result.expected, n });
        setTimeout(() => setWrong((w) => (w && w.n === n ? null : w)), 1200);
        setS(out.state);
        return;
      }
      const { slot, done: finishedWord } = out.result;
      const [x, y] = SPOTS[slot];
      setBolts((b) => [...b, { id: n, x, y }].slice(-6));
      setHit((h) => h.map((v, i) => (i === slot ? (n % 2 ? "a" : "b") : v)));
      setWrong(null);
      if (finishedWord) {
        setBursts((b) => [...b, { id: n, x, y }].slice(-3));
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

  // The round is over: the server scores and saves it (once). The local score shows if saving fails.
  useEffect(() => {
    if (!done || sent.current) return;
    sent.current = true;
    const report = { stage, level, hits: s.hits, misses: s.misses, correctChars: s.correctChars, ms: s.startedAt !== null && s.lastAt !== null ? s.lastAt - s.startedAt : 0, finished: true, keys: s.keys };
    const local = scoreRound(report, band);
    play("reward");
    void api<{ stars: number; accuracy: number; wpm: number; next: { stage: number; level: number } }>("POST", "/api/games/round", { game: "star-typer", ...report }).then((r) =>
      setResult(r.ok && r.data ? { ...r.data, saved: true } : { ...local, next: null, saved: false }),
    );
  }, [done, s, stage, level, band, play]);

  const next = expectedKey(s);
  const total = s.hits + s.misses;
  const acc = total ? s.hits / total : 1;
  const heat = Math.min(3, Math.floor(s.finished / 3));
  const meteors = useMemo(
    () =>
      SPOTS.map((spot, i) => {
        const w = wordIn(s, i);
        const n = s.target === i ? s.typed : 0;
        return { i, w, spot, n };
      }),
    [s],
  );

  const restart = () => {
    setS(startRound(words, 3));
    setBolts([]);
    setBursts([]);
    setHit([null, null, null]);
    setResult(null);
    sent.current = false;
  };

  return (
    <div className="st-root" data-theme="dreamlight" data-band={band}>
      <Art base="/art/games/space" alt="" className="st-bg" sizes="100vw" />
      <LivingArt data={space as LivingArtData} ox="50%" oy="30%" />
      <SpaceAmbience heat={heat} pulse={s.hits ? (s.hits % 2 ? "a" : "b") : ""} pokes />
      <header className="st-hud">
        <Link className="st-pill" href="/arcade">
          ‹ Arcade
        </Link>
        <div className="st-title">
          <strong>Star Typer</strong>
          <span>
            Stage {stage} · {stageName} · level {level} of 5
          </span>
        </div>
        <span className="st-pill" title="Words done">
          {s.finished} / {s.queue.length}{" "}
          <span className="st-bar">
            <i style={{ width: `${(s.finished / s.queue.length) * 100}%` }} />
          </span>
        </span>
        <span className="st-pill st-acc">Accuracy {Math.round(acc * 100)}%</span>
        <div className="st-seg" role="group" aria-label="Ghost hands">
          {(
            [
              ["on", "Hands on"],
              ["fade", "Fade"],
              ["off", "Off"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={hands === id} onClick={() => setHands(id)}>
              {label}
            </button>
          ))}
        </div>
        <span className="st-pill st-calm">Calm mode</span>
      </header>
      <main className="st-field" aria-label="Type the word on a meteor to fire Kix's star-bolts">
        {meteors.map(({ i, w, spot, n }) =>
          w ? (
            <div key={`${i}-${w}-${s.nextFromQueue}`} className="st-meteor" style={{ left: `${spot[0]}%`, top: `${spot[1]}%`, animationDelay: `${-i * 2.1}s` }} data-locked={s.target === i ? "yes" : "no"} data-hit={hit[i] ?? ""}>
              <div className="st-rock" />
              <div className="st-word" aria-label={w}>
                <b>{w.slice(0, n)}</b>
                <u>{w.slice(n, n + 1)}</u>
                <em>{w.slice(n + 1)}</em>
              </div>
            </div>
          ) : null,
        )}
        {bolts.map((b) => (
          <span key={b.id} className="st-bolt" style={{ "--x": `${b.x}%`, "--y": `${b.y}%`, animationName: b.id % 2 ? "st-fly" : "st-fly2" } as CSSProperties} />
        ))}
        {bursts.map((b) => (
          <span key={b.id} className="st-burst" style={{ left: `${b.x}%`, top: `${b.y}%`, "--anim": b.id % 2 ? "st-dust" : "st-dust2" } as CSSProperties}>
            <i style={{ "--dx": "-40px", "--dy": "-30px" } as CSSProperties} />
            <i style={{ "--dx": "44px", "--dy": "-26px" } as CSSProperties} />
            <i style={{ "--dx": "-30px", "--dy": "38px" } as CSSProperties} />
            <i style={{ "--dx": "36px", "--dy": "34px" } as CSSProperties} />
            <i style={{ "--dx": "0px", "--dy": "-50px" } as CSSProperties} />
            <i style={{ "--dx": "4px", "--dy": "48px" } as CSSProperties} />
          </span>
        ))}
        {wrong && wrong.expected && (
          <span key={wrong.n} className="st-miss" role="status">
            Not quite: try {wrong.expected === " " ? "space" : wrong.expected.toUpperCase()}. No rush.
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="st-kix" src={band === "teen" ? "/art/login/kix-anime-sky.webp" : "/art/login/kix-terrarium.webp"} alt="Kix, ready to fire" />
      </main>
      <p className="st-tip">Sit tall, wrists up, eyes on the screen. Feel the bumps on F and J.</p>
      <section className="st-keys">
        <GhostKeyboard nextKey={next} wrongKey={wrong?.key ?? null} hands={hands} onKey={type} />
      </section>
      {done && (
        <div className="st-clear" role="dialog" aria-label="Level clear">
          <div className="st-card">
            <Art base="/art/kix/expressions/cheer" alt="" sizes="110px" style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover" }} />
            <h2 style={{ margin: 0, font: "600 34px/1.1 var(--font-display)" }}>Level clear!</h2>
            {result ? (
              <>
                <div className="st-stars" aria-label={`${result.stars} of 3 stars`}>
                  {[1, 2, 3].map((n) => (
                    <span key={n} data-on={n <= result.stars ? "yes" : "no"} style={{ animationDelay: `${n * 0.18}s` }}>
                      ★
                    </span>
                  ))}
                </div>
                <div className="st-stats">
                  <div>
                    <strong>{Math.round(result.accuracy * 100)}%</strong>accuracy
                  </div>
                  <div>
                    <strong>{s.queue.length}</strong>words
                  </div>
                  <div>
                    <strong>{result.wpm}</strong>words a minute
                  </div>
                </div>
                <p style={{ margin: 0, font: "600 14px/1.4 var(--font-text)", color: "#C6BFEE" }}>
                  ★ finish · ★★ 90% right · ★★★ 96% right{band === "teen" ? " and your stage's speed" : ""}. Same play, same stars.
                </p>
                {!result.saved && <p className="st-sample">Couldn&apos;t save this round, {nickname}: your stars still count here.</p>}
                <div className="st-actions">
                  <button className="mk-btn mk-btn--secondary" type="button" onClick={restart}>
                    Play again
                  </button>
                  {result.next && (result.next.stage !== stage || result.next.level !== level) ? (
                    <a className="mk-btn mk-btn--reward st-next" href={`/arcade/star-typer?stage=${result.next.stage}&level=${result.next.level}`}>
                      Next level
                    </a>
                  ) : (
                    <Link className="mk-btn mk-btn--reward st-next" href="/arcade">
                      Back to the Arcade
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="st-sample">Counting your stars…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
