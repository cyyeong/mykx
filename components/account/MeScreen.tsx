"use client";

// "Me" for kids, ported from the KidMe board (canvas row 8): what Kix calls you, and your picture code (old -> new
// -> check) or password. Data: GET and PATCH /api/me (docs/prd/ACCOUNTS.md §3). The page takes on the kid's own
// world and band. Codes and passwords go to the server once to be checked and hashed, then are forgotten here.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { PAD_PICTURES, kixSprite, type PictureId } from "@/components/signin/looks";
import { useSound } from "@/components/sound/SoundProvider";
import { useTheme } from "@/components/theme/ThemeRoot";
import type { PackId } from "@/components/theme/packs";
import { Art } from "@/components/ui/Art";
import type { KidMe } from "@/lib/auth/schemas";
import { api, type ApiResult } from "./api";
import "./me.css";

const NICK_MAX = 20;
const PW_MIN = 8;
const HOME = "/home";
const ME_URL = "/api/me";
const STEP_LABELS = ["Tap your old code", "Pick a new code", "Tap it again to check"] as const;
const KIX_ALT: Record<PackId, string> = {
  terrarium: "Kix the explorer, with a hat and a magnifying glass",
  "anime-sky": "Kix in your Anime Sky look",
  "idol-stage": "Kix in your Idol Stage look",
  dreamlight: "Kix, your sidekick",
  "toon-pop": "Kix, your sidekick",
};

type Load = { phase: "loading" } | { phase: "error" } | { phase: "signin" } | { phase: "ready"; me: KidMe };
type Step = "old" | "new" | "confirm" | "saved";
type CodeFlag = null | "fromOld" | "mismatch" | "wrongOld" | "locked" | "error" | "reset";

const vars = (o: Record<string, string | number>) => o as CSSProperties;
const glass: CSSProperties = {
  borderRadius: "var(--card-radius)",
  background: "var(--surface-glass)",
  WebkitBackdropFilter: "blur(18px)",
  backdropFilter: "blur(18px)",
  boxShadow: "inset 0 0 0 1px var(--line), var(--shadow-raised)",
};
const EYE = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const EYE_OFF = "M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2";
const TICK = "M5 12.5l4.5 4.5L19 7.5";
const LOCK = "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3";

