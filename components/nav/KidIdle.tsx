"use client";

// Kids sign out after 15 minutes with no taps, keys or scrolls (founder, 29 Oct), so nobody else carries on in their
// account. At 14 minutes a "Still there?" card counts down the last minute; any activity or "I'm here!" resets the
// clock. Signing out ends the kid's session only (DELETE /api/auth/kid), back to the doors or the sign-in page.
import { useEffect, useRef, useState } from "react";
import "./kidIdle.css";

export const IDLE_SIGN_OUT_MS = 15 * 60_000;
export const IDLE_WARN_MS = 14 * 60_000;
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/** Ends the kid's session and goes where the server says (the doors, or the sign-in page). */
export async function signKidOut(): Promise<void> {
  let next = "/signin";
  try {
    const res = await fetch("/api/auth/kid", { method: "DELETE" });
    const data = (await res.json()) as { next?: string };
    if (data.next === "/doors" || data.next === "/signin") next = data.next;
  } catch {
    // Offline: still leave the kid's screens.
  }
  window.location.assign(next);
}

export function KidIdle() {
  const last = useRef(0);
  const [left, setLeft] = useState<number | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    last.current = Date.now();
    const seen = () => {
      // While the card is up, only "I'm here!" counts, so a stray scroll can't hide it unseen.
      if (!document.querySelector(".kidle")) last.current = Date.now();
    };
    for (const e of EVENTS) window.addEventListener(e, seen, { passive: true, capture: true });
    const tick = window.setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= IDLE_SIGN_OUT_MS) {
        if (!leaving.current) {
          leaving.current = true;
          void signKidOut();
        }
        return;
      }
      setLeft(idle >= IDLE_WARN_MS ? Math.ceil((IDLE_SIGN_OUT_MS - idle) / 1000) : null);
    }, 1000);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, seen, { capture: true });
      window.clearInterval(tick);
    };
  }, []);

  if (left === null) return null;
  const here = () => {
    last.current = Date.now();
    setLeft(null);
  };
  const share = left / 60;
  return (
    <div className="kidle" role="alertdialog" aria-modal="true" aria-labelledby="kidle-title" aria-describedby="kidle-text">
      <div className="kidle-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="kidle-kix" src="/art/kix/expressions/idle-800.webp" alt="" />
        <h2 id="kidle-title" className="kidle-h">
          Still there?
        </h2>
        <p id="kidle-text" className="kidle-p">
          Kix will sign you out soon so nobody else can use your account.
        </p>
        <div className="kidle-ring" style={{ background: `conic-gradient(var(--accent) 0 ${(share * 100).toFixed(1)}%, var(--surface) ${(share * 100).toFixed(1)}% 100%)` }} aria-label={`${left} seconds left`}>
          <span>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="kidle-btns">
          <button type="button" className="kidle-here" onClick={here} autoFocus>
            I&apos;m here!
          </button>
          <button type="button" className="kidle-out" onClick={() => void signKidOut()}>
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
