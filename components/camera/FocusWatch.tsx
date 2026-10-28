"use client";

// The focus camera, kid side (docs/prd/PARENT_INSIGHTS.md §1, AGENTS.md rule 12). Mounted once in the kid layout;
// renders nothing unless the kid is on a learning screen (components/camera/learningSession.ts) and their grown-up
// switched the camera on (checked with /api/me each time learning starts). While the camera runs, a chip with a
// red dot says so the whole time; tapping it explains, and the kid can turn it off for now. When the counts show
// focus well below the kid's usual for 3 minutes, Kix suggests a short break: once per dip, at most every 10
// minutes. No pictures are kept or sent; the parent sees "possibly losing focus" notes, never the kid's face (a
// line-drawing replay of the face-mesh points can be checked on this device only, lib/signals/replay.ts).
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { kixSprite } from "@/components/signin/looks";
import type { KidMe } from "@/lib/auth/schemas";
import { FocusSession, type CameraState, type FocusMemory, type Unavailable } from "./focusSession";
import { isLearningRoute, useLearningSessionOpen } from "./learningSession";
import s from "./focusWatch.module.css";

const OFF_FOR_NOW = "mykx-focus-off";
const BREAK_SEC = 20;
const NOTICE_MS = 10_000;

const UNAVAILABLE: Record<Unavailable | "ended", string> = {
  denied: "Camera not allowed, so the focus camera is off.",
  "no-camera": "No camera found, so the focus camera is off.",
  busy: "The camera is busy in another app, so the focus camera is off.",
  unsupported: "This browser can't run the focus camera, so it's off.",
  failed: "The focus camera couldn't start, so it's off.",
  ended: "The camera stopped, so the focus camera is off.",
};

const NUDGE = {
  junior: "Brain break? Look far away for 20 seconds, then we'll carry on.",
  teen: "Quick reset? Look at something far away for 20 seconds, then carry on.",
};

