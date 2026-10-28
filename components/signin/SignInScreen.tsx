"use client";

// The door sign-in, ported from the Login board (canvas row 8). A living city behind a grand door; on success the
// card folds away, the leaves swing open and a time tunnel carries the person to their landing page.
// idle -> opening (1.15 s) -> tunnel (1.4 s, drawn on a canvas by WarpCanvas) -> arrived -> navigate. Reduced
// motion: straight to arrived.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { WarpCanvas } from "./WarpCanvas";
import { useSound } from "@/components/sound/SoundProvider";
import { useTheme } from "@/components/theme/ThemeRoot";
import type { PackId } from "@/components/theme/packs";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import type { LivingArtData } from "@/lib/scene/livingArt";
import neonCity from "@/public/art/living/city-neon.json";
import twilightCity from "@/public/art/living/city-twilight.json";
import { LOOKS, PAD_PICTURES, kixSprite, type DoorVariant, type PictureId } from "./looks";
import "@/components/scene/scene.css";
import "./signin.css";

type Phase = "idle" | "error" | "opening" | "tunnel" | "arrived";
type Reply = { ok?: boolean; next?: string; reason?: string; triesLeft?: number; retryAfterSec?: number };
type KidSecret = { kind: "pictures"; code: PictureId[] } | { kind: "password"; password: string };

/** Custom properties ride along in style objects. */
const vars = (o: Record<string, string | number>) => o as CSSProperties;

const WRONG_GROWN_UP = "That's not it. Try again, or reset your password.";
const WRONG_KID = "That's not it. Try again, or ask a grown-up.";
const LOCKED_KID = "Let's take a short break. Try again in a minute, or ask a grown-up.";
const SLOW_DOWN = "Too many tries. Wait a minute, then try again.";
const UNAVAILABLE = "Signing in isn't working right now. Try again in a moment.";
const NEEDS_GROWN_UP = "A grown-up needs to sign in on this device first.";
const KNOCKS: Record<DoorVariant, string[]> = {
  default: ["Knock knock. The door opens when you sign in.", "Shh… the whole city heard that.", "Good knock. Now the password."],
  junior: ["Who's there? Tap your 4 pictures!", "Knock knock! Kix is coming!", "Hee hee, the door tickles!"],
  teen: ["Knock knock. Password, please.", "Locked. You know the drill.", "Nice rhythm."],
};

