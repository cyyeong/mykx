"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSound } from "./SoundProvider";
import s from "./sound.module.css";

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={s.icon}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={
          on
            ? "M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
            : "M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6"
        }
      />
    </svg>
  );
}

function AmbienceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={s.icon}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15M8 18l-1 3M12 18l-1 3M16 18l-1 3"
      />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={s.icon}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 18V6l10-2v11M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"
      />
    </svg>
  );
}

/** A small drum with two sticks: the Beat switch. */
function BeatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={s.icon}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 12c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M6.5 16.2l2.7 3.6 2.8-4.4 2.8 4.4 2.7-3.6M5 2.5l9.5 8M19 2.5l-9.5 8"
      />
    </svg>
  );
}

/** The HUD sound controls: one mute button, the composed theme and its beat, plus the pack's optional ambience bed.
 *  On phones they fold behind one Sound button (a small menu), so the pill never crowds a screen's header. */
export function SoundToggle() {
  const {
    on,
    setOn,
    musicOn,
    setMusicOn,
    beatOn,
    setBeatOn,
    ambienceOn,
    setAmbienceOn,
    ambienceLabel,
  } = useSound();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const hudRef = useRef<HTMLDivElement>(null);

  // The phone menu closes on Escape or a tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!hudRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div
      ref={hudRef}
      className={s.hud}
      role="group"
      aria-label="Sound"
      data-open={open}
    >
      <button
        type="button"
        className={s.more}
        aria-expanded={open}
        aria-controls={menuId}
        title="Sound settings"
        onClick={() => setOpen(!open)}
      >
        <SpeakerIcon on={on} />
        <span className={s.label}>Sound settings</span>
      </button>
      <div id={menuId} className={s.controls}>
        <button
          type="button"
          className={s.btn}
          aria-pressed={on}
          title={on ? "Sound on" : "Sound off"}
          onClick={() => setOn(!on)}
        >
          <SpeakerIcon on={on} />
          <span className={s.label}>{on ? "Sound on" : "Sound off"}</span>
        </button>
        <button
          type="button"
          className={s.chip}
          aria-pressed={on && musicOn}
          disabled={!on}
          title="Background music"
          onClick={() => setMusicOn(!musicOn)}
        >
          <MusicIcon />
          <span className={s.label}>Music</span>
        </button>
        <button
          type="button"
          className={s.chip}
          aria-label="Beat"
          aria-pressed={on && musicOn && beatOn}
          disabled={!on || !musicOn}
          title="Beat: the music's drums and bass"
          onClick={() => setBeatOn(!beatOn)}
        >
          <BeatIcon />
          <span className={s.label}>Beat</span>
        </button>
        {ambienceLabel && (
          <button
            type="button"
            className={s.chip}
            aria-pressed={on && ambienceOn}
            disabled={!on}
            title={ambienceLabel}
            onClick={() => setAmbienceOn(!ambienceOn)}
          >
            <AmbienceIcon />
            <span className={s.label}>{ambienceLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