function readOffForNow(): boolean {
  try {
    return sessionStorage.getItem(OFF_FOR_NOW) === "1";
  } catch {
    return false;
  }
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={s.icon}>
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 10.5l5-3v9l-5-3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={s.icon}>
      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function FocusWatch() {
  const pathname = usePathname();
  const sessionOpen = useLearningSessionOpen();
  const learning = isLearningRoute(pathname) || sessionOpen;

  const [kid, setKid] = useState<Pick<KidMe, "pack" | "band" | "cameraEnabled"> | null>(null);
  // Nothing renders before the /api/me check, so reading sessionStorage up front can't mismatch the server HTML.
  const [offForNow, setOffForNow] = useState(() => typeof window !== "undefined" && readOffForNow());
  const [blocked, setBlocked] = useState(false); // failed once on this page: no retry loop
  const [state, setState] = useState<CameraState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [breakLeft, setBreakLeft] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const memory = useRef<FocusMemory>({ baseline: null, minutes: [], lastSignalTo: undefined, lastNudgeAt: null });

  // Each time learning starts, ask the server whether the grown-up has the camera on for this kid.
  useEffect(() => {
    if (!learning) return;
    let live = true;
    void fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ kid?: KidMe }>) : null))
      .then((j) => live && setKid(j?.kid ? { pack: j.kid.pack, band: j.kid.band, cameraEnabled: j.kid.cameraEnabled } : null))
      .catch(() => live && setKid(null));
    return () => {
      live = false;
    };
  }, [learning]);

  const run = learning && Boolean(kid?.cameraEnabled) && !offForNow && !blocked;

  useEffect(() => {
    const video = videoRef.current;
    if (!run || !video) return;
    const session = new FocusSession(video, memory.current, {
      state: (next) => {
        setState(next);
        if (next.kind === "unavailable" || next.kind === "ended") {
          setBlocked(true);
          setNotice(UNAVAILABLE[next.kind === "ended" ? "ended" : next.reason]);
        }
      },
      nudge: () => setNudge(true),
      refused: () => setKid((k) => (k ? { ...k, cameraEnabled: false } : k)),
    });
    void session.start();
    return () => {
      session.stop();
      setState(null);
      setExplain(false);
    };
  }, [run]);

  // A calm line about a camera problem fades after a while; it never asks again on this page.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // The 20-second break, counted down on screen.
  useEffect(() => {
    if (breakLeft === null) return;
    if (breakLeft <= 0) {
      const t = setTimeout(() => {
        setBreakLeft(null);
        setNudge(false);
      }, 1800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBreakLeft(breakLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [breakLeft]);

  const turnOffForNow = () => {
    try {
      sessionStorage.setItem(OFF_FOR_NOW, "1");
    } catch {
      // Private mode: off until this page reloads.
    }
    setOffForNow(true);
    setExplain(false);
  };

  const camOn = run && state !== null && state.kind !== "unavailable" && state.kind !== "ended";
  const live = camOn && state?.kind === "on";
  const pack = kid?.pack ?? "dreamlight";
  const showNudge = nudge && learning;

  return (
    <>
      {run && <video ref={videoRef} className={s.video} muted playsInline aria-hidden="true" tabIndex={-1} />}

      {camOn && (
        <div className={s.dock}>
          <button
            type="button"
            className={s.chip}
            data-live={live ? "true" : "false"}
            aria-expanded={explain}
            aria-controls="focus-cam-explain"
            aria-label={live ? "Focus camera on. It stays on this device. Tap to learn more." : "Focus camera starting. Tap to learn more."}
            onClick={() => setExplain((v) => !v)}
          >
            <span className={s.dot} aria-hidden="true" />
            <span className={s.chipText} aria-hidden="true">
              <span className={s.chipMain}>{live ? "Focus camera on" : "Focus camera starting…"}</span>
              <span className={s.chipSep}> — </span>
              <span className={s.chipSub}>stays on this device</span>
            </span>
          </button>
          {explain && (
            <div id="focus-cam-explain" className={s.explain} role="dialog" aria-label="About the focus camera">
              <p className={s.explainLine}>
                <CameraIcon />
                <span>It counts looks away, sleepy eyes and yawns right here. No pictures are saved or sent. So your grown-up can check it, a line drawing of your face shape from those few seconds stays on this device for a week.</span>
              </p>
              <div className={s.explainActs}>
                <button type="button" className={s.textBtn} onClick={turnOffForNow}>
                  Turn off for now
                </button>
                <button type="button" className={s.textBtn} onClick={() => setExplain(false)}>
                  Got it
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!camOn && notice && (
        <div className={s.dock}>
          <p className={s.notice} role="status">
            <CameraIcon />
            <span>{notice}</span>
            <button type="button" className={s.iconBtn} aria-label="Dismiss" onClick={() => setNotice(null)}>
              <CloseIcon />
            </button>
          </p>
        </div>
      )}

      {showNudge && (
        <aside className={s.nudge} data-theme={pack} role="status" aria-live="polite" aria-label="Kix suggests a break">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.kix} src={kixSprite(pack)} alt="" />
          <div className={s.bubble}>
            <button
              type="button"
              className={s.close}
              aria-label="Close"
              onClick={() => {
                setNudge(false);
                setBreakLeft(null);
              }}
            >
              <CloseIcon />
            </button>
            {breakLeft === null ? (
              <>
                <p className={s.line}>{NUDGE[kid?.band ?? "junior"]}</p>
                <div className={s.acts}>
                  <button type="button" className="mk-btn mk-btn--primary" onClick={() => setBreakLeft(BREAK_SEC)}>
                    Start 20 seconds
                  </button>
                  <button type="button" className="mk-btn mk-btn--secondary" onClick={() => setNudge(false)}>
                    Not now
                  </button>
                </div>
              </>
            ) : breakLeft > 0 ? (
              <div className={s.timer}>
                <span className={s.ring} style={{ "--left": breakLeft / BREAK_SEC } as CSSProperties} aria-hidden="true">
                  <span className={s.count}>{breakLeft}</span>
                </span>
                <p className={s.line}>
                  Look far away… <span className={s.srOnly}>{breakLeft} seconds left.</span>
                </p>
              </div>
            ) : (
              <p className={s.line}>Nice! Back to it.</p>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
