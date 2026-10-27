"use client";

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
        d={on ? "M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" : "M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6"}
      />
    </svg>
  );
}

function AmbienceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={s.icon}>
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17.5 15M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
    </svg>
  );
}

/** The HUD sound controls: one mute button, plus the pack's optional ambience bed. */
export function SoundToggle() {
  const { on, setOn, ambienceOn, setAmbienceOn, ambienceLabel } = useSound();
  return (
    <div className={s.hud} role="group" aria-label="Sound">
      <button type="button" className={s.btn} aria-pressed={on} title={on ? "Sound on" : "Sound off"} onClick={() => setOn(!on)}>
        <SpeakerIcon on={on} />
        <span className={s.label}>{on ? "Sound on" : "Sound off"}</span>
      </button>
      {ambienceLabel && (
        <button type="button" className={s.chip} aria-pressed={on && ambienceOn} disabled={!on} title={ambienceLabel} onClick={() => setAmbienceOn(!ambienceOn)}>
          <AmbienceIcon />
          <span className={s.label}>{ambienceLabel}</span>
        </button>
      )}
    </div>
  );
}
