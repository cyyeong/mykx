"use client";

import { useState } from "react";
import { useRecorder } from "./useRecorder";
import s from "./voice.module.css";

export type TalkPhase = "idle" | "listening" | "transcribing" | "error";

type Props = {
  /** Called with the cleaned-up transcript (Kix's name fixed). */
  onTranscript: (text: string) => void;
  onPhase?: (phase: TalkPhase) => void;
};

/** Hold to talk; never a toggle that keeps listening (hard rule 9). */
export function TalkButton({ onTranscript, onPhase }: Props) {
  const { state, level, start, stop, cancel } = useRecorder();
  const [phase, setPhaseState] = useState<TalkPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const setPhase = (p: TalkPhase) => {
    setPhaseState(p);
    onPhase?.(p);
  };

  async function begin() {
    setMessage(null);
    await start();
    setPhase("listening");
  }

  async function finish() {
    const wav = await stop();
    if (!wav) {
      setPhase("idle");
      return;
    }
    setPhase("transcribing");
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", headers: { "content-type": "audio/wav" }, body: new Blob([new Uint8Array(wav)], { type: "audio/wav" }) });
      const body = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !body.text) throw new Error(body.error ?? "Kix couldn't hear that.");
      setPhase("idle");
      onTranscript(body.text);
    } catch (err) {
      setMessage((err as Error).message || "Kix couldn't hear that. Try again or type it.");
      setPhase("error");
    }
  }

  const listening = state === "listening";
  const blocked = state === "denied" || state === "unsupported";
  const label = blocked
    ? "Mic is off"
    : listening
      ? "Listening… let go to send"
      : phase === "transcribing"
        ? "Kix is listening back…"
        : "Hold to talk";
  const note = state === "denied" ? "Your mic is blocked. You can type instead." : state === "unsupported" ? "This browser can't record. You can type instead." : message ?? "Up to 30 seconds";

  return (
    <div className={s.talk}>
      <button
        type="button"
        className={s.mic}
        data-listening={listening || undefined}
        aria-label={listening ? "Recording. Let go to send to Kix" : "Hold to talk to Kix"}
        aria-pressed={listening}
        disabled={phase === "transcribing" || blocked}
        style={{ ["--level" as string]: level.toFixed(2) }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          void begin();
        }}
        onPointerUp={() => void finish()}
        onPointerCancel={cancel}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            void begin();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            void finish();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={s.micIcon}>
          <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
        </svg>
      </button>
      <span className={s.text}>
        <span className={s.label} aria-live="polite">{label}</span>
        <span className={s.note}>{note}</span>
      </span>
    </div>
  );
}