/** Calm, static backdrops per world (no ambient motion on settings screens). */
function Backdrop({ pack }: { pack: PackId }) {
  if (pack === "terrarium")
    return (
      <div className="km2-bg km2-bg-junior" aria-hidden="true">
        <span className="km2-leaf" style={{ left: -70, top: 150, width: 260, height: 130, transform: "rotate(-28deg)", background: "linear-gradient(135deg, #2C7A47, #6DB27A)", opacity: 0.16 }} />
        <span className="km2-leaf" style={{ left: -40, bottom: -40, width: 320, height: 160, transform: "rotate(14deg)", background: "linear-gradient(135deg, #3F8F55, #9CCB7E)", opacity: 0.2 }} />
        <span className="km2-leaf" style={{ right: -80, top: 70, width: 300, height: 150, transform: "rotate(204deg)", background: "linear-gradient(135deg, #2C7A47, #7DBB84)", opacity: 0.14 }} />
        <span className="km2-leaf" style={{ right: -50, bottom: 30, width: 240, height: 120, transform: "rotate(160deg)", background: "linear-gradient(135deg, #1C6C84, #5FA8A0)", opacity: 0.12 }} />
        <span className="km2-dew" style={{ left: "8%", top: "13%", width: 18, height: 18 }} />
        <span className="km2-dew" style={{ left: "44%", top: "6%", width: 10, height: 10 }} />
        <span className="km2-dew" style={{ right: "6%", top: "46%", width: 22, height: 22 }} />
        <span className="km2-dew" style={{ left: "31%", bottom: "7%", width: 14, height: 14 }} />
        <span className="km2-dew" style={{ right: "22%", bottom: "4%", width: 12, height: 12 }} />
      </div>
    );
  if (pack === "anime-sky")
    return (
      <div className="km2-bg km2-bg-teen" aria-hidden="true">
        <span className="km2-ray" style={{ right: "18%" }} />
        <span className="km2-ray" style={{ right: "4%", width: 60, opacity: 0.7 }} />
        <span className="km2-cloud" style={{ left: "5%", top: 64, width: 130, height: 42, opacity: 0.85, boxShadow: "42px -22px 0 10px #fff, 92px -4px 0 4px #fff" }} />
        <span className="km2-cloud" style={{ right: "10%", bottom: 120, width: 170, height: 52, opacity: 0.7, boxShadow: "56px -28px 0 12px #fff, 118px -6px 0 6px #fff" }} />
        <span className="km2-cloud" style={{ left: "38%", bottom: 26, width: 110, height: 34, opacity: 0.6, boxShadow: "36px -16px 0 8px #fff, 76px -2px 0 2px #fff" }} />
        <span className="km2-speed" style={{ left: "3%", top: "44%", width: 96 }} />
        <span className="km2-speed" style={{ left: "5%", top: "calc(44% + 14px)", width: 60 }} />
        <span className="km2-speed" style={{ left: "2%", top: "calc(44% + 28px)", width: 120 }} />
      </div>
    );
  if (pack === "idol-stage")
    return (
      <div className="km2-bg km2-bg-idol" aria-hidden="true">
        <span className="km2-beam" style={{ left: "6%", transform: "rotate(-18deg)" }} />
        <span className="km2-beam km2-beam-cyan" style={{ right: "8%", transform: "rotate(16deg)" }} />
        <span className="km2-neon" style={{ left: "4%", top: "38%", width: 120 }} />
        <span className="km2-neon km2-neon-cyan" style={{ right: "5%", bottom: "18%", width: 160 }} />
      </div>
    );
  if (pack === "toon-pop")
    return (
      <div className="km2-bg km2-bg-toon" aria-hidden="true">
        <span className="km2-blob" style={{ left: -60, top: 120, width: 180, height: 180, background: "#FFD23F", opacity: 0.35 }} />
        <span className="km2-blob" style={{ right: -50, top: 40, width: 140, height: 140, background: "#FF7EB6", opacity: 0.25 }} />
        <span className="km2-blob" style={{ right: "18%", bottom: -60, width: 220, height: 220, background: "#7C5CFF", opacity: 0.14 }} />
        <span className="km2-blob" style={{ left: "30%", bottom: "8%", width: 26, height: 26, background: "#6A47F0", opacity: 0.3 }} />
      </div>
    );
  // Dreamlight: twilight with a few still stars and lantern glows.
  return (
    <div className="km2-bg km2-bg-dream" aria-hidden="true">
      {[
        [7, 9, 3],
        [18, 22, 2],
        [31, 6, 3],
        [52, 12, 2],
        [66, 4, 3],
        [79, 18, 2],
        [91, 8, 3],
        [86, 34, 2],
        [12, 40, 2],
      ].map(([x, y, s], i) => (
        <span key={i} className="km2-star" style={{ left: `${x}%`, top: `${y}%`, width: s, height: s }} />
      ))}
      <span className="km2-lantern" style={{ left: "4%", bottom: "22%" }} />
      <span className="km2-lantern" style={{ right: "6%", top: "30%", width: 12, height: 17 }} />
      <span className="km2-lantern" style={{ right: "24%", bottom: "6%", width: 10, height: 14 }} />
    </div>
  );
}

function Eye({ shown, onToggle, controls, label }: { shown: boolean; onToggle: () => void; controls: string; label: string }) {
  return (
    <button className="km2-eye" type="button" onClick={onToggle} aria-label={shown ? `Hide ${label}` : `Show ${label}`} aria-pressed={shown} aria-controls={controls}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={shown ? EYE_OFF : EYE} />
      </svg>
    </button>
  );
}