// The living city. Negative delays spread the loops out and give a good still frame under reduced motion.
const STARS = [[6, 8, 11, 0, 3.2], [14, 22, 7, -1.2, 4.1], [22, 5, 13, -2.1, 3.6], [31, 16, 6, -0.6, 2.8], [38, 31, 9, -1.8, 4.4], [46, 9, 7, -2.6, 3.1], [57, 15, 12, -0.3, 3.9], [64, 29, 6, -1.5, 2.6], [71, 6, 9, -2.9, 4.2], [79, 19, 14, -0.9, 3.4], [87, 10, 7, -2.2, 2.9], [94, 26, 10, -1.1, 3.7], [3, 34, 6, -3.1, 4.6], [52, 37, 6, -0.4, 3.3], [89, 39, 8, -2.4, 3.8], [26, 41, 7, -1.6, 4.0]].map(
  ([x, y, s, d, u]) => ({ left: `${x}%`, top: `${y}%`, width: s, animationDelay: `${d}s`, animationDuration: `${u}s` }),
);
const LANTERNS = [[7, 12, 16, 26, -3, 24], [17, 9, 12, 32, -18, -18], [29, 14, 18, 28, -9, 30], [41, 8, 11, 36, -27, 14], [61, 13, 17, 30, -14, -26], [72, 10, 13, 34, -4, 20], [83, 15, 19, 27, -21, -30], [94, 9, 12, 38, -11, 16]].map(
  ([x, w, h, d, dl, sw]) => vars({ left: `${x}%`, width: w, height: h, animationDuration: `${d}s`, animationDelay: `${dl}s`, "--sway": `${sw}px` }),
);
const MOTES = [[5, 4, 16, -2, 40, 1], [13, 3, 20, -11, -30, 2], [21, 5, 14, -6, 24, 1], [33, 3, 22, -15, -20, 2], [44, 4, 18, -3, 30, 1], [58, 3, 15, -9, -36, 2], [67, 5, 21, -17, 20, 1], [76, 3, 17, -5, -24, 2], [85, 4, 19, -12, 34, 1], [95, 3, 16, -8, -28, 2], [38, 3, 24, -20, 18, 1], [90, 5, 23, -1, -16, 2]].map(
  ([x, s, d, dl, sw, c]) => {
    const g = c === 2 ? "var(--lg-glow-2)" : "var(--lg-glow)";
    return vars({ left: `${x}%`, width: s, height: s, animationDuration: `${d}s`, animationDelay: `${dl}s`, "--sway": `${sw}px`, background: `rgb(${g})`, boxShadow: `0 0 8px 2px rgba(${g}, 0.7)` });
  },
);
const FIREFLIES = [[7, 62, 9, -2, 0, 5], [16, 78, 11, -6, 1, 4], [24, 55, 8, -1, 0, 4], [35, 84, 12, -7, 1, 5], [66, 58, 10, -3, 1, 4], [74, 80, 9, -5, 0, 5], [83, 64, 13, -9, 1, 4], [92, 86, 10, -4, 0, 5], [50, 92, 11, -8, 0, 4]].map(
  ([x, y, d, dl, b, s], i) => ({
    cls: b ? "lg-firefly lg-firefly-b" : "lg-firefly",
    style: { left: `${x}%`, top: `${y}%`, width: s, height: s, animationDuration: `${d}s`, animationDelay: `${dl}s` },
    blink: { animationDuration: `${(2 + (i % 3) * 0.7).toFixed(1)}s`, animationDelay: `${(dl * 0.7).toFixed(1)}s` },
  }),
);
// Flyers cross in the first 62% of their loop; walkers in the first 80%. "few" ones hide on phones.
const FLY = [
  { top: "13%", size: 78, dur: 26, delay: -4, rtl: false, few: false },
  { top: "27%", size: 54, dur: 34, delay: -18.2, rtl: true, few: false },
  { top: "7%", size: 40, dur: 44, delay: -21.8, rtl: false, few: true },
];
const WALK = [
  { size: 50, dur: 48, delay: -6.9, rtl: false, lift: 0, few: false },
  { size: 42, dur: 60, delay: -20.6, rtl: true, lift: 10, few: false },
  { size: 36, dur: 72, delay: -46.1, rtl: false, lift: 18, few: true },
];
const SPARK = "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z";

