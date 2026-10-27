"use client";

import { useEffect, useRef, useState } from "react";
import { LivingArt } from "@/components/scene/LivingArt";
import { useSound } from "@/components/sound/SoundProvider";
import { type PackId, getPack } from "@/components/theme/packs";
import { Art } from "@/components/ui/Art";
import type { LivingArtData } from "@/lib/scene/livingArt";
import vortexLiving from "@/public/art/living/transform-vortex.json";
import s from "./reveal.module.css";

type Result = { image: string; fallback: boolean };

const STEPS = [
  { label: (pack: string) => `Drawing Kix in the ${pack} style`, tag: "Muse Image", until: 14_000 },
  { label: () => "Cutting out your Kix sticker", tag: "SAM 3.1", until: 21_000 },
  { label: () => "Matching your app's colours", tag: null, until: Infinity },
];

/** Live transform: progress while Meta works, then the reveal. Always ends with a Kix. */
export function TransformReveal({
  pack,
  interests,
  onKeep,
  onClose,
}: {
  pack: PackId;
  interests: string[];
  onKeep: (image: string) => void;
  onClose: () => void;
}) {
  const { play } = useSound();
  const name = getPack(pack).name;
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    const t0 = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - t0), 250);
    fetch("/api/studio/transform", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pack, interests }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<Result>) : Promise.reject(new Error(String(r.status)))))
      .then((r) => setResult(r))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ image: `/art/kix/${pack}-800.webp`, fallback: true });
      })
      .finally(() => clearInterval(timer));
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [pack, interests, attempt]);

  useEffect(() => {
    if (result) play("reward");
  }, [result, play]);

  const showNow = () => {
    abort.current?.abort();
    setResult({ image: `/art/kix/${pack}-800.webp`, fallback: true });
  };
  const retry = () => {
    setResult(null);
    setElapsed(0);
    setAttempt((a) => a + 1);
    play("transform");
  };

  const active = STEPS.findIndex((st) => elapsed < st.until);
  const progress = Math.min(0.95, elapsed / 28_000);

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="reveal-title">
      {/* The vortex swirls and breathes; its stars orbit and its core glows (living art). */}
      <div className={s.vortex}>
        <div className="la-swirl-art">
          <Art base="/art/scenes/transform-vortex" alt="" sizes="100vw" className={s.vortexImg} />
          <LivingArt data={vortexLiving as LivingArtData} />
        </div>
      </div>
      {!result ? (
        <section className={s.panel}>
          <h2 id="reveal-title" className={s.title}>Kix is transforming…</h2>
          <ol className={s.steps}>
            {STEPS.map((st, i) => (
              <li key={i} className={s.step} data-state={i < active ? "done" : i === active ? "now" : "next"}>
                <span className={s.dot} aria-hidden="true" />
                <span className={s.stepLabel}>{st.label(name)}</span>
                {st.tag && <span className={s.tag}>{st.tag}</span>}
              </li>
            ))}
          </ol>
          <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <div className={s.foot}>
            <p className={s.note}>About 20 seconds. If it takes longer, Kix wears a ready-made {name} look.</p>
            <button type="button" className="mk-btn mk-btn--secondary" onClick={showNow}>
              Show me now
            </button>
          </div>
        </section>
      ) : (
        <section className={s.panel}>
          <h2 id="reveal-title" className={s.title}>Meet your Kix!</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.image} alt={`Your Kix in the ${name} style`} className={s.kix} />
          {result.fallback && <p className={s.note}>This is a ready-made {name} look. You can try again for your own.</p>}
          <div className={s.actions}>
            <button type="button" className="mk-btn mk-btn--reward" onClick={() => onKeep(result.image)}>
              Keep this Kix
            </button>
            <button type="button" className="mk-btn mk-btn--secondary" onClick={retry}>
              Try again
            </button>
            <button type="button" className={s.close} onClick={onClose}>
              Not now
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