export function MeScreen() {
  const router = useRouter();
  const { pack, setPack, setBand } = useTheme();
  const { play } = useSound();
  const [load, setLoad] = useState<Load>({ phase: "loading" });

  // Nickname
  const [draft, setDraft] = useState<string | null>(null);
  const [nickBusy, setNickBusy] = useState(false);
  const [nickMsg, setNickMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Picture code: old -> new -> confirm -> saved. The codes live in refs only until the server answers.
  const [step, setStep] = useState<Step>("old");
  const [entry, setEntry] = useState<PictureId[]>([]);
  const [codeBusy, setCodeBusy] = useState(false);
  const [flag, setFlag] = useState<CodeFlag>(null);
  const [live, setLive] = useState("");
  const [shakeN, setShakeN] = useState(0);
  const oldCode = useRef<PictureId[] | null>(null);
  const newCode = useRef<PictureId[] | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Password
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [conf, setConf] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const apply = useCallback((r: ApiResult<{ kid: KidMe }>) => {
    if (r.ok && r.data?.kid?.id) setLoad({ phase: "ready", me: r.data.kid });
    else if (r.status === 401 || r.status === 403) setLoad({ phase: "signin" });
    else setLoad((prev) => (prev.phase === "ready" ? prev : { phase: "error" }));
  }, []);
  const read = useCallback(async () => apply(await api<{ kid: KidMe }>("GET", ME_URL)), [apply]);

  useEffect(() => {
    let live = true;
    const pending = timer;
    void api<{ kid: KidMe }>("GET", ME_URL).then((r) => live && apply(r));
    return () => {
      live = false;
      window.clearTimeout(pending.current);
    };
  }, [apply]);

  const me = load.phase === "ready" ? load.me : null;

  // Take on the kid's world and band (the layout's ThemeRoot, so sound and the HUD follow too).
  useEffect(() => {
    if (!me) return;
    setBand(me.band);
    setPack(me.pack);
  }, [me, setBand, setPack]);

  if (load.phase === "signin" || load.phase === "error") {
    const signin = load.phase === "signin";
    return (
      <div className="km2-root km2-gate" style={{ minHeight: "100dvh", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={kixSprite(pack)} alt="" className="km2-gate-kix" />
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.15, fontWeight: 800 }}>{signin ? "Let's open your door first" : "Kix can't find your things right now"}</h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: "26px", fontWeight: 700, color: "var(--ink-muted)" }}>
          {signin ? "Ask a grown-up to help you sign in." : "Try again in a moment."}
        </p>
        {signin ? (
          <Link href="/doors" className="mk-btn mk-btn--primary" style={{ textDecoration: "none" }}>
            Go to the doors
          </Link>
        ) : (
          <button
            className="mk-btn mk-btn--primary"
            type="button"
            onClick={() => {
              setLoad({ phase: "loading" });
              void read();
            }}
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!me || pack !== me.pack) {
    return (
      <div className="km2-root km2-gate" aria-busy="true" style={{ minHeight: "100dvh", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={kixSprite(me?.pack ?? pack)} alt="" className="km2-gate-kix km2-bob" />
        <p role="status" style={{ margin: 0, fontSize: 18, lineHeight: "26px", fontWeight: 800, color: "var(--ink-muted)" }}>
          Getting your things…
        </p>
      </div>
    );
  }

  const teen = me.band === "teen";
  const kind = me.secretKind;

  // ---------- Nickname ----------
  const value = draft ?? me.nickname;
  const clean = value.trim().replace(/\s+/g, " ");
  const twoWords = clean.split(" ").filter(Boolean).length >= 2;
  const saveNick = async () => {
    if (nickBusy) return;
    const t = clean.slice(0, NICK_MAX);
    if (!t) return setNickMsg({ ok: false, text: "Type a nickname first." });
    if (t === me.nickname) return;
    setNickBusy(true);
    setNickMsg(null);
    const r = await api("PATCH", ME_URL, { nickname: t });
    if (r.ok) {
      await read();
      setDraft(null);
      setNickMsg({ ok: true, text: teen ? `Saved. Kix will call you ${t}.` : `Saved! Kix will call you ${t}.` });
    } else if (r.status === 401) setLoad({ phase: "signin" });
    else if (r.reason === "taken") setNickMsg({ ok: false, text: "Someone in your family already uses that nickname. Try another." });
    else if (r.reason === "invalid") setNickMsg({ ok: false, text: "Use 1 to 20 characters." });
    else setNickMsg({ ok: false, text: "That didn't save. Try again in a moment." });
    setNickBusy(false);
  };

  // ---------- Picture code ----------
  const clearCodes = () => {
    oldCode.current = null;
    newCode.current = null;
  };
  const submitCode = async (old: PictureId[], next: PictureId[]) => {
    const r = await api("PATCH", ME_URL, { secret: { old: { kind: "pictures", code: old }, new: { kind: "pictures", code: next } } });
    clearCodes();
    setCodeBusy(false);
    setEntry([]);
    if (r.ok) {
      play("correct", me.pack);
      setStep("saved");
      setFlag(null);
      setLive("Saved! Your new code works next time.");
      return;
    }
    if (r.status === 401 && r.reason !== "no-kid") {
      setStep("old");
      setFlag("wrongOld");
      setShakeN((n) => n + 1);
      setLive("That wasn't your old code. Tap your old code again.");
    } else if (r.status === 401) setLoad({ phase: "signin" });
    else if (r.status === 423 || r.status === 429) {
      setStep("old");
      setFlag("locked");
      setLive("Let's take a short break. Try again in a minute.");
    } else if (r.reason === "needs-setup") {
      setStep("old");
      setFlag("reset");
      setLive("A grown-up reset your code. You'll pick a new one at your door.");
    } else {
      setStep("old");
      setFlag("error");
      setLive("That didn't save. Let's start again.");
    }
  };
  const finishCode = (done: PictureId[]) => {
    if (step === "old") {
      oldCode.current = done;
      setStep("new");
      setEntry([]);
      setCodeBusy(false);
      setFlag("fromOld");
      setLive("Got it. Step 2: pick a new code.");
    } else if (step === "new") {
      newCode.current = done;
      setStep("confirm");
      setEntry([]);
      setCodeBusy(false);
      setFlag(null);
      setLive("Step 3: tap the same 4 pictures again.");
    } else if (step === "confirm") {
      const want = newCode.current;
      if (want && oldCode.current && want.every((v, i) => v === done[i])) {
        setLive("Saving…");
        void submitCode(oldCode.current, want);
      } else {
        newCode.current = null;
        setStep("new");
        setEntry([]);
        setCodeBusy(false);
        setFlag("mismatch");
        setShakeN((n) => n + 1);
        setLive("Those didn't match. Pick your new code again.");
      }
    }
  };
  const tap = (id: PictureId) => {
    if (codeBusy || step === "saved" || entry.length >= 4) return;
    play("tap", me.pack);
    const next = [...entry, id];
    setEntry(next);
    if (flag === "wrongOld" || flag === "locked" || flag === "error" || flag === "reset") setFlag(null);
    if (next.length < 4) {
      setLive(`${next.length} of 4`);
      return;
    }
    setLive("4 of 4");
    setCodeBusy(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => finishCode(next), 450);
  };
  const undo = () => {
    if (codeBusy || entry.length === 0) return;
    const next = entry.slice(0, -1);
    setEntry(next);
    setLive(`${next.length} of 4`);
  };
  const restart = () => {
    window.clearTimeout(timer.current);
    clearCodes();
    setStep("old");
    setEntry([]);
    setCodeBusy(false);
    setFlag(null);
    setLive("Starting over. Step 1: tap your old code.");
  };
  const isSaved = step === "saved";
  const idx = isSaved ? 3 : ["old", "new", "confirm"].indexOf(step);
  let note = "Tap the 4 pictures you use now.";
  let noteWarn = false;
  if (step === "old" && flag === "wrongOld") [note, noteWarn] = ["That wasn't your old code. Tap your old code again.", true];
  else if (step === "old" && flag === "locked") [note, noteWarn] = ["Let's take a short break. Try again in a minute.", true];
  else if (step === "old" && flag === "reset") [note, noteWarn] = ["A grown-up reset your code. You'll pick a new one at your door.", true];
  else if (step === "old" && flag === "error") [note, noteWarn] = ["That didn't save. Let's start again: tap your old code.", true];
  else if (step === "new") [note, noteWarn] = flag === "mismatch" ? ["Those didn't match. Pick your new code again.", true] : ["Got it! Now pick 4 new pictures to remember.", false];
  else if (step === "confirm") note = codeBusy && entry.length === 4 ? "Saving…" : "Tap the same 4 again, in order.";
  else if (isSaved) note = "All done! You can change it any time.";
  const shakeCls = flag === "mismatch" || flag === "wrongOld" ? (shakeN % 2 ? "km2-shake" : "km2-shake2") : "";

  // ---------- Password ----------
  const sameAsOld = nw.length > 0 && nw === cur;
  const strength = nw.length === 0 ? 0 : nw.length < PW_MIN ? 1 : nw.length < 12 ? 2 : 3;
  let strengthText = "At least 8 characters.";
  let strengthClass = "";
  if (sameAsOld) [strengthText, strengthClass] = ["Pick something different from your current password.", "km2-warn"];
  else if (strength === 1) [strengthText, strengthClass] = [`Too short. At least 8 characters (${nw.length} so far).`, "km2-warn"];
  else if (strength === 2) [strengthText, strengthClass] = ["Good. Longer is even stronger.", "km2-ok"];
  else if (strength === 3) [strengthText, strengthClass] = ["Strong.", "km2-ok"];
  const segColor = strength === 1 ? "km2-seg-warn" : strength === 2 ? "km2-seg-ok" : "km2-seg-strong";
  const matches = conf.length > 0 && conf === nw;
  const canSave = cur.length > 0 && nw.length >= PW_MIN && !sameAsOld && matches && !passBusy;
  const savePass = async () => {
    if (!canSave) return;
    setPassBusy(true);
    setPassMsg(null);
    const r = await api("PATCH", ME_URL, { secret: { old: { kind: "password", password: cur }, new: { kind: "password", password: nw } } });
    setPassBusy(false);
    if (r.ok) {
      // The fields clear and hide, so the password is never on screen again.
      setCur("");
      setNw("");
      setConf("");
      setShowCur(false);
      setShowNew(false);
      setShowConf(false);
      setPassMsg({ ok: true, text: "Password changed. Use it next time you sign in." });
    } else if (r.status === 401 && r.reason !== "no-kid") {
      setCur("");
      setPassMsg({ ok: false, text: "Your current password isn't right. Try again." });
    } else if (r.status === 401) setLoad({ phase: "signin" });
    else if (r.status === 423 || r.status === 429) setPassMsg({ ok: false, text: "Too many tries. Wait a minute, then try again." });
    else if (r.reason === "invalid") setPassMsg({ ok: false, text: "Use 8 to 64 characters." });
    else setPassMsg({ ok: false, text: "That didn't save. Try again in a moment." });
  };
  const onPassKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void savePass();
    }
  };
  const typing = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setPassMsg(null);
  };

  // Ends only this kid's session, then back to the doors (the grown-up stays signed in on this device).
  const signOut = async () => {
    setLeaving(true);
    await api("DELETE", "/api/auth/kid");
    router.replace("/doors");
  };

  const lede = kind === "password" ? "Nickname and password." : "Your nickname and your secret picture code.";

  return (
    <div className="km2-root" data-theme={me.pack} data-band={me.band} style={{ position: "relative", width: "100%", minHeight: "100dvh", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
      <Backdrop pack={me.pack} />
      <div className="km2-wrap">
        <header className="km2-head">
          <Link className="km2-back" href={HOME} aria-label="Back to Home">
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 24, height: 24 }}>
              <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="km2-titles">
            <h1 className="km2-h1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800 }}>
              Me
            </h1>
            <p className="km2-lede" style={{ margin: 0, fontWeight: 700, color: "var(--ink-muted)" }}>
              {lede}
            </p>
          </div>
          <div className="km2-headend">
            <span className="km2-who" style={{ background: "var(--surface-glass)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kixSprite(me.pack)} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: "50%", background: "var(--surface-raised)", boxShadow: "0 0 0 2px var(--accent)" }} />
              <span>
                {me.nickname} · {me.level}
              </span>
            </span>
            <Link href="/me/papers" className="mk-btn mk-btn--secondary km2-signout" aria-label="Print a practice paper" style={{ textDecoration: "none" }}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />
              </svg>
              <span className="km2-signout-label">Practice paper</span>
            </Link>
            <button className="mk-btn mk-btn--secondary km2-signout" type="button" onClick={() => void signOut()} disabled={leaving} aria-label="Sign out">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
              </svg>
              <span className="km2-signout-label">Sign out</span>
            </button>
          </div>
        </header>

        <div className="km2-grid">
          {/* Nickname */}
          <section className="km2-card" aria-labelledby="km2-nick-h" style={glass}>
            <h2 id="km2-nick-h" className="km2-h2">
              What Kix calls you
            </h2>
            <div className="km2-kixrow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="km2-kix" src={kixSprite(me.pack)} alt={KIX_ALT[me.pack]} />
              <div className={twoWords ? "km2-bubble km2-bubble-warn" : "km2-bubble"}>
                <span className="km2-tail" aria-hidden="true" />
                <p className="km2-hi">{teen ? `Hey, ${me.nickname}.` : `Hi, ${me.nickname}!`}</p>
                <p id="km2-tip" className="km2-tip">
                  Use a nickname, not your full name.
                </p>
                {twoWords && (
                  <p className="km2-tip km2-tip-warn">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                    </svg>
                    <span>Two words can look like a real name. Keep it a nickname.</span>
                  </p>
                )}
              </div>
            </div>
            <div className="km2-field">
              <div className="km2-labelrow">
                <label className="km2-label" htmlFor="km2-nick">
                  Nickname
                </label>
                <span id="km2-count" className={value.length >= 18 ? "km2-count km2-count-near" : "km2-count"}>
                  {value.length} / {NICK_MAX}
                  <span className="km2-sr"> characters</span>
                </span>
              </div>
              <div className="km2-nbox">
                <input
                  id="km2-nick"
                  className="km2-ninput"
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setDraft(e.target.value.slice(0, NICK_MAX));
                    setNickMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void saveNick();
                    }
                  }}
                  maxLength={NICK_MAX}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="km2-count km2-tip"
                />
              </div>
            </div>
            <div className="km2-actions">
              <button className="mk-btn mk-btn--primary" type="button" onClick={() => void saveNick()} disabled={clean === me.nickname || nickBusy}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d={TICK} />
                </svg>
                {nickBusy ? "Saving…" : "Save nickname"}
              </button>
              <p className={`km2-status ${nickMsg ? (nickMsg.ok ? "km2-ok" : "km2-warn") : ""}`} aria-live="polite">
                {nickMsg?.ok && (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12.5l3 3 5-6" />
                  </svg>
                )}
                <span>{nickMsg?.text ?? ""}</span>
              </p>
            </div>
          </section>

          {/* Picture code */}
          {kind === "pictures" && (
            <section className="km2-card" aria-labelledby="km2-code-h" style={glass}>
              <div className="km2-cardhead">
                <h2 id="km2-code-h" className="km2-h2">
                  My picture code
                </h2>
                <p className="km2-sub">4 pictures in a row. Only you know it.</p>
              </div>
              <div className="km2-codebody">
                <ol className="km2-steps" aria-label="Change your code in 3 steps">
                  {STEP_LABELS.map((label, k) => (
                    <li key={label} className={`km2-step ${k === idx ? "km2-step-now" : k < idx ? "km2-step-done" : "km2-step-next"}`} aria-current={k === idx ? "step" : undefined}>
                      <span className="km2-stepnum" aria-hidden="true">
                        {k < idx ? (
                          <svg viewBox="0 0 24 24">
                            <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d={TICK} />
                          </svg>
                        ) : (
                          k + 1
                        )}
                      </span>
                      <span className="km2-steplabel">{label}</span>
                      <span className="km2-sr">{k < idx ? ", done" : k === idx ? ", now" : ""}</span>
                    </li>
                  ))}
                </ol>
                <div className="km2-now">
                  {!isSaved && (
                    <div key={shakeN} className={`km2-dots ${shakeCls}`} role="img" aria-label={`${entry.length} of 4 pictures tapped`}>
                      {[0, 1, 2, 3].map((k) => (
                        <span key={k} className={k < entry.length ? "km2-dot km2-dot-on" : "km2-dot"} />
                      ))}
                    </div>
                  )}
                  <p className={noteWarn ? "km2-note km2-warn" : "km2-note"}>{note}</p>
                  <p className="km2-sr" aria-live="polite">
                    {live}
                  </p>
                </div>
                <div className="km2-padwrap">
                  {!isSaved ? (
                    <div className="km2-pad" role="group" aria-label="Picture pad">
                      {PAD_PICTURES.map((p) => (
                        <button key={p.id} className="km2-pic" type="button" onClick={() => tap(p.id)} aria-label={p.label} disabled={codeBusy}>
                          <Art base={p.art} alt="" sizes="(max-width: 599px) 30vw, 104px" draggable={false} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="km2-saved">
                      <span className="km2-badge" aria-hidden="true">
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
                          <span key={a} className="km2-burst" style={vars({ "--a": `${a}deg`, ...(i % 2 ? { background: "var(--accent-2)" } : {}) })} />
                        ))}
                        <svg viewBox="0 0 24 24">
                          <path fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" d={TICK} />
                        </svg>
                      </span>
                      <p className="km2-saved-h">Saved!</p>
                      <p className="km2-saved-p">Your new code works next time.</p>
                      <Link href={HOME} className="mk-btn mk-btn--primary" style={{ marginTop: 6, textDecoration: "none" }}>
                        Back to Home
                      </Link>
                    </div>
                  )}
                </div>
                <div className="km2-acts">
                  {!isSaved ? (
                    <>
                      <button className="mk-btn mk-btn--secondary" type="button" onClick={undo} disabled={entry.length === 0 || codeBusy}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                        </svg>
                        Undo
                      </button>
                      <button className="mk-btn mk-btn--secondary" type="button" onClick={restart} disabled={codeBusy && entry.length === 4 && step === "confirm"}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" />
                        </svg>
                        Start over
                      </button>
                    </>
                  ) : (
                    <button className="mk-btn mk-btn--secondary" type="button" onClick={restart}>
                      Change it again
                    </button>
                  )}
                </div>
                <p className="km2-forgot">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d={LOCK} />
                  </svg>
                  <span>Forgot your code? Ask a grown-up to reset it.</span>
                </p>
              </div>
            </section>
          )}

          {/* Password */}
          {kind === "password" && (
            <section className="km2-card" aria-labelledby="km2-pass-h" style={glass}>
              <div className="km2-cardhead">
                <h2 id="km2-pass-h" className="km2-h2">
                  Password
                </h2>
                <p className="km2-sub">Stored scrambled. Nobody can read it, not even grown-ups.</p>
              </div>
              <div className="km2-pfields">
                <div className="km2-pfield">
                  <label className="km2-label" htmlFor="km2-cur">
                    Current password
                  </label>
                  <div className="km2-pbox">
                    <input id="km2-cur" className="km2-pinput" type={showCur ? "text" : "password"} value={cur} onChange={typing(setCur)} onKeyDown={onPassKey} autoComplete="current-password" spellCheck={false} />
                    <Eye shown={showCur} onToggle={() => setShowCur(!showCur)} controls="km2-cur" label="current password" />
                  </div>
                </div>
                <div className="km2-pfield">
                  <label className="km2-label" htmlFor="km2-new">
                    New password
                  </label>
                  <div className="km2-pbox">
                    <input id="km2-new" className="km2-pinput" type={showNew ? "text" : "password"} value={nw} onChange={typing(setNw)} onKeyDown={onPassKey} autoComplete="new-password" spellCheck={false} aria-describedby="km2-strength" />
                    <Eye shown={showNew} onToggle={() => setShowNew(!showNew)} controls="km2-new" label="new password" />
                  </div>
                  <div className="km2-meter" aria-hidden="true">
                    {[1, 2, 3].map((k) => (
                      <span key={k} className={`km2-seg ${!sameAsOld && strength >= k ? segColor : ""}`} />
                    ))}
                  </div>
                  <p id="km2-strength" className={`km2-hint ${strengthClass}`}>
                    {!sameAsOld && strength >= 2 && (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d={TICK} />
                      </svg>
                    )}
                    <span>{strengthText}</span>
                  </p>
                </div>
                <div className="km2-pfield">
                  <label className="km2-label" htmlFor="km2-conf">
                    Confirm new password
                  </label>
                  <div className="km2-pbox">
                    <input id="km2-conf" className="km2-pinput" type={showConf ? "text" : "password"} value={conf} onChange={typing(setConf)} onKeyDown={onPassKey} autoComplete="new-password" spellCheck={false} aria-describedby="km2-match" />
                    <Eye shown={showConf} onToggle={() => setShowConf(!showConf)} controls="km2-conf" label="confirmed password" />
                  </div>
                  <p id="km2-match" className={`km2-hint ${matches ? "km2-ok" : ""}`}>
                    {matches && (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d={TICK} />
                      </svg>
                    )}
                    <span>{conf.length === 0 ? "" : matches ? "Matches." : "Doesn't match yet."}</span>
                  </p>
                </div>
              </div>
              <div className="km2-actions">
                <button className="mk-btn mk-btn--primary" type="button" onClick={() => void savePass()} disabled={!canSave}>
                  {passBusy ? "Saving…" : "Save password"}
                </button>
                <p className={`km2-status ${passMsg ? (passMsg.ok ? "km2-ok" : "km2-warn") : ""}`} aria-live="polite">
                  {passMsg?.ok && (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12.5l3 3 5-6" />
                    </svg>
                  )}
                  <span>{passMsg?.text ?? ""}</span>
                </p>
              </div>
              <p className="km2-forgot">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d={LOCK} />
                </svg>
                <span>Forgot your password? Ask a grown-up to reset it.</span>
              </p>
            </section>
          )}

          {/* No code yet: a grown-up reset it, so the kid picks a new one at their door */}
          {kind === null && (
            <section className="km2-card" aria-labelledby="km2-none-h" style={glass}>
              <div className="km2-cardhead">
                <h2 id="km2-none-h" className="km2-h2">
                  My sign-in
                </h2>
                <p className="km2-sub">A grown-up reset your code. You&apos;ll pick a new one the next time you open your door.</p>
              </div>
            </section>
          )}
        </div>

        {me.synthetic && (
          <p className="km2-demo">
            <span className="km2-demo-tag">DEMO</span>
            Demo account with synthetic data.
          </p>
        )}
      </div>
    </div>
  );
}
