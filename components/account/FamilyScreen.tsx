"use client";

// "Your family" for grown-ups, ported from the FamilyAccounts board (canvas row 8): a card per kid with their world
// behind an open door, reset and remove that expand in place, limits, voice and the focus camera, "Focus this week"
// notes, "Add a kid" (level sets the look), and sign out everywhere. Data: /api/family/kids (docs/prd/ACCOUNTS.md §3)
// and /api/signals/focus (PARENT_INSIGHTS.md §1). No optimistic writes: each change waits for the server, then the
// list is read again. Codes and passwords are never shown or kept here.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { kixSprite } from "@/components/signin/looks";
import { PACKS, type PackId } from "@/components/theme/packs";
import type { FailReason, FamilyKid, FamilyResult, Level, SecretKind } from "@/lib/auth/schemas";
import type { FocusNote, FocusNotesResult } from "@/lib/signals/schemas";
import { api, type ApiResult } from "./api";
import { dayLabel, upperFirst, whenLabel } from "./format";
import { Switch } from "./Switch";
import { DOOR_GLOW, WORLD_SCENE, WORLD_SWATCH } from "./worlds";
import "./family.css";

const LEVELS: readonly Level[] = ["P3", "P6", "Sec 2"];
const NICK_MAX = 20;
const PW_MIN = 8;
/** Daily time choices in minutes; null is no limit. */
const LIMITS: readonly (number | null)[] = [15, 30, 45, 60, 90, null];
/** Day 5: the parent dashboard. Until it exists, back goes to "Who's learning?". */
const BACK = { href: "/doors", label: "Back to the doors" };
const TRY_AGAIN = "That didn't work. Try again in a moment.";
const KIDS_URL = "/api/family/kids";
const FOCUS_URL = "/api/signals/focus";
const CONFIDENCE_LEVEL = { low: 1, medium: 2, high: 3 } as const;

const ICON = {
  pictures: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  password: "M4 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0M10.8 12.2 20 3M16.5 6.5l3 3M14 9l2 2",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2",
  check: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M8 12l3 3 5-6",
  warn: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  clock: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  bin: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6",
  camera: "M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM15 10.5l5-3v9l-5-3",
};
const LOOK = {
  junior: { name: "Junior look", note: "Bigger buttons and words. Kix guides every step." },
  teen: { name: "Teen look", note: "A sleeker study deck. Kix speaks only when asked." },
};

type Load = { phase: "loading" } | { phase: "error" } | { phase: "signin" } | { phase: "ready"; data: FamilyResult };
type CardNote = { text: string; door?: boolean };
type Added = { nickname: string; level: Level; pack: PackId; kind: SecretKind; voice: boolean; voiceSaved: boolean };

const worldName = (id: PackId) => PACKS.find((p) => p.id === id)?.name ?? "Dreamlight";
const bandOf = (level: Level) => (level === "P3" ? "junior" : "teen");
const defaultKind = (level: Level): SecretKind => (bandOf(level) === "junior" ? "pictures" : "password");
/** A kid's sign-in kind; an unset one follows their band (juniors get pictures). */
const kindOf = (k: FamilyKid): SecretKind => k.secretKind ?? (k.band === "junior" ? "pictures" : "password");
const limitLabel = (m: number | null) => (m === null ? "No limit" : `${m} min`);

/** Lost the grown-up's session (or never had one): show the sign-in prompt, not a form error. */
function signedOut(r: ApiResult<unknown>): boolean {
  return r.status === 401 || (r.status === 403 && !(["not-found", "not-allowed"] as (FailReason | null)[]).includes(r.reason));
}

const swatch = (id: PackId, size: number): CSSProperties => ({
  display: "grid",
  placeItems: "center",
  flex: "none",
  width: size,
  height: size,
  borderRadius: "50%",
  background: WORLD_SWATCH[id],
  boxShadow: "inset 0 0 0 1.5px rgba(255, 255, 255, 0.55), 0 0 0 1px var(--line)",
});
const hint = (warn: boolean): CSSProperties => ({ fontSize: 14, lineHeight: "20px", ...(warn ? { color: "var(--warn)", fontWeight: 600 } : { color: "var(--ink-muted)" }) });
const card: CSSProperties = { display: "flex", flexDirection: "column", padding: 18, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "var(--shadow-raised)" };
const label16: CSSProperties = { fontSize: 16, lineHeight: "22px", fontWeight: 700 };
const muted16: CSSProperties = { fontSize: 16, lineHeight: "22px", color: "var(--ink-muted)" };
const inputStyle: CSSProperties = { flex: 1, minWidth: 0, height: 44, padding: 0, border: 0, background: "transparent", color: "var(--ink)", font: "400 16px/1 var(--font-text)" };
const iconBtn: CSSProperties = { display: "grid", placeItems: "center", width: 44, height: 44, flex: "none", padding: 0, border: 0, borderRadius: "50%", background: "transparent", color: "var(--ink-muted)" };
const innerPanel: CSSProperties = { display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: "var(--radius-sm)", background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" };
const warnBtn: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", border: 0, borderRadius: "var(--radius-pill)", background: "var(--warn)", color: "var(--on-warn)", font: "600 16px/1 var(--font-text)" };

function Icon({ d, size = 18, style }: { d: string; size?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, flex: "none", ...style }}>
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/** A calm line under a form or on a card: green tick for done, warm triangle for a problem. */
function Note({ tone, children, className = "fa-in" }: { tone: "ok" | "warn"; children: ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "var(--surface)", boxShadow: `inset 0 0 0 1.5px var(${tone === "ok" ? "--success" : "--warn"})`, fontSize: 14, lineHeight: "20px" }}
    >
      <Icon d={tone === "ok" ? ICON.check : ICON.warn} style={{ marginTop: 1, color: tone === "ok" ? "var(--success)" : "var(--warn)" }} />
      <span>{children}</span>
    </span>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onEnter,
  shown,
  onToggleShown,
  invalid,
  hintId,
  hintText,
  hintWarn,
  surface,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  shown: boolean;
  onToggleShown: () => void;
  invalid?: boolean;
  hintId: string;
  hintText: string;
  hintWarn: boolean;
  surface: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={label16}>
        {label}
      </label>
      <div className="fa-field" data-invalid={invalid ? "true" : "false"} style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 48, padding: "0 2px 0 14px", borderRadius: "var(--radius-sm)", background: surface }}>
        <input
          className="fa-input"
          id={id}
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-invalid={invalid ? "true" : "false"}
          aria-describedby={hintId}
          style={inputStyle}
        />
        <button className="fa-click" type="button" onClick={onToggleShown} aria-pressed={shown} aria-controls={id} aria-label={shown ? "Hide password" : "Show password"} style={iconBtn}>
          <Icon d={shown ? ICON.eyeOff : ICON.eye} size={20} />
        </button>
      </div>
      <span id={hintId} style={hint(hintWarn)}>
        {hintText}
      </span>
    </div>
  );
}

