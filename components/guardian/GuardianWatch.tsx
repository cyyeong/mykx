"use client";

// Kix as guardian, kid side (docs/prd/PARENT_INSIGHTS.md §1, AGENTS.md rule 12). Mounted once in the kid layout.
// Every 30 s while the page is visible it sends a heartbeat (what the child is doing, whether they've been idle)
// and gets Kix's next step back. When that step is a break or a wind-down, Kix says so kindly: a short break with a
// breathing guide, or "that's today's screen time". Never mid-question, never a punishment, and the child can
// always finish what they're doing. When focus dips before a break is due, Kix sparks something the child loves
// instead (lib/kix/interests.ts). Counts only; it never touches mastery or rewards.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Art } from "@/components/ui/Art";
import type { KidStatus } from "@/lib/guardian/load";
import { activityForPath } from "@/lib/guardian/screen-time";
import s from "./guardian.module.css";

const BEAT_MS = 30_000;
const IDLE_MS = 60_000;
const SNOOZE = { break: 5 * 60_000, rest: 10 * 60_000, spark: 10 * 60_000 } as const;
const BREAK_SEC = 120;
const SNOOZE_KEY = "mykx-guardian-snooze";

type Nudge = { kind: "break" | "rest" | "spark"; line: string; why: string; href?: string | null; cta?: string | null };

function snoozedUntil(kind: Nudge["kind"]): number {
  try {
    return Number(JSON.parse(sessionStorage.getItem(SNOOZE_KEY) ?? "{}")[kind] ?? 0);
  } catch {
    return 0;
  }
}

function snooze(kind: Nudge["kind"]) {
  try {
    const all = JSON.parse(sessionStorage.getItem(SNOOZE_KEY) ?? "{}") as Record<string, number>;
    all[kind] = Date.now() + SNOOZE[kind];
    sessionStorage.setItem(SNOOZE_KEY, JSON.stringify(all));
  } catch {
    // Private mode: the nudge may come back sooner. Fine.
  }
}

/** Questions finish first: Kix waits until the child is between tasks. */
const waits = (path: string) => /^\/question(\/|$)/.test(path);

export function GuardianWatch() {
  const path = usePathname();
  const pathRef = useRef(path);
  const lastInput = useRef(0);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [left, setLeft] = useState(BREAK_SEC);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    lastInput.current = Date.now();
    const mark = () => {
      lastInput.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    let live = true;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      const current = pathRef.current;
      try {
        const res = await fetch("/api/guardian/beat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: activityForPath(current), idle: Date.now() - lastInput.current > IDLE_MS }),
        });
        if (!res.ok || !live) return;
        const data = (await res.json()) as KidStatus & { ok: boolean };
        const step = data.next;
        if ((step.kind === "break" || step.kind === "rest" || step.kind === "spark") && !waits(current) && Date.now() > snoozedUntil(step.kind)) {
          setNudge({ kind: step.kind, line: step.line, why: step.why, href: step.href, cta: step.cta });
        }
      } catch {
        // Offline: screen time just isn't counted for this beat.
      }
    };
    const first = window.setTimeout(beat, 5_000);
    const timer = window.setInterval(beat, BEAT_MS);
    return () => {
      live = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, []);

  useEffect(() => {
    if (!onBreak) return;
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1_000);
    return () => window.clearTimeout(t);
  }, [onBreak, left]);

  if (onBreak) {
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, "0");
    return (
      <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="g-break-title">
        <div className={s.breakCard}>
          <div className={s.breath} aria-hidden="true">
            <Art base="/art/kix/expressions/idle" alt="" sizes="160px" className={s.breathKix} />
          </div>
          <h2 id="g-break-title" className={s.title}>
            {left > 0 ? "Breathe in… and out" : "Welcome back!"}
          </h2>
          <p className={s.line}>{left > 0 ? "Look far away, stretch up high, have some water." : "Your eyes and brain are ready again."}</p>
          <p className={s.timer} aria-live="polite">
            {left > 0 ? `${mm}:${ss}` : "Done"}
          </p>
          <button
            type="button"
            className="mk-btn mk-btn--primary"
            onClick={() => {
              setOnBreak(false);
              setLeft(BREAK_SEC);
            }}
          >
            {left > 0 ? "I'm back early" : "Let's go"}
          </button>
        </div>
      </div>
    );
  }

  if (!nudge) return null;
  return (
    <aside className={s.nudge} role="status" aria-live="polite" data-kind={nudge.kind}>
      <Art base="/art/kix/expressions/idle" alt="Kix" sizes="64px" className={s.kix} />
      <div className={s.body}>
        <p className={s.nudgeLine}>{nudge.line}</p>
        <p className={s.why}>{nudge.why}</p>
        <div className={s.actions}>
          {nudge.kind === "break" ? (
            <button
              type="button"
              className="mk-btn mk-btn--primary"
              onClick={() => {
                snooze("break");
                setNudge(null);
                setOnBreak(true);
              }}
            >
              Start a 2-minute break
            </button>
          ) : nudge.kind === "spark" && nudge.href && nudge.cta ? (
            <Link
              href={nudge.href}
              className="mk-btn mk-btn--primary"
              onClick={() => {
                snooze("spark");
                setNudge(null);
              }}
            >
              {nudge.cta}
            </Link>
          ) : null}
          <button
            type="button"
            className="mk-btn mk-btn--secondary"
            onClick={() => {
              snooze(nudge.kind);
              setNudge(null);
            }}
          >
            {nudge.kind === "break" ? "In a minute" : nudge.kind === "spark" ? "Back to it" : "Finish this bit"}
          </button>
        </div>
      </div>
    </aside>
  );
}
