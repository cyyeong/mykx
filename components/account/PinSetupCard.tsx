"use client";

// The parent PIN card in Your family: set the 4-digit PIN (only when no kid is
// signed in), confirm it's set, or change it. Silent when nobody's grown-up here.
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api } from "./api";

type Status = { set?: boolean; kidActive?: boolean; unlocked?: boolean };

export function PinSetupCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let live = true;
    void api<Status>("GET", "/api/auth/pin").then((r) => {
      if (live && r.ok && r.data) setStatus(r.data);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!status) return null;

  if (status.kidActive) {
    return (
      <section aria-label="Parent PIN" style={card}>
        <h2 style={title}>Parent PIN</h2>
        <p style={body}>A kid is signed in right now, so the PIN can&apos;t be set or changed here. Switch them out first (avatar menu → Switch profile), then come back.</p>
        <Link className="mk-btn mk-btn--secondary fa-click" href="/doors" style={{ alignSelf: "flex-start", minHeight: 44 }}>
          Go to the doors
        </Link>
      </section>
    );
  }

  if ((status.set && !changing) || done) {
    return (
      <section aria-label="Parent PIN" style={card}>
        <h2 style={title}>Parent PIN</h2>
        <p style={body}>
          Your 4-digit PIN is set. Once a kid has signed in on this device, grown-up pages ask for it (even after they switch out) until you sign in
          again with your password. It unlocks for 15 minutes. Forgot it? Sign out, sign back in, then change it here.
        </p>
        <button
          className="mk-btn mk-btn--secondary fa-click"
          type="button"
          onClick={() => {
            setDone(false);
            setChanging(true);
          }}
          style={{ alignSelf: "flex-start", minHeight: 44 }}
        >
          Change the PIN
        </button>
      </section>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("Four digits, nothing else.");
      return;
    }
    if (pin !== again) {
      setError("The two entries don't match.");
      return;
    }
    setBusy(true);
    setError("");
    const r = await api<{ set?: boolean }>("POST", "/api/auth/pin", { action: "setup", pin });
    setBusy(false);
    if (r.ok) {
      setPin("");
      setAgain("");
      setDone(true);
      setChanging(false);
      setStatus({ ...status, set: true });
      return;
    }
    setError(r.reason === "not-allowed" ? "A kid has been here — sign in again with your password first." : "Something went wrong. Try again.");
  };

  return (
    <section aria-label="Parent PIN" style={card}>
      <h2 style={title}>Parent PIN</h2>
      <p style={body}>
        {changing
          ? "Choose a new 4-digit PIN, somewhere the kids can't watch."
          : "A 4-digit code that keeps kids out of grown-up pages (like this one) after they've used this device. Type it twice to make sure it's right, somewhere the kids can't watch."}
      </p>
      <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <label htmlFor="pin-new" style={fieldBox}>
            <span style={label}>New PIN</span>
            <input id="pin-new" className="fa-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={field} />
          </label>
          <label htmlFor="pin-again" style={fieldBox}>
            <span style={label}>Type it again</span>
            <input id="pin-again" className="fa-input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, "").slice(0, 4))} style={field} />
          </label>
        </div>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 15, lineHeight: "21px", color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <button className="mk-btn mk-btn--primary fa-click" type="submit" disabled={busy} style={{ alignSelf: "flex-start", minHeight: 48 }}>
          {busy ? "Setting…" : changing ? "Change the PIN" : "Set the PIN"}
        </button>
      </form>
    </section>
  );
}

const card: CSSProperties = { display: "flex", flexDirection: "column", gap: 10, padding: 18, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", color: "var(--ink)", boxShadow: "var(--shadow-raised)" };
const title: CSSProperties = { margin: 0, font: "700 20px/1.3 var(--font-display)", color: "var(--ink)" };
const body: CSSProperties = { margin: 0, fontSize: 16, lineHeight: "23px", color: "var(--ink-muted)" };
const fieldBox: CSSProperties = { flex: "1 1 120px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 };
const label: CSSProperties = { fontSize: 14, lineHeight: "20px", fontWeight: 700, color: "var(--ink)" };
const field: CSSProperties = { width: "100%", boxSizing: "border-box", minHeight: 52, padding: "0 16px", borderRadius: "var(--radius-sm)", border: 0, background: "var(--surface)", boxShadow: "inset 0 0 0 1.5px var(--border-control)", color: "var(--ink)", font: "600 20px/1 var(--font-text)", letterSpacing: ".3em", textAlign: "center" };