/** The arched door with the kid's world behind it and their Kix stepping out. */
function DoorStage({ pack, className, style, children }: { pack: PackId; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span className={className} aria-hidden="true" style={{ position: "relative", display: "block", overflow: "hidden", background: WORLD_SCENE[pack], ...style }}>
      {children}
    </span>
  );
}

/** "Medium confidence" with a three-step meter (the words carry it; the bars only echo them). */
function ConfidenceTag({ level }: { level: FocusNote["confidence"] }) {
  const n = CONFIDENCE_LEVEL[level];
  return (
    <span className="fa-conf">
      <span aria-hidden="true" className="fa-conf-bars">
        {[1, 2, 3].map((i) => (
          <span key={i} data-on={i <= n ? "true" : "false"} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      {upperFirst(level)} confidence
    </span>
  );
}

/** "Focus this week": the focus camera's "possibly losing focus" notes for one kid, with the evidence behind each. */
function FocusCard({ kid, notes, onRemove, busyId }: { kid: FamilyKid; notes: FocusNote[] | null; onRemove: (n: FocusNote) => void; busyId: string | null }) {
  const mine = notes?.filter((n) => n.kidId === kid.id).slice(0, 3) ?? null;
  return (
    <section className="fa-focus" aria-labelledby={`fa-focus-h-${kid.id}`} style={{ ...innerPanel, gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px 8px" }}>
        <h4 id={`fa-focus-h-${kid.id}`} style={{ margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 700, whiteSpace: "nowrap" }}>
          Focus this week
        </h4>
        <span className="fa-cam-state" data-on={kid.cameraEnabled ? "true" : "false"}>
          <Icon d={ICON.camera} size={15} />
          {kid.cameraEnabled ? "Camera on" : "Camera off"}
        </span>
      </div>
      {mine === null ? (
        <span style={hint(false)}>Loading…</span>
      ) : mine.length === 0 ? (
        <span style={hint(false)}>No notes yet.</span>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {mine.map((n) => (
            <li key={n.id} className="fa-note">
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 8px" }}>
                <strong style={{ fontSize: 15, lineHeight: "20px", fontWeight: 700 }}>Possibly losing focus</strong>
                {n.synthetic && <span className="fa-sample">Sample</span>}
              </div>
              <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 10px", fontSize: 13, lineHeight: "18px", fontWeight: 600, color: "var(--ink-muted)" }}>
                <span>{upperFirst(whenLabel(n.from) ?? "")}</span>
                <ConfidenceTag level={n.confidence} />
              </span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: "20px" }}>{n.evidence}</p>
              <button className="fa-click fa-note-rm" type="button" onClick={() => onRemove(n)} disabled={busyId !== null} aria-label={`Remove this note about ${kid.nickname}`}>
                {busyId === n.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <span style={{ ...hint(false), fontSize: 13, lineHeight: "18px" }}>Against {kid.nickname}&apos;s own usual. A possibility, never a diagnosis.</span>
    </section>
  );
}

function KidSkeleton() {
  return (
    <div className="fa-kid fa-skel" aria-hidden="true" style={{ position: "relative", minWidth: 0, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "var(--shadow-raised)", overflow: "hidden" }}>
      <span className="fa-stage fa-skel-block" style={{ display: "block" }} />
      <span className="fa-info" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="fa-skel-line" style={{ width: "46%", height: 22 }} />
        <span className="fa-skel-line" style={{ width: "70%" }} />
        <span className="fa-skel-line" style={{ width: "58%" }} />
      </span>
      <span className="fa-acts" style={{ display: "flex" }}>
        <span className="fa-skel-line" style={{ width: "100%", height: 44, borderRadius: 999 }} />
      </span>
    </div>
  );
}

export function FamilyScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [busy, setBusy] = useState<string | null>(null);

  // One panel open at a time: `${kidId}:reset` | `${kidId}:remove` | `${kidId}:limits`.
  const [panel, setPanel] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState("");
  const [tempShown, setTempShown] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [panelError, setPanelError] = useState("");
  const [cardNotes, setCardNotes] = useState<Record<string, CardNote>>({});
  const [focusNotes, setFocusNotes] = useState<FocusNote[] | null>(null);
  const [noteBusy, setNoteBusy] = useState<string | null>(null);
  const [removedNotes, setRemovedNotes] = useState<string[]>([]);

  // Add a kid: closed -> form -> done.
  const [add, setAdd] = useState<"closed" | "form" | "done">("closed");
  const [nick, setNick] = useState("");
  const [level, setLevel] = useState<Level>("P3");
  const [world, setWorld] = useState<PackId>("dreamlight");
  const [pickedKind, setPickedKind] = useState<SecretKind | null>(null);
  const [pw, setPw] = useState("");
  const [pwShown, setPwShown] = useState(false);
  const [voice, setVoice] = useState(true);
  const [tried, setTried] = useState(false);
  const [addError, setAddError] = useState<{ field: "nick" | "form"; text: string } | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const nickRef = useRef<HTMLInputElement>(null);
  const opened = useRef(false);

  // Your account.
  const [signoutOpen, setSignoutOpen] = useState(false);
  const [signoutError, setSignoutError] = useState("");
  const [pwResetOpen, setPwResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const apply = useCallback((r: ApiResult<FamilyResult>): FamilyResult | null => {
    if (r.ok && r.data?.kids) {
      setLoad({ phase: "ready", data: r.data });
      return r.data;
    }
    if (signedOut(r)) setLoad({ phase: "signin" });
    else setLoad((prev) => (prev.phase === "ready" ? prev : { phase: "error" }));
    return null;
  }, []);
  const refresh = useCallback(async () => apply(await api<FamilyResult>("GET", KIDS_URL)), [apply]);

  const loadFocus = useCallback(async () => {
    const r = await api<FocusNotesResult>("GET", FOCUS_URL);
    // A failed read shows "No notes yet." rather than an error: the notes are extra, the family page isn't.
    setFocusNotes(r.ok && r.data?.notes ? r.data.notes : []);
  }, []);

  useEffect(() => {
    let live = true;
    void api<FamilyResult>("GET", KIDS_URL).then((r) => live && apply(r));
    void api<FocusNotesResult>("GET", FOCUS_URL).then((r) => live && setFocusNotes(r.ok && r.data?.notes ? r.data.notes : []));
    return () => {
      live = false;
    };
  }, [apply]);

  // Opening the form moves focus to the nickname (not on first paint).
  useEffect(() => {
    if (add === "form" && opened.current) nickRef.current?.focus();
  }, [add]);

  const openPanel = (key: string | null) => {
    setPanel(key);
    setTempPw("");
    setTempShown(false);
    setConfirmText("");
    setPanelError("");
  };
  const togglePanel = (key: string) => openPanel(panel === key ? null : key);

  /** Shared failure path for card actions. */
  const failed = (r: ApiResult<unknown>, text = TRY_AGAIN) => {
    if (signedOut(r)) setLoad({ phase: "signin" });
    else setPanelError(text);
  };

  const resetPictures = async (k: FamilyKid) => {
    setBusy(`${k.id}:reset`);
    setPanelError("");
    const r = await api("PATCH", `/api/family/kids/${k.id}`, { secret: { kind: "pictures" } });
    if (r.ok) {
      await refresh();
      openPanel(null);
      setCardNotes((n) => ({ ...n, [k.id]: { text: `Old code cleared. ${k.nickname} picks 4 new pictures the next time ${k.nickname} opens their door.`, door: true } }));
    } else failed(r);
    setBusy(null);
  };

  const saveTemp = async (k: FamilyKid) => {
    if (tempPw.length < PW_MIN || busy) return;
    setBusy(`${k.id}:reset`);
    setPanelError("");
    const r = await api("PATCH", `/api/family/kids/${k.id}`, { secret: { kind: "password", password: tempPw } });
    if (r.ok) {
      await refresh();
      openPanel(null);
      setCardNotes((n) => ({ ...n, [k.id]: { text: `Temporary password saved. Tell ${k.nickname} in person. ${k.nickname} can change it in Me.` } }));
    } else failed(r, r.reason === "invalid" ? "Use 8 to 64 characters." : TRY_AGAIN);
    setBusy(null);
  };

  const removeKid = async (k: FamilyKid) => {
    if (confirmText.trim() !== k.nickname || busy) return;
    setBusy(`${k.id}:remove`);
    setPanelError("");
    const r = await api("DELETE", `/api/family/kids/${k.id}`, { confirm: confirmText.trim() });
    if (r.ok) {
      await refresh();
      openPanel(null);
      setCardNotes((notes) => {
        const next = { ...notes };
        delete next[k.id];
        return next;
      });
      setRemovedNotes((n) => [...n, `${k.nickname} and all of ${k.nickname}'s learning data were removed.`]);
    } else failed(r, r.reason === "confirm" ? `Type ${k.nickname} exactly to confirm.` : TRY_AGAIN);
    setBusy(null);
  };

  const removeFocusNote = async (n: FocusNote) => {
    if (noteBusy) return;
    setNoteBusy(n.id);
    const r = await api("DELETE", FOCUS_URL, { id: n.id });
    if (r.ok || r.status === 404) await loadFocus();
    else if (signedOut(r)) setLoad({ phase: "signin" });
    setNoteBusy(null);
  };

  const setLimits = async (k: FamilyKid, patch: { voiceEnabled?: boolean; cameraEnabled?: boolean; dailyLimitMin?: number | null }) => {
    if (busy) return;
    setBusy(`${k.id}:limits`);
    setPanelError("");
    const r = await api("PATCH", `/api/family/kids/${k.id}`, patch);
    if (r.ok) await refresh();
    else failed(r, "That didn't save. Try again in a moment.");
    setBusy(null);
  };

  // ---- Add a kid ----
  const kind = pickedKind ?? defaultKind(level);
  const nickT = nick.trim();
  const nickMissing = nickT.length === 0;
  const looksFull = /\s/.test(nickT);
  const pwShort = kind === "password" && pw.length < PW_MIN;
  const nickErr = tried && nickMissing;
  const pwErr = tried && pwShort;
  const fresh = () => {
    setNick("");
    setLevel("P3");
    setWorld("dreamlight");
    setPickedKind(null);
    setPw("");
    setPwShown(false);
    setVoice(true);
    setTried(false);
    setAddError(null);
  };
  const openAdd = () => {
    opened.current = true;
    setTried(false);
    setAddError(null);
    setAdd("form");
  };

  const submitAdd = async () => {
    if (busy) return;
    if (nickMissing || pwShort) {
      setTried(true);
      return;
    }
    setBusy("add");
    setAddError(null);
    const r = await api<{ kid?: { id?: string } }>("POST", "/api/family/kids", {
      nickname: nickT,
      level,
      pack: world,
      secret: kind === "password" ? { kind: "password", password: pw } : { kind: "pictures" },
    });
    if (!r.ok) {
      setBusy(null);
      if (signedOut(r)) return setLoad({ phase: "signin" });
      if (r.reason === "taken") return setAddError({ field: "nick", text: "That nickname is already used in your family. Try another." });
      if (r.reason === "too-many") return setAddError({ field: "form", text: "Your family is full. Remove a kid to add another." });
      if (r.reason === "invalid") return setAddError({ field: "form", text: "Something in the form isn't right. Check the nickname and password." });
      return setAddError({ field: "form", text: "Adding didn't work. Try again in a moment." });
    }
    // Voice isn't part of the add call: switch it off straight after, when the grown-up chose that.
    const data = await refresh();
    let voiceSaved = true;
    if (!voice) {
      const id = r.data?.kid?.id ?? data?.kids.find((k) => k.nickname === nickT)?.id;
      const v = id ? await api("PATCH", `/api/family/kids/${id}`, { voiceEnabled: false }) : null;
      voiceSaved = Boolean(v?.ok);
      if (voiceSaved) await refresh();
    }
    setAdded({ nickname: nickT, level, pack: world, kind, voice, voiceSaved });
    setPw("");
    setPwShown(false);
    setTried(false);
    setAdd("done");
    setBusy(null);
  };

  // ---- Your account ----
  const signOutEverywhere = async () => {
    setBusy("signout");
    setSignoutError("");
    const r = await api("POST", "/api/auth/signout", { everywhere: true });
    if (r.ok) {
      router.replace("/signin");
      return;
    }
    setBusy(null);
    setSignoutError("Signing out didn't work. Try again in a moment.");
  };
  const sendReset = async () => {
    if (!resetEmail.trim() || busy) return setResetMsg({ tone: "warn", text: "Type your email first." });
    setBusy("pwreset");
    const r = await api("POST", "/api/auth/reset", { email: resetEmail.trim() });
    setBusy(null);
    setResetMsg(r.ok ? { tone: "ok", text: "If that email has a myKx account, a link to set a new password is on its way." } : { tone: "warn", text: "Sending didn't work. Try again in a moment." });
  };

  const data = load.phase === "ready" ? load.data : null;
  const kids = data?.kids ?? [];
  const n = kids.length;
  const synthetic = kids.some((k) => k.synthetic);
  const familyLine = data ? `${data.household.name} · ${n === 0 ? "no kids yet" : `${n} ${n === 1 ? "kid" : "kids"}`}` : " ";

  if (load.phase === "signin") {
    return (
      <div className="fa-root" data-theme="anime-sky" data-band="teen" style={{ width: "100%", minHeight: "100dvh", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
        <div className="fa-amb" aria-hidden="true" style={{ background: "radial-gradient(50% 40% at 0% 0%, rgba(90, 169, 240, 0.18), rgba(90, 169, 240, 0) 70%), radial-gradient(40% 40% at 100% 100%, rgba(247, 182, 207, 0.26), rgba(247, 182, 207, 0) 70%)" }} />
        <main className="fa-gate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-on-light.svg" alt="myKx" style={{ height: 24, width: "auto", alignSelf: "flex-start" }} />
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1.2, fontWeight: 800 }}>Sign in to manage your family</h1>
          <p style={{ margin: 0, ...muted16 }}>This page is for grown-ups. Sign in with your email and password first.</p>
          <Link href="/signin" className="mk-btn mk-btn--primary" style={{ alignSelf: "flex-start", textDecoration: "none" }}>
            Go to sign in
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="fa-root" data-theme="anime-sky" data-band="teen" style={{ width: "100%", minHeight: "100dvh", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
      <div className="fa-amb" aria-hidden="true" style={{ background: "radial-gradient(50% 40% at 0% 0%, rgba(90, 169, 240, 0.18), rgba(90, 169, 240, 0) 70%), radial-gradient(40% 40% at 100% 100%, rgba(247, 182, 207, 0.26), rgba(247, 182, 207, 0) 70%)" }} />
      <div className="fa-wrap">
        <div className="fa-top" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "4px 12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-on-light.svg" alt="myKx" style={{ height: 20, width: "auto" }} />
          <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>Parent account</span>
        </div>
        <div className="fa-title" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <Link href={BACK.href} style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, marginLeft: -8, padding: "0 12px 0 4px", borderRadius: "var(--radius-pill)", color: "var(--accent)", fontSize: 16, lineHeight: "22px", fontWeight: 600, textDecoration: "none" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22, flex: "none" }}>
              <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
            {BACK.label}
          </Link>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(28px, 1vw + 20px, 36px)", lineHeight: 1.2, fontWeight: 800 }}>Your family</h1>
          <span style={muted16}>{familyLine}</span>
          <Link href="/papers" className="mk-btn mk-btn--secondary" style={{ marginTop: 10, textDecoration: "none" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />
            </svg>
            Practice papers to print
          </Link>
        </div>

        {/* Kids: one card per child, each with their world behind an open door */}
        <section className="fa-kids" aria-labelledby="fa-kids-h" aria-busy={load.phase === "loading"} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <h2 id="fa-kids-h" className="fa-sr">
            Kids
          </h2>
          {load.phase === "loading" && (
            <>
              <p className="fa-sr" role="status">
                Loading your family…
              </p>
              <div className="fa-grid">
                <KidSkeleton />
                <KidSkeleton />
                <KidSkeleton />
              </div>
            </>
          )}
          {load.phase === "error" && (
            <div role="alert" style={{ ...card, gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, lineHeight: "24px", fontWeight: 700 }}>We couldn&apos;t load your family.</span>
              <span style={muted16}>Check your connection, then try again.</span>
              <button
                className="mk-btn mk-btn--secondary"
                type="button"
                onClick={() => {
                  setLoad({ phase: "loading" });
                  void refresh();
                }}
              >
                Try again
              </button>
            </div>
          )}
          {data && n === 0 && (
            <div style={{ ...card, gap: 6 }}>
              <span style={{ fontSize: 18, lineHeight: "24px", fontWeight: 700 }}>No kids yet</span>
              <span style={muted16}>Add your first kid to give them their own door, world and sign-in.</span>
            </div>
          )}
          {data && n > 0 && (
            <div className="fa-grid">
              {kids.map((k) => {
                const pics = kindOf(k) === "pictures";
                const resetKey = `${k.id}:reset`;
                const removeKey = `${k.id}:remove`;
                const limitsKey = `${k.id}:limits`;
                const resetOpen = panel === resetKey;
                const removeOpen = panel === removeKey;
                const limitsOpen = panel === limitsKey;
                const since = k.needsSetup ? (pics ? "not picked yet" : "not set yet") : `${k.secretEvent ?? "set"} ${dayLabel(k.secretSetAt) ?? ""}`.trim();
                const note = cardNotes[k.id];
                const tempLen = tempPw.length;
                const tempOk = tempLen >= PW_MIN;
                const confirmOk = confirmText.trim() === k.nickname;
                return (
                  <article key={k.id} className="fa-kid" aria-labelledby={`fa-kid-${k.id}`} style={{ position: "relative", minWidth: 0, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "var(--shadow-raised)", overflow: "hidden" }}>
                    <DoorStage pack={k.pack} className="fa-stage">
                      <span className="fa-door" style={{ position: "absolute", background: DOOR_GLOW, boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.7), 0 0 28px rgba(255, 236, 190, 0.55)" }} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="fa-sprite" src={kixSprite(k.pack)} alt="" style={{ position: "absolute", left: "50%", bottom: -2, transform: "translateX(-50%)", width: "auto", maxWidth: "none", display: "block", filter: "drop-shadow(0 6px 10px rgba(14, 12, 43, 0.28))" }} />
                    </DoorStage>
                    <div className="fa-info" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px" }}>
                        <h3 id={`fa-kid-${k.id}`} style={{ margin: 0, font: "800 24px/30px var(--font-display)", color: "var(--ink)", overflowWrap: "anywhere" }}>
                          {k.nickname}
                        </h3>
                        <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{LOOK[k.band].name}</span>
                      </div>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, lineHeight: "22px", fontWeight: 600 }}>
                        <span aria-hidden="true" style={swatch(k.pack, 14)} />
                        <span>
                          {k.level} · {worldName(k.pack)}
                        </span>
                      </span>
                      <span style={{ display: "flex", alignItems: "flex-start", gap: 8, ...muted16 }}>
                        <Icon d={ICON.clock} style={{ marginTop: 2 }} />
                        <span>Last here: {whenLabel(k.lastSignInAt) ?? "not yet"}</span>
                      </span>
                      <span style={{ display: "flex", alignItems: "flex-start", gap: 8, ...muted16 }}>
                        <Icon d={pics ? ICON.pictures : ICON.password} style={{ marginTop: 2 }} />
                        <span>
                          <strong style={{ fontWeight: 600, color: "var(--ink)" }}>{pics ? "Picture code" : "Password"}</strong> · {since}
                        </span>
                      </span>
                      {k.locked && (
                        <span style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--warn)" }}>
                          <Icon d={ICON.lock} style={{ marginTop: 1 }} />
                          <span>Taking a short break after too many wrong tries.</span>
                        </span>
                      )}
                      {note && (
                        <Note tone="ok">
                          {note.text}
                          {note.door && (
                            <>
                              {" "}
                              <Link href={`/doors/${k.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
                                Open {k.nickname}&apos;s door
                              </Link>
                            </>
                          )}
                        </Note>
                      )}
                    </div>
                    <FocusCard kid={k} notes={focusNotes} onRemove={(fn) => void removeFocusNote(fn)} busyId={noteBusy} />
                    <div className="fa-acts" style={{ display: "flex", gap: 8 }}>
                      <button className="mk-btn mk-btn--secondary fa-act fa-reset fa-click" type="button" onClick={() => togglePanel(resetKey)} aria-expanded={resetOpen} aria-controls={`fa-panel-${k.id}`}>
                        {pics ? "Reset code" : "Reset password"}
                      </button>
                      <button className="mk-btn mk-btn--secondary fa-act fa-reset fa-click" type="button" onClick={() => togglePanel(limitsKey)} aria-expanded={limitsOpen} aria-controls={`fa-panel-${k.id}`}>
                        Limits, voice, camera
                      </button>
                      <button
                        className="fa-act fa-rm fa-click"
                        type="button"
                        onClick={() => togglePanel(removeKey)}
                        aria-expanded={removeOpen}
                        aria-controls={`fa-panel-${k.id}`}
                        aria-label={`Remove ${k.nickname}`}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 16px", border: 0, borderRadius: "var(--radius-pill)", font: "600 16px/1 var(--font-text)" }}
                      >
                        Remove
                      </button>
                    </div>

                    <div id={`fa-panel-${k.id}`} className="fa-panelslot">
                      {/* Reset: picture code (cleared, picked again at the door) or a temporary password. Never shown. */}
                      {resetOpen && (
                        <div className="fa-panel fa-in" style={innerPanel}>
                          {pics ? (
                            <>
                              <h4 style={{ margin: 0, fontSize: 17, lineHeight: "24px", fontWeight: 700 }}>Pick a new 4-picture code with {k.nickname}</h4>
                              <p style={{ margin: 0, fontSize: 16, lineHeight: "23px", color: "var(--ink-muted)" }}>
                                The old code stops working straight away. Then sit together on this device: {k.nickname} opens their door, taps 4 pictures, then taps them again to check.
                              </p>
                              <div aria-hidden="true" style={{ display: "flex", gap: 8 }}>
                                {[1, 2, 3, 4].map((i) => (
                                  <span key={i} style={{ display: "grid", placeItems: "center", width: 44, height: 44, boxSizing: "border-box", borderRadius: 12, border: "2px dashed var(--border-control)", background: "var(--surface-raised)", fontSize: 13, fontWeight: 700, color: "var(--ink-muted)" }}>
                                    {i}
                                  </span>
                                ))}
                              </div>
                              {panelError && <Note tone="warn">{panelError}</Note>}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <button className="mk-btn mk-btn--primary fa-click" type="button" onClick={() => resetPictures(k)} disabled={busy !== null}>
                                  {busy === resetKey ? "Resetting…" : "Start"}
                                </button>
                                <button className="mk-btn mk-btn--secondary fa-click" type="button" onClick={() => openPanel(null)}>
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h4 style={{ margin: 0, fontSize: 17, lineHeight: "24px", fontWeight: 700 }}>Set a temporary password</h4>
                              <p style={{ margin: 0, fontSize: 16, lineHeight: "23px", color: "var(--ink-muted)" }}>
                                The old one stops working when you save. Tell {k.nickname} in person, not by message. {k.nickname} can change it in Me.
                              </p>
                              <PasswordField
                                id={`fa-temp-${k.id}`}
                                label={<>Temporary password for {k.nickname}</>}
                                value={tempPw}
                                onChange={(v) => {
                                  setTempPw(v);
                                  setPanelError("");
                                }}
                                onEnter={() => saveTemp(k)}
                                shown={tempShown}
                                onToggleShown={() => setTempShown(!tempShown)}
                                hintId={`fa-temp-hint-${k.id}`}
                                hintText={tempLen === 0 ? "At least 8 characters." : tempOk ? "Long enough. Save when ready." : `At least 8 characters (${tempLen} so far).`}
                                hintWarn={false}
                                surface="var(--surface-raised)"
                              />
                              {panelError && <Note tone="warn">{panelError}</Note>}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <button className="mk-btn mk-btn--primary fa-click" type="button" onClick={() => saveTemp(k)} disabled={!tempOk || busy !== null}>
                                  {busy === resetKey ? "Saving…" : "Save"}
                                </button>
                                <button className="mk-btn mk-btn--secondary fa-click" type="button" onClick={() => openPanel(null)}>
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Limits and voice: each change saves straight away */}
                      {limitsOpen && (
                        <div className="fa-panel fa-in" role="group" aria-labelledby={`fa-lim-h-${k.id}`} aria-busy={busy === limitsKey} style={innerPanel}>
                          <h4 id={`fa-lim-h-${k.id}`} style={{ margin: 0, fontSize: 17, lineHeight: "24px", fontWeight: 700 }}>
                            Limits, voice and camera for {k.nickname}
                          </h4>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52 }}>
                            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                              <span id={`fa-voice-${k.id}`} style={label16}>
                                Voice
                              </span>
                              <span style={hint(false)}>{k.voiceEnabled ? "Kix can talk and listen. Audio is never kept." : "Kix uses text only."}</span>
                            </span>
                            <Switch className="fa-click" on={k.voiceEnabled} labelledBy={`fa-voice-${k.id}`} onToggle={() => setLimits(k, { voiceEnabled: !k.voiceEnabled })} disabled={busy !== null} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, paddingTop: 10, boxShadow: "inset 0 1px 0 var(--line)" }}>
                            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                              <span id={`fa-cam-${k.id}`} style={label16}>
                                Focus camera (stays on this device)
                              </span>
                              <span style={hint(false)}>
                                {k.cameraEnabled
                                  ? "On while learning. You get notes with counts; pictures never leave the device."
                                  : "Off. When on, it counts looks away, sleepy eyes and yawns while learning, on the device only."}
                              </span>
                            </span>
                            <Switch className="fa-click" on={k.cameraEnabled} labelledBy={`fa-cam-${k.id}`} onToggle={() => setLimits(k, { cameraEnabled: !k.cameraEnabled })} disabled={busy !== null} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, boxShadow: "inset 0 1px 0 var(--line)" }}>
                            <span id={`fa-time-${k.id}`} style={label16}>
                              Time each day
                            </span>
                            <div role="group" aria-labelledby={`fa-time-${k.id}`} className="fa-limits">
                              {LIMITS.map((m) => (
                                <button key={String(m)} className="fa-click fa-chip fa-limit" type="button" aria-pressed={k.dailyLimitMin === m} onClick={() => k.dailyLimitMin !== m && setLimits(k, { dailyLimitMin: m })} disabled={busy !== null}>
                                  {limitLabel(m)}
                                </button>
                              ))}
                            </div>
                          </div>
                          {panelError && <Note tone="warn">{panelError}</Note>}
                          <span style={hint(false)} aria-live="polite">
                            {busy === limitsKey ? "Saving…" : "Changes save straight away."}
                          </span>
                          <button className="mk-btn mk-btn--secondary fa-click" type="button" onClick={() => openPanel(null)} style={{ alignSelf: "flex-start" }}>
                            Done
                          </button>
                        </div>
                      )}

                      {/* Remove: confirm inline, typing the nickname */}
                      {removeOpen && (
                        <div className="fa-panel fa-in" role="group" aria-labelledby={`fa-rm-${k.id}`} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: "var(--radius-sm)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 2px var(--warn)" }}>
                          <p id={`fa-rm-${k.id}`} style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 10, fontSize: 16, lineHeight: "23px", fontWeight: 700 }}>
                            <Icon d={ICON.warn} size={20} style={{ marginTop: 2, color: "var(--warn)" }} />
                            <span>
                              Remove {k.nickname} and all of {k.nickname}&apos;s learning data? This can&apos;t be undone.
                            </span>
                          </p>
                          <span style={hint(false)}>That includes Treasure, Kix&apos;s notebook, progress and family messages.</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <label htmlFor={`fa-confirm-${k.id}`} style={{ ...label16, fontSize: 15 }}>
                              Type {k.nickname} to confirm
                            </label>
                            <div className="fa-field" style={{ display: "flex", alignItems: "center", minHeight: 48, padding: "0 14px", borderRadius: "var(--radius-sm)", background: "var(--surface)" }}>
                              <input
                                className="fa-input"
                                id={`fa-confirm-${k.id}`}
                                type="text"
                                autoComplete="off"
                                spellCheck={false}
                                value={confirmText}
                                onChange={(e) => {
                                  setConfirmText(e.target.value);
                                  setPanelError("");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    void removeKid(k);
                                  }
                                }}
                                style={inputStyle}
                              />
                            </div>
                          </div>
                          {panelError && <Note tone="warn">{panelError}</Note>}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <button className="fa-click fa-warnbtn" type="button" onClick={() => removeKid(k)} disabled={!confirmOk || busy !== null} style={warnBtn}>
                              {busy === removeKey ? "Removing…" : "Remove"}
                            </button>
                            <button className="mk-btn mk-btn--secondary fa-click" type="button" onClick={() => openPanel(null)}>
                              Keep
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {removedNotes.map((text, i) => (
              <p key={i} className="fa-in" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)", ...muted16 }}>
                <Icon d={ICON.bin} />
                <span>{text}</span>
              </p>
            ))}
          </div>
        </section>

        <div className="fa-side">
          {/* Add a kid: closed → form → added */}
          <section aria-labelledby="fa-add-h" style={{ ...card, gap: 16 }}>
            {add === "closed" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <DoorStage pack="dreamlight" style={{ flex: "none", width: 64, height: 76, borderRadius: "32px 32px 10px 10px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={kixSprite("dreamlight")} alt="" style={{ position: "absolute", left: "50%", bottom: -2, transform: "translateX(-50%)", height: 66, width: "auto", maxWidth: "none" }} />
                  </DoorStage>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <h2 id="fa-add-h" style={{ margin: 0, font: "800 20px/26px var(--font-display)" }}>
                      Add a kid
                    </h2>
                    <span style={muted16}>Their own door, world and sign-in. No email needed.</span>
                  </div>
                </div>
                <button className="mk-btn mk-btn--primary fa-click" type="button" onClick={openAdd} aria-expanded="false">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d={ICON.plus} />
                  </svg>
                  Add a kid
                </button>
              </>
            )}

            {add === "form" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <h2 id="fa-add-h" style={{ margin: 0, font: "800 22px/28px var(--font-display)" }}>
                    Add a kid
                  </h2>
                  <button
                    className="fa-click"
                    type="button"
                    onClick={() => {
                      setAdd("closed");
                      setTried(false);
                      setAddError(null);
                    }}
                    aria-label="Close"
                    style={{ ...iconBtn, margin: "-6px -8px -6px 0" }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20 }}>
                      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d={ICON.close} />
                    </svg>
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="fa-nick" style={label16}>
                    Nickname
                  </label>
                  <div className="fa-field" data-invalid={nickErr || addError?.field === "nick" ? "true" : "false"} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 14px", borderRadius: "var(--radius-sm)", background: "var(--surface)" }}>
                    <input
                      ref={nickRef}
                      className="fa-input"
                      id="fa-nick"
                      type="text"
                      maxLength={NICK_MAX}
                      autoComplete="off"
                      value={nick}
                      onChange={(e) => {
                        setNick(e.target.value.slice(0, NICK_MAX));
                        if (addError?.field === "nick") setAddError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void submitAdd();
                        }
                      }}
                      placeholder="e.g. Jun"
                      aria-invalid={nickErr || addError?.field === "nick" ? "true" : "false"}
                      aria-describedby="fa-nick-tip"
                      style={inputStyle}
                    />
                    <span aria-hidden="true" style={{ flex: "none", fontSize: 13, lineHeight: "18px", fontWeight: 600, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {nick.length}/{NICK_MAX}
                    </span>
                  </div>
                  <span id="fa-nick-tip" style={hint(nickErr || looksFull || addError?.field === "nick")}>
                    {addError?.field === "nick"
                      ? addError.text
                      : nickErr
                        ? "Add a nickname to continue."
                        : looksFull
                          ? "That looks like a full name. A nickname keeps them private."
                          : "Use a nickname, not their full name. Up to 20 characters."}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span id="fa-level-l" style={label16}>
                    Level
                  </span>
                  <div role="group" aria-labelledby="fa-level-l" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: "var(--radius-pill)", background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                    {LEVELS.map((id) => (
                      <button
                        key={id}
                        className="fa-click fa-seg"
                        type="button"
                        onClick={() => {
                          setLevel(id);
                          setPickedKind(null);
                        }}
                        aria-pressed={id === level}
                        style={{ minHeight: 44, padding: "0 8px", border: 0, borderRadius: "var(--radius-pill)", font: "600 16px/1 var(--font-text)" }}
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                  <span style={{ display: "flex", alignItems: "flex-start", gap: 8, ...hint(false) }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, flex: "none", marginTop: 2, color: "var(--accent)" }}>
                      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
                    </svg>
                    <span>
                      <strong style={{ fontWeight: 700, color: "var(--ink)" }}>{LOOK[bandOf(level)].name}</strong> · {LOOK[bandOf(level)].note}
                    </span>
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span id="fa-world-l" style={label16}>
                    World
                  </span>
                  <div role="group" aria-labelledby="fa-world-l" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {PACKS.map((w) => (
                      <button
                        key={w.id}
                        className="fa-click fa-chip"
                        type="button"
                        onClick={() => setWorld(w.id)}
                        aria-pressed={w.id === world}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 14px 0 8px", border: 0, borderRadius: "var(--radius-pill)", font: "600 16px/1 var(--font-text)" }}
                      >
                        <span aria-hidden="true" style={swatch(w.id, 28)}>
                          <svg className="fa-tick" viewBox="0 0 24 24" style={{ width: 16, height: 16, color: "#FFFFFF", filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45))" }}>
                            <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        </span>
                        {w.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span id="fa-signin-l" style={label16}>
                    Sign-in
                  </span>
                  <div role="group" aria-labelledby="fa-signin-l" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: "var(--radius-pill)", background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                    {(
                      [
                        ["pictures", "Picture code", ICON.pictures],
                        ["password", "Password", ICON.password],
                      ] as const
                    ).map(([id, label, icon]) => (
                      <button
                        key={id}
                        className="fa-click fa-seg"
                        type="button"
                        onClick={() => setPickedKind(id)}
                        aria-pressed={id === kind}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "0 8px", border: 0, borderRadius: "var(--radius-pill)", font: "600 16px/1 var(--font-text)" }}
                      >
                        <Icon d={icon} />
                        {label}
                      </button>
                    ))}
                  </div>
                  {kind === "pictures" ? (
                    <span style={hint(false)}>
                      {nickT ? `You'll pick 4 pictures with ${nickT} the first time ${nickT} opens their door.` : "You'll pick 4 pictures together the first time they open their door."}
                    </span>
                  ) : (
                    <div style={{ paddingTop: 4 }}>
                      <PasswordField
                        id="fa-pw"
                        label="Starting password"
                        value={pw}
                        onChange={setPw}
                        onEnter={() => void submitAdd()}
                        shown={pwShown}
                        onToggleShown={() => setPwShown(!pwShown)}
                        invalid={pwErr}
                        hintId="fa-pw-hint"
                        hintText={pwErr ? "Needs at least 8 characters." : `At least 8 characters. ${nickT || "They"} can change it later in Me.`}
                        hintWarn={pwErr}
                        surface="var(--surface)"
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 60, paddingTop: 6, boxShadow: "inset 0 1px 0 var(--line)" }}>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span id="fa-voice-l" style={label16}>
                      Voice
                    </span>
                    <span style={hint(false)}>{voice ? "Kix can talk and listen. Audio is never kept." : "Kix uses text only."}</span>
                  </span>
                  <Switch className="fa-click" on={voice} labelledBy="fa-voice-l" onToggle={() => setVoice(!voice)} />
                </div>
                {addError?.field === "form" && <Note tone="warn">{addError.text}</Note>}
                <button className="mk-btn mk-btn--primary fa-click" type="button" onClick={() => void submitAdd()} disabled={busy !== null}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d={ICON.plus} />
                  </svg>
                  {busy === "add" ? "Adding…" : "Add kid"}
                </button>
                <span style={hint(false)}>Codes and passwords are scrambled as soon as you save. No one can read them back, including you.</span>
              </>
            )}

            {add === "done" && added && (
              <>
                <div className="fa-in" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "4px 0", textAlign: "center" }}>
                  <DoorStage pack={added.pack} style={{ flex: "none", width: 128, height: 152, borderRadius: "64px 64px 16px 16px" }}>
                    <span style={{ position: "absolute", left: "50%", bottom: 0, width: 96, height: 124, transform: "translateX(-50%)", borderRadius: "48px 48px 0 0", background: DOOR_GLOW, boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.7), 0 0 28px rgba(255, 236, 190, 0.6)" }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={kixSprite(added.pack)} alt="" style={{ position: "absolute", left: "50%", bottom: -2, transform: "translateX(-50%)", height: 100, width: "auto", maxWidth: "none", filter: "drop-shadow(0 6px 10px rgba(14, 12, 43, 0.28))" }} />
                  </DoorStage>
                  <h2 id="fa-add-h" style={{ margin: 0, font: "800 22px/28px var(--font-display)" }}>
                    {added.nickname} can now find their door on this device.
                  </h2>
                  <span style={{ fontSize: 16, lineHeight: "22px", fontWeight: 600 }}>
                    {added.level} · {worldName(added.pack)} · {added.kind === "pictures" ? "Picture code" : "Password"} · Voice {added.voice ? "on" : "off"}
                  </span>
                  <span style={muted16}>
                    {added.kind === "pictures"
                      ? `Next: pick ${added.nickname}'s 4-picture code together when ${added.nickname} first opens their door.`
                      : `Tell ${added.nickname} the starting password in person. ${added.nickname} can change it in Me.`}
                  </span>
                  {!added.voiceSaved && <Note tone="warn">Voice is still on. Turn it off in {added.nickname}&apos;s Limits, voice, camera.</Note>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    className="mk-btn mk-btn--primary fa-click"
                    type="button"
                    onClick={() => {
                      fresh();
                      setAdd("closed");
                    }}
                    style={{ flex: "1 1 auto" }}
                  >
                    Done
                  </button>
                  <button
                    className="mk-btn mk-btn--secondary fa-click"
                    type="button"
                    onClick={() => {
                      fresh();
                      openAdd();
                    }}
                    style={{ flex: "1 1 auto" }}
                  >
                    Add another kid
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Your account */}
          <section aria-labelledby="fa-acct-h" style={{ ...card, gap: 2 }}>
            <h2 id="fa-acct-h" style={{ margin: "0 0 6px", font: "800 20px/26px var(--font-display)" }}>
              Your account
            </h2>
            <button
              className="fa-click fa-row"
              type="button"
              onClick={() => {
                setPwResetOpen(!pwResetOpen);
                setResetMsg(null);
              }}
              aria-expanded={pwResetOpen}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: 0, border: 0, color: "var(--ink)", textAlign: "left", font: "inherit", boxShadow: "inset 0 -1px 0 var(--line)" }}
            >
              <Icon d={ICON.lock} size={20} style={{ color: "var(--ink-muted)" }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600 }}>Change password</span>
              <svg className="fa-chev" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, flex: "none", color: "var(--ink-muted)" }}>
                <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {pwResetOpen && (
              <div className="fa-in" style={{ ...innerPanel, gap: 10, margin: "8px 0 6px" }}>
                <p style={{ margin: 0, fontSize: 16, lineHeight: "23px" }}>We&apos;ll email you a link to set a new password.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="fa-reset-email" style={{ ...label16, fontSize: 15 }}>
                    Your email
                  </label>
                  <div className="fa-field" style={{ display: "flex", alignItems: "center", minHeight: 48, padding: "0 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-raised)" }}>
                    <input
                      className="fa-input"
                      id="fa-reset-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setResetMsg(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void sendReset();
                        }
                      }}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div aria-live="polite">{resetMsg && <Note tone={resetMsg.tone}>{resetMsg.text}</Note>}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button className="mk-btn mk-btn--primary fa-click" type="button" onClick={() => void sendReset()} disabled={busy !== null}>
                    {busy === "pwreset" ? "Sending…" : "Send link"}
                  </button>
                  <button className="mk-btn mk-btn--secondary fa-click" type="button" onClick={() => setPwResetOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <button
              className="fa-click fa-row"
              type="button"
              onClick={() => {
                setSignoutOpen(!signoutOpen);
                setSignoutError("");
              }}
              aria-expanded={signoutOpen}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: 0, border: 0, color: "var(--ink)", textAlign: "left", font: "inherit" }}
            >
              <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={20} style={{ color: "var(--ink-muted)" }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600 }}>Sign out on all devices</span>
              <svg className="fa-chev" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, flex: "none", color: "var(--ink-muted)" }}>
                <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {signoutOpen && (
              <div className="fa-in" style={{ ...innerPanel, gap: 10, margin: "2px 0 6px" }}>
                <p style={{ margin: 0, fontSize: 16, lineHeight: "23px" }}>Sign out on every device, including this one? Kids&apos; doors stay shut until you sign in again.</p>
                {signoutError && <Note tone="warn">{signoutError}</Note>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button className="mk-btn mk-btn--primary fa-click" type="button" onClick={() => void signOutEverywhere()} disabled={busy !== null}>
                    {busy === "signout" ? "Signing out…" : "Sign out everywhere"}
                  </button>
                  <button className="mk-btn mk-btn--secondary fa-click" type="button" onClick={() => setSignoutOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <p style={{ margin: "10px 0 0", display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line)", fontSize: 16, lineHeight: "23px" }}>
              <Icon d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5zM9 12l2 2 4-4" size={20} style={{ marginTop: 2, color: "var(--success)" }} />
              <span>Kids never need an email. Their codes and passwords are scrambled and can&apos;t be seen, even by us.</span>
            </p>
          </section>
        </div>

        {synthetic && (
          <div className="fa-foot" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 16px" }}>
            <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, lineHeight: "18px", color: "var(--ink-muted)" }}>
              <span style={{ padding: "1px 8px", borderRadius: "var(--radius-pill)", background: "var(--ink)", color: "var(--surface-raised)", fontSize: 11, lineHeight: "18px", fontWeight: 700, letterSpacing: ".04em" }}>DEMO</span>
              Synthetic demo family. Not real children or records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
