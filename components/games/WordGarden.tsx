"use client";

// Word Garden (board WordGarden; GAMES.md §3, the calm look, open to every child; words by grade): a life-cycle picture from the Critter Lab and a
// clue; type the stage's name and a flower grows in its pot. No shooting and no timer. A wrong key only wobbles the
// card and shows the next letter (no sound, no penalty beyond accuracy). The terrarium brightens as the flowers
// bloom. The round runs on the pure engine; the server scores it with the deterministic rules. Practice only.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "@/components/account/api";
import { LivingArt } from "@/components/scene/LivingArt";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import { CRITTERS } from "@/lib/critters/catalog";
import { stageCrop } from "@/lib/critters/crop";
import { scoreRound } from "@/lib/games/progress";
import type { GardenPrompt } from "@/lib/games/typing/garden";
import { expectedKey, press, roundOver, startRound, type TypingState } from "@/lib/games/typing/session";
import type { LivingArtData } from "@/lib/scene/livingArt";
import terrarium from "@/public/art/living/terrarium.json";
import { GardenAmbience } from "./GardenAmbience";
import { GhostKeyboard, type HandsMode } from "./GhostKeyboard";
import "./wordGarden.css";

const COLOURS = ["#FF8FB8", "#B9A7F5", "#FFB86B", "#7FD3F0", "#FF8FB8", "#B9A7F5"];
type Result = { stars: number; accuracy: number; wpm: number; next: { stage: number; level: number } | null; saved: boolean };

const TOPIC: Record<string, string> = { P3: "P3 Science: life cycles", P6: "P6 Science: cycles and systems", "Sec 2": "Sec 2 Science: living things" };

export function WordGarden({ prompts, level, band, school }: { prompts: GardenPrompt[]; level: number; band: "junior" | "teen"; school: string }) {
  const { play } = useSound();
  const words = prompts.map((p) => p.word);
  const [s, setS] = useState<TypingState>(() => startRound(words, 1));
  const [hands, setHands] = useState<HandsMode>("on");
  const [miss, setMiss] = useState<{ key: string; n: number } | null>(null);
  const [wiggle, setWiggle] = useState(0);
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
        setMiss({ key: key.toLowerCase(), n });
        setWiggle((w) => w + 1);
        setTimeout(() => setMiss((m) => (m && m.n === n ? null : m)), 1300);
      } else {
        setMiss(null);
        play(out.result.done ? "pipGrows" : "tap");
      }
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
    const local = scoreRound(report, band, 8);
    play("reward");
    void api<{ stars: number; accuracy: number; wpm: number; next: { stage: number; level: number } }>("POST", "/api/games/round", { game: "word-garden", ...report }).then((r) =>
      setResult(r.ok && r.data ? { ...r.data, saved: true } : { ...local, next: null, saved: false }),
    );
  }, [done, s, level, band, play]);

  const qi = Math.min(s.slots[0] ?? prompts.length - 1, prompts.length - 1);
  const prompt = prompts[qi];
  const critter = CRITTERS.find((c) => c.id === prompt.critter) ?? CRITTERS[0];
  const crop = stageCrop(critter, prompt.stage);
  const typedN = s.target === 0 ? s.typed : 0;
  const next = expectedKey(s);
  const bloomed = s.finished;

  const restart = () => {
    setS(startRound(words, 1));
    setResult(null);
    sent.current = false;
  };

  return (
    <div className="wg-root" data-theme="terrarium" data-band="junior">
      <Art base="/art/scenes/terrarium" alt="" className="wg-bg" sizes="100vw" />
      <LivingArt data={terrarium as LivingArtData} ox="50%" oy="50%" />
      <div className="wg-veil" />
      <GardenAmbience heat={Math.min(3, Math.floor(bloomed / 2))} pulse={bloomed ? (bloomed % 2 ? "a" : "b") : ""} />
      <header className="wg-hud">
        <Link className="wg-pill" href="/arcade">
          ‹ Arcade
        </Link>
        <div className="wg-title">
          <strong>Word Garden</strong>
          <span>
            Match it · level {level} of 5 · {TOPIC[school] ?? TOPIC.P3}
          </span>
        </div>
        <span className="wg-pill">
          {bloomed} of {prompts.length} flowers
        </span>
        <div className="wg-seg" role="group" aria-label="Ghost hands">
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
      </header>
      <main className="wg-field">
        <div className="wg-card" data-w={wiggle ? (wiggle % 2 ? "a" : "b") : ""}>
          {done ? (
            <div className="wg-done">
              <p className="wg-ask">Your garden is in full bloom!</p>
              {result ? (
                <>
                  <div className="wg-stars" aria-label={`${result.stars} of 3 stars`}>
                    {[1, 2, 3].map((n) => (
                      <span key={n} data-on={n <= result.stars ? "yes" : "no"}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p>
                    {Math.round(result.accuracy * 100)}% right · ★ finish · ★★ 90% right · ★★★ 96% right. Same play, same stars.
                  </p>
                  <div className="wg-actions">
                    <button className="mk-btn mk-btn--secondary" type="button" onClick={restart}>
                      Plant again
                    </button>
                    {result.next && result.next.level !== level ? (
                      <a className="mk-btn mk-btn--primary" href={`/arcade/word-garden?level=${result.next.level}`}>
                        Next garden
                      </a>
                    ) : (
                      <Link className="mk-btn mk-btn--primary" href="/arcade">
                        Back to the Arcade
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <p>Counting your stars…</p>
              )}
            </div>
          ) : (
            <>
              <div
                className="wg-pic"
                role="img"
                aria-label={`Picture: ${prompt.clue}`}
                style={{ backgroundImage: `url(${critter.art}-800.webp)`, backgroundSize: `${crop.size}% auto`, backgroundPosition: `${crop.pos}% 50%` } as CSSProperties}
              />
              <p className="wg-ask">{school === "P3" ? `Which stage is this? ${prompt.clue}` : prompt.clue}</p>
              <div className="wg-letters" aria-label={`${typedN} of ${prompt.word.length} letters`}>
                {prompt.word.split("").map((ch, i) => (
                  <span key={`${qi}-${i}`} data-s={i < typedN ? "done" : i === typedN ? "now" : "todo"}>
                    {i < typedN ? ch.toUpperCase() : ""}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="wg-bed" aria-label={`${bloomed} flowers have bloomed`}>
          {miss && next && (
            <span key={miss.n} className="wg-hint" role="status">
              Almost! Try {next.toUpperCase()}.
            </span>
          )}
          {prompts.map((p, i) => {
            const g = i < bloomed ? 1 : i === bloomed && !done ? 0.15 + (typedN / p.word.length) * 0.55 : 0.05;
            return (
              <div key={i} className="wg-pot" data-s={i < bloomed ? "bloom" : i === bloomed && !done ? "now" : "wait"} style={{ "--g": g.toFixed(2), "--c": COLOURS[i % COLOURS.length] } as CSSProperties}>
                <span className="wg-stem" />
                <span className="wg-bloom" />
                {i === bloomed && typedN > 0 && <span key={typedN} className="wg-drop" style={{ animationName: typedN % 2 ? "wg-drop" : "wg-drop2" }} />}
              </div>
            );
          })}
        </div>
      </main>
      <section className="wg-keys">
        <GhostKeyboard nextKey={next} wrongKey={miss?.key ?? null} hands={hands} onKey={type} />
      </section>
    </div>
  );
}