/** Sky, lanterns or motes, fireflies and flying Kix. Decorative; never re-renders with the form. */
const LivingCity = memo(function LivingCity({ variant, world }: { variant: DoorVariant; world?: string }) {
  const look = LOOKS[variant];
  return (
    <div className="lg-scene" aria-hidden="true">
      {/* The city's own aurora, stars, lanterns, lights and plants move (living art); the city drifts as a whole.
          A kid who came by magic name stands in their own world instead (MagicName.tsx). */}
      <div className="lg-city">
        {world ? (
          <Art base={world} className="lg-city-img" alt="" sizes="106vw" fetchPriority="high" />
        ) : (
          <>
            <Art base={look.city} className="lg-city-img" alt="" sizes="106vw" fetchPriority="high" />
            <LivingArt data={(look.city.endsWith("neon") ? neonCity : twilightCity) as LivingArtData} oy="70%" />
          </>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(10, 8, 34, 0.38) 0%, rgba(10, 8, 34, 0) 32%, rgba(10, 8, 34, 0) 58%, rgba(10, 8, 34, 0.5) 100%), radial-gradient(ellipse 50% 45% at 50% 50%, rgba(var(--lg-glow), 0.12), rgba(var(--lg-glow), 0) 70%)",
        }}
      />
      <div className="lg-amb">
        {STARS.map((style, i) => (
          <svg key={i} className="lg-star" viewBox="0 0 24 24" style={style}>
            <path fill="currentColor" d={SPARK} />
          </svg>
        ))}
        <div className="lg-shoot" style={{ left: "74%", top: "7%" }}>
          <span className="lg-shoot-line" />
        </div>
        <div className="lg-shoot" style={{ left: "40%", top: "4%" }}>
          <span className="lg-shoot-line" style={{ width: 110, animationDuration: "17s", animationDelay: "-9s" }} />
        </div>
        {variant !== "teen" && LANTERNS.map((style, i) => <span key={i} className="lg-lantern lg-tap" data-tap="lantern" data-i={i} style={style} />)}
        {variant === "teen" && MOTES.map((style, i) => <span key={i} className="lg-mote lg-tap" data-tap="lantern" data-i={i} style={style} />)}
        {FIREFLIES.map((ff, i) => (
          <span key={i} className={ff.cls} style={ff.style}>
            <span className="lg-blink" style={ff.blink} />
          </span>
        ))}
        {FLY.map((f, i) => {
          const timing = { animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, animationDirection: f.rtl ? "reverse" : "normal" } as const;
          return (
            <div key={i} className={f.few ? "lg-fly lg-few" : "lg-fly"} style={{ top: f.top, width: f.size, ...timing }}>
              <div className="lg-arc" style={timing}>
                <div className="lg-flip lg-tap" data-tap="flyer" style={f.rtl ? { transform: "scaleX(-1)" } : undefined}>
                  <span className="lg-trail" />
                  <svg className="lg-tspark" viewBox="0 0 24 24" style={{ right: "96%", top: "28%", width: "16%", animationDelay: "-0.2s" }}>
                    <path fill="currentColor" d={SPARK} />
                  </svg>
                  <svg className="lg-tspark" viewBox="0 0 24 24" style={{ right: "130%", top: "58%", width: "11%", animationDelay: "-0.7s" }}>
                    <path fill="currentColor" d={SPARK} />
                  </svg>
                  <svg className="lg-tspark" viewBox="0 0 24 24" style={{ right: "166%", top: "40%", width: "8%", animationDelay: "-1.1s" }}>
                    <path fill="currentColor" d={SPARK} />
                  </svg>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="lg-flutter" src={look.flyers[i]} alt="" style={{ width: f.size, animationDelay: `${-i * 0.6}s` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/** Walkers pass behind the door; the time tunnel is centred on it. */
const Door = memo(function Door({ variant, rattle }: { variant: DoorVariant; rattle: "" | "a" | "b" }) {
  const look = LOOKS[variant];
  return (
    <div className="lg-doorzone" aria-hidden="true">
      <div className="lg-aura" />
      <div className="lg-walkers">
        {WALK.map((w, i) => (
          <div
            key={i}
            className={w.few ? "lg-walk lg-few" : "lg-walk"}
            style={{ bottom: w.lift, width: w.size, animationDuration: `${w.dur}s`, animationDelay: `${w.delay}s`, animationDirection: w.rtl ? "reverse" : "normal" }}
          >
            <span className="lg-shadow" />
            <div className="lg-step lg-tap" data-tap="walker" data-i={i} style={{ animationDelay: `${(-i * 0.21).toFixed(2)}s` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lg-walker-img" src={look.walkers[i]} alt="" style={{ width: w.size, transform: w.rtl ? "scaleX(-1)" : undefined }} />
            </div>
          </div>
        ))}
      </div>
      <div className={rattle ? `lg-door lg-rattle-${rattle}` : "lg-door"} data-tap="door">
        <div className="lg-doorway">
          <div className="lg-dw-spin">
            <Art base="/art/scenes/transform-vortex" alt="" sizes="60vh" />
          </div>
          <div className="lg-dw-core" />
        </div>
        <div className="lg-rays" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lg-leaf lg-leaf--l" src={look.leafL} alt="" draggable="false" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lg-leaf lg-leaf--r" src={look.leafR} alt="" draggable="false" />
        <div className="lg-seam" />
        <div className="lg-flood" />
      </div>
    </div>
  );
});

function Message({ text, tone }: { text: string; tone: "grown-up" | "junior" | "teen" }) {
  const big = tone === "junior";
  return (
    <p
      style={{
        margin: 0,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-raised)",
        boxShadow: `inset 4px 0 0 ${tone === "grown-up" ? "var(--warn)" : "var(--accent-2)"}, inset 0 0 0 1px var(--line)`,
        color: "var(--ink)",
        fontSize: big ? 18 : tone === "teen" ? 16 : 15,
        lineHeight: big ? "25px" : tone === "teen" ? "22px" : "21px",
        fontWeight: tone === "teen" ? 600 : 700,
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: big ? 22 : 20, height: big ? 22 : 20, flex: "none", marginTop: 1, color: tone === "grown-up" ? "var(--warn)" : "var(--accent)" }}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M12 11v5M12 7.6v.2" />
      </svg>
      <span>{text}</span>
    </p>
  );
}

function EyeButton({ shown, onToggle, controls }: { shown: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      className="lg-eye"
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      aria-controls={controls}
      style={{ display: "grid", placeItems: "center", width: 44, height: 44, flex: "none", padding: 0, border: 0, borderRadius: "var(--radius-sm)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer" }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
        {shown ? (
          <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        ) : (
          <>
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          </>
        )}
      </svg>
    </button>
  );
}

const fieldBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 48,
  boxSizing: "border-box",
  padding: "0 2px 0 14px",
  borderRadius: "var(--radius-md)",
  background: "var(--surface-raised)",
  boxShadow: "inset 0 0 0 2px var(--border-control)",
};
const inputStyle: CSSProperties = { flex: 1, minWidth: 0, height: "100%", padding: 0, border: 0, background: "transparent", color: "var(--ink)", font: "500 16px/1 var(--font-text)" };
const labelStyle: CSSProperties = { fontSize: 15, lineHeight: "20px", fontWeight: 800, color: "var(--ink)" };
const glassCard: CSSProperties = {
  color: "var(--ink)",
  background: "var(--surface-glass)",
  WebkitBackdropFilter: "blur(22px) saturate(1.2)",
  backdropFilter: "blur(22px) saturate(1.2)",
  boxShadow: "inset 0 0 0 1px rgba(var(--lg-glow), 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 0 40px rgba(var(--lg-glow), 0.14), 0 24px 60px rgba(8, 6, 30, 0.45)",
};

async function post(url: string, body: unknown): Promise<{ status: number; data: Reply }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Reply;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: {} };
  }
}

export function SignInScreen({
  variant,
  pack = "dreamlight",
  kid,
  world,
  solo,
  onMagicName,
}: {
  variant: DoorVariant;
  /** The kid's world; grown-ups always get Dreamlight. */
  pack?: PackId;
  /** Kid doors only: who this door belongs to. needsSetup: no picture code yet, so the kid picks one now. */
  kid?: { id: string; nickname: string; needsSetup?: boolean };
  /** A kid who came by magic name: their world's art stands in for the city. */
  world?: string;
  /** A magic-name door (no grown-up here): the door ticket cookie says who; "Not you?" goes back to the sign-in card. */
  solo?: { onBack: () => void };
  /** The grown-ups' card: the kids' line opens the magic-name dialog. */
  onMagicName?: () => void;
}) {
  const router = useRouter();
  const { play } = useSound();
  const { setBand } = useTheme();
  const look = LOOKS[variant];
  const theme: PackId = variant === "default" ? "dreamlight" : pack;
  const name = kid?.nickname.trim() ?? "";

  const [phase, setPhase] = useState<Phase>("idle");
  const [live, setLive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teenPw, setTeenPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState<PictureId[]>([]);
  /** Set-up only: the first round of the new picture code, waiting to be tapped again. */
  const [firstPick, setFirstPick] = useState<PictureId[] | null>(null);
  const [note, setNote] = useState("");
  const [errorText, setErrorText] = useState("");
  const [hidden, setHidden] = useState(false);
  const [knock, setKnock] = useState<{ n: number; line: string } | null>(null);
  const timers = useRef<number[]>([]);
  const { prop } = useSound();
  const lastKnock = useRef(-1);

  // Sound defaults follow the band (on for Junior, off for Teen).
  useEffect(() => setBand(look.band), [look.band, setBand]);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    const pending = timers.current;
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      pending.forEach((t) => clearTimeout(t));
    };
  }, []);

  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  };
  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  const busy = pending || phase === "opening" || phase === "tunnel" || phase === "arrived";
  // Any new input clears the last message.
  const calm = () => {
    setNote("");
    if (phase === "error") setPhase("idle");
  };

  const open = (dest: string) => {
    router.prefetch(dest);
    clearTimers();
    setLive(true);
    setNote("");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("arrived");
      later(700, () => router.replace(dest));
      return;
    }
    play("transform", theme);
    setPhase("opening");
    later(1150, () => setPhase("tunnel"));
    later(2550, () => {
      setPhase("arrived");
      play("packPick", theme);
    });
    later(3500, () => router.replace(dest));
  };

  const fail = (text: string) => {
    clearTimers();
    setLive(true);
    setAttempt((a) => a + 1);
    setCode([]);
    setPassword("");
    setTeenPw("");
    setNote("");
    setErrorText(text);
    setPhase("error");
  };

  const explain = (text: string) => {
    setCode([]);
    if (phase === "error") setPhase("idle");
    setNote(text);
  };

  const submitGrownUp = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) return explain("Type your email and password first.");
    setPending(true);
    // A safe ?next= (put there by a grown-up page that needed sign-in) rides along; the server allowlists it.
    const params = new URLSearchParams(window.location.search);
    const { status, data } = await post("/api/auth/parent", { email: email.trim(), password, next: params.get("next") ?? undefined });
    setPending(false);
    if (data.ok) open(data.next ?? "/doors");
    else if (status === 401) fail(WRONG_GROWN_UP);
    else if (status === 429) fail(SLOW_DOWN);
    else explain(UNAVAILABLE);
  };

  const forgot = async () => {
    if (!email.trim()) return explain("Type your email first, then tap “Forgot password?”.");
    await post("/api/auth/reset", { email: email.trim() });
    explain("If that email has a myKx account, a reset link is on its way.");
  };

  const submitKid = async (secret: KidSecret, setup = false) => {
    if (!kid) return;
    setPending(true);
    const { status, data } = solo ? await post("/api/auth/kid", { door: true, secret }) : await post("/api/auth/kid", { kidId: kid.id, secret, ...(setup && { setup: true }) });
    setPending(false);
    if (data.ok) open(data.next ?? "/home");
    else if (status === 401) fail(WRONG_KID);
    else if (status === 423 || status === 429) fail(LOCKED_KID);
    else if (status === 403) explain(NEEDS_GROWN_UP);
    else explain(UNAVAILABLE);
  };

  const submitTeen = () => {
    if (busy) return;
    if (!teenPw) return explain("Type your password first.");
    void submitKid({ kind: "password", password: teenPw });
  };

  const tap = (id: PictureId) => {
    if (busy || code.length >= 4) return;
    play("tap", theme);
    calm();
    const next = [...code, id];
    setCode(next);
    if (next.length < 4) return;
    if (!kid?.needsSetup) {
      later(320, () => void submitKid({ kind: "pictures", code: next }));
    } else if (!firstPick) {
      later(320, () => {
        setFirstPick(next);
        setCode([]);
      });
    } else if (next.join("|") === firstPick.join("|")) {
      later(320, () => void submitKid({ kind: "pictures", code: next }, true));
    } else {
      later(320, () => {
        setFirstPick(null);
        fail("Those didn't match. Let's pick 4 again.");
      });
    }
  };

  // The living city: lanterns sing a note each, Kix loops when caught, walkers hop, the door answers a knock.
  // Classes are toggled on the (memoised, decorative) elements directly so the city never re-renders.
  const onCityTap = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tap]");
    if (!el) return;
    const what = el.dataset.tap;
    if (what === "door") {
      if (busy) return;
      const lines = KNOCKS[variant];
      let i = Math.floor(Math.random() * lines.length);
      if (i === lastKnock.current) i = (i + 1) % lines.length;
      lastKnock.current = i;
      prop("knock", { pack: theme });
      setKnock((k) => ({ n: (k?.n ?? 0) + 1, line: lines[i] }));
    } else if (what === "lantern") prop("chime", { pack: theme, step: Number(el.dataset.i ?? 0) });
    else if (what === "flyer") prop("flutter", { pack: theme });
    else prop("pop", { pack: theme });
    el.classList.remove("lg-tapped");
    void el.offsetWidth; // restart the animation
    el.classList.add("lg-tapped");
  };

  const msg = phase === "error" ? errorText : note;
  const hi = name ? `Hi ${name}!` : "Hi!";
  const bubble = !kid?.needsSetup
    ? `${hi} Tap your 4 pictures.`
    : firstPick
      ? "Now tap the same 4 again, in the same order."
      : `${hi} Pick 4 pictures. They'll be your secret code.`;
  const rattle = phase === "error" ? (attempt % 2 ? "a" : "b") : "";
  const arriveTitle = variant === "default" ? "Welcome back" : name ? `Hi ${name}! Your world is ready.` : "Your world is ready.";
  const announce = phase === "arrived" ? arriveTitle : phase === "opening" && live ? "Opening the door." : "";

  return (
    <div
      className="lg-root"
      data-theme={theme}
      data-band={look.band}
      data-variant={variant}
      data-state={phase}
      data-live={live ? "yes" : "no"}
      data-paused={hidden ? "yes" : "no"}
      style={{ background: "var(--twilight, #1E1C45)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      <div onClick={onCityTap} className="lg-city-taps">
        <LivingCity variant={variant} world={world} />
      </div>
      <main className="lg-stage" onClick={onCityTap}>
        <Door variant={variant} rattle={rattle} />
        {knock && phase !== "opening" && phase !== "tunnel" && (
          <span key={knock.n} className="ls-note lg-knock-note" role="status">
            {knock.line}
          </span>
        )}
        <section className="lg-card" aria-labelledby="lg-title" aria-busy={pending} style={glassCard}>
          {variant === "default" && (
            <div className="lg-dgrid">
              <div className="lg-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/wordmark-on-dark.svg" alt="myKx" style={{ display: "block", height: 28, width: "auto", alignSelf: "flex-start" }} />
                <h1 id="lg-title" className="lg-h1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--ink)" }}>
                  Welcome to myKx
                </h1>
                <p style={{ margin: 0, fontSize: 16, lineHeight: "23px", fontWeight: 500, color: "var(--ink-muted)" }}>Sign in for tonight&apos;s family summary.</p>
              </div>
              <form className="lg-dform" onSubmit={submitGrownUp} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="lg-email" style={labelStyle}>
                    Email
                  </label>
                  <div className="lg-field" style={{ ...fieldBox, padding: "0 14px" }}>
                    <input
                      id="lg-email"
                      className="lg-input"
                      type="email"
                      name="email"
                      autoComplete="username"
                      inputMode="email"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        calm();
                      }}
                      placeholder="you@example.com"
                      aria-describedby="lg-msg"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="lg-password" style={labelStyle}>
                    Password
                  </label>
                  <div className="lg-field" style={fieldBox}>
                    <input
                      id="lg-password"
                      className="lg-input"
                      type={showPw ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        calm();
                      }}
                      aria-describedby="lg-msg"
                      style={inputStyle}
                    />
                    <EyeButton shown={showPw} onToggle={() => setShowPw(!showPw)} controls="lg-password" />
                  </div>
                </div>
                <button className="mk-btn mk-btn--reward" type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                  </svg>
                  {pending ? "Checking…" : "Sign in"}
                </button>
                <div id="lg-msg" aria-live="polite">
                  {msg && <Message text={msg} tone="grown-up" />}
                </div>
                <button type="button" className="lg-link lg-linkbtn" onClick={forgot} style={{ alignSelf: "flex-start", fontSize: 15, lineHeight: "20px" }}>
                  Forgot password?
                </button>
              </form>
              <div className="lg-meta">
                {onMagicName ? (
                  <button type="button" className="lg-magic" onClick={onMagicName} aria-haspopup="dialog">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/art/login/kix.webp" alt="" className="lg-magic-kix" />
                    <span className="lg-magic-say">
                      <b>Kids:</b> tell me your magic name, and I shall bring your magical door
                    </span>
                  </button>
                ) : (
                  <Link
                  href="/doors"
                  style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 44, boxSizing: "border-box", padding: "0 16px 0 12px", borderRadius: "var(--radius-pill)", background: "rgba(var(--lg-glow), 0.12)", boxShadow: "inset 0 0 0 1.5px rgba(var(--lg-glow), 0.5)", color: "var(--ink)", fontSize: 15, lineHeight: "20px", fontWeight: 800, textDecoration: "none" }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20, flex: "none", color: "var(--reward)" }}>
                    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 21h16M6 21V9a6 6 0 0 1 12 0v12M12 3v18M10 13h.01M14 13h.01" />
                  </svg>
                  <span>Kids: find your door</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, flex: "none" }}>
                    <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                )}
                <p style={{ margin: 0, display: "flex", gap: 10, fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, flex: "none", marginTop: 1 }}>
                    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span>We keep your email and your family&apos;s learning progress, nothing more. Kids never need an email.</span>
                </p>
              </div>
            </div>
          )}

          {variant === "junior" && (
            <>
              <h1 id="lg-title" className="lg-sr">
                {name ? `Open ${name}'s door` : "Open your door"}
              </h1>
              <div className="lg-jgrid">
                <div className="lg-jkix">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={kixSprite(theme)} className="lg-jkix-img" alt="" style={{ filter: "drop-shadow(0 8px 12px rgba(29, 51, 36, 0.25))" }} />
                  <p style={{ position: "relative", flex: "1 1 auto", minWidth: 0, margin: 0, padding: "12px 16px", borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 2px var(--line), var(--shadow-raised)", fontFamily: "var(--font-display)", fontSize: 20, lineHeight: "26px", fontWeight: 600, color: "var(--ink)" }}>
                    <span aria-hidden="true" style={{ position: "absolute", left: -8, top: "50%", width: 16, height: 16, marginTop: -8, background: "var(--surface-raised)", transform: "rotate(45deg)", boxShadow: "-2px 2px 0 0 var(--line)" }} />
                    <span style={{ position: "relative" }}>{bubble}</span>
                  </p>
                </div>
                <div className="lg-jpad">
                  <div className="lg-pad" role="group" aria-label="Picture code. Tap 4 pictures.">
                    {PAD_PICTURES.map((p) => (
                      <button
                        key={p.id}
                        className="lg-tile"
                        type="button"
                        data-tip={p.label}
                        onClick={() => tap(p.id)}
                        disabled={busy}
                        style={{ background: "var(--surface-raised)", boxShadow: "0 0 0 3px var(--surface-raised), 0 0 0 5px var(--line), var(--shadow-raised)" }}
                      >
                        <Art base={p.art} alt={p.label} sizes="84px" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="lg-jstatus">
                  <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={i < code.length ? "lg-dot lg-dot--on" : "lg-dot"} />
                    ))}
                  </div>
                  <span className="lg-sr" aria-live="polite">{`${code.length} of 4 pictures chosen`}</span>
                  <button
                    className="mk-btn mk-btn--secondary"
                    type="button"
                    onClick={() => {
                      clearTimers();
                      setCode([]);
                      setFirstPick(null);
                      calm();
                    }}
                    disabled={code.length === 0 || busy}
                    style={{ minHeight: 56 }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9l-5 6M12 9l5 6" />
                    </svg>
                    Clear
                  </button>
                </div>
                <div className="lg-jmsg" id="lg-msg" aria-live="polite">
                  {msg && <Message text={msg} tone="junior" />}
                </div>
                {solo ? (
                  <button type="button" onClick={solo.onBack} className="lg-link lg-linkbtn lg-jlink" style={{ display: "inline-flex", alignItems: "center", minHeight: 56, fontSize: 18, lineHeight: "24px" }}>
                    Not you? Tell me another magic name
                  </button>
                ) : (
                  <Link href="/doors" className="lg-link lg-jlink" style={{ display: "inline-flex", alignItems: "center", minHeight: 56, fontSize: 18, lineHeight: "24px" }}>
                    Not you? Pick another door
                  </Link>
                )}
              </div>
            </>
          )}

          {variant === "teen" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="lg-thead">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kixSprite(theme)} alt="" style={{ width: 48, height: 48, flex: "none", borderRadius: "50%", objectFit: "contain", background: "var(--surface)", boxShadow: "0 0 0 2px rgba(var(--lg-glow), 0.9), 0 0 16px rgba(var(--lg-glow), 0.45)" }} />
                <h1 id="lg-title" className="lg-th1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>
                  {name ? `Hi ${name}` : "Hi there"}
                </h1>
                {solo ? (
                  <button type="button" onClick={solo.onBack} className="lg-link lg-linkbtn" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 15 }}>
                    Not you?
                  </button>
                ) : (
                  <Link href="/doors" className="lg-link" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", minHeight: 44, fontSize: 15 }}>
                    Not you?
                  </Link>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="lg-teen-pw" style={{ ...labelStyle, fontWeight: 700 }}>
                  Password
                </label>
                <div className="lg-trow">
                  <div className="lg-field" style={{ ...fieldBox, flex: "1 1 auto", minWidth: 0 }}>
                    <input
                      id="lg-teen-pw"
                      className="lg-input"
                      type={showPw ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      value={teenPw}
                      onChange={(e) => {
                        setTeenPw(e.target.value);
                        calm();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitTeen();
                        }
                      }}
                      aria-describedby="lg-msg"
                      style={inputStyle}
                    />
                    <EyeButton shown={showPw} onToggle={() => setShowPw(!showPw)} controls="lg-teen-pw" />
                  </div>
                  <button className="mk-btn mk-btn--reward lg-tbtn" type="button" onClick={submitTeen} disabled={pending}>
                    {pending ? "Checking…" : "Open"}
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
              <div id="lg-msg" aria-live="polite">
                {msg && <Message text={msg} tone="teen" />}
              </div>
            </div>
          )}
        </section>
      </main>

      {variant !== "default" && (
        <div className="lg-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-on-dark.svg" className="lg-mark" alt="myKx" />
        </div>
      )}

      {/* The time tunnel: one canvas at screen size (WarpCanvas) */}
      <WarpCanvas active={phase === "tunnel" && live} />

      {/* Arrived: through the tunnel and into your world */}
      <div className="lg-arrived" style={{ background: "radial-gradient(ellipse 60% 55% at 50% 45%, rgba(var(--lg-glow), 0.38), rgba(var(--lg-glow), 0) 70%), var(--surface)" }}>
        <div className="lg-arr-rays" aria-hidden="true" />
        <section
          className="lg-arr-card"
          aria-labelledby="lg-arr-title"
          style={{ ...glassCard, boxShadow: "inset 0 0 0 1px rgba(var(--lg-glow), 0.4), 0 0 48px rgba(var(--lg-glow), 0.28), var(--shadow-raised)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lg-arr-kix" src={kixSprite(theme)} alt="" />
          <h2 id="lg-arr-title" className="lg-arr-h" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--ink)" }}>
            {arriveTitle}
          </h2>
          {variant === "default" && <p style={{ margin: 0, fontSize: 17, lineHeight: "24px", fontWeight: 600, color: "var(--ink-muted)" }}>Taking you to your family…</p>}
          <span className="lg-progress" aria-hidden="true">
            <span className="lg-progress-bar" />
          </span>
        </section>
        <div className="lg-veil" aria-hidden="true" />
      </div>
      <p className="lg-sr" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
