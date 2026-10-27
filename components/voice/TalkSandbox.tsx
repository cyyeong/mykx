"use client";

import { useState } from "react";
import { useTheme } from "@/components/theme/ThemeRoot";
import { Art } from "@/components/ui/Art";
import { TalkButton, type TalkPhase } from "./TalkButton";
import { useKixVoice } from "./useKixVoice";
import s from "./talk.module.css";

const KIX = {
  idle: "/art/kix/expressions/idle",
  listening: "/art/kix/expressions/thinking",
  speaking: "/art/kix/expressions/hint",
} as const;

/** A voice test: hold to talk, confirm what Kix heard, hear Kix read it back. */
export function TalkSandbox() {
  const { band } = useTheme();
  const { speak, speaking, wordIndex } = useKixVoice(band);
  const [phase, setPhase] = useState<TalkPhase>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [reply, setReply] = useState<string | null>(null);

  const confirm = (text: string) => {
    const line = `I heard you say: ${text}`;
    setReply(line);
    setHeard(null);
    speak(line);
  };

  const words = reply ? reply.split(/\s+/) : [];
  const face = speaking ? KIX.speaking : phase === "listening" || phase === "transcribing" ? KIX.listening : KIX.idle;

  return (
    <main className={s.page}>
      <section className={s.panel} aria-labelledby="talk-title">
        <div className={s.head}>
          <h1 id="talk-title" className={s.title}>Talk to Kix</h1>
          <span className={s.chip}>Voice test</span>
        </div>
        <p className={s.lede}>Hold the mic and ask. Kix shows what it heard first.</p>

        <div className={s.row}>
          <Art base={face} alt="Kix" sizes="180px" className={s.kix} />
          <div className={s.bubble} aria-live="polite">
            {heard ? (
              <>
                <span className={s.small}>I heard:</span>
                <span>“{heard}”</span>
              </>
            ) : reply ? (
              <span>
                {words.map((w, i) => (
                  <span key={i} className={i === wordIndex ? s.now : undefined}>
                    {w}{" "}
                  </span>
                ))}
              </span>
            ) : phase === "listening" ? (
              <span className={s.muted}>Listening…</span>
            ) : phase === "transcribing" ? (
              <span className={s.muted}>Working out what you said…</span>
            ) : (
              <span>Hold the mic and ask me anything!</span>
            )}
          </div>
        </div>

        {heard && (
          <div className={s.actions}>
            <button className="mk-btn mk-btn--primary" type="button" onClick={() => confirm(heard)}>
              That&apos;s right
            </button>
            <button className="mk-btn mk-btn--secondary" type="button" onClick={() => setHeard(null)}>
              Say it again
            </button>
          </div>
        )}

        <div className={s.controls}>
          <TalkButton
            onPhase={setPhase}
            onTranscript={(text) => {
              setReply(null);
              setHeard(text);
            }}
          />
          <form
            className={s.typed}
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) confirm(typed.trim());
              setTyped("");
            }}
          >
            <label htmlFor="talk-typed" className={s.srOnly}>Or type it</label>
            <input id="talk-typed" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type it here…" className={s.input} />
            <button type="submit" className={s.send} aria-label="Send to Kix">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
        <p className={s.footnote}>Kix speaks with your device&apos;s voice. Your recording is turned into text and never saved.</p>
      </section>
    </main>
  );
}
