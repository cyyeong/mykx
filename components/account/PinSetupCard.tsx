"use client";

// The parent PIN card in Your family: set the 4-digit PIN once (only when no
// kid is signed in), or confirm it's set. Silent when nobody's grown-up here.
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

  if (status.set || done) {
    return (
      <section aria-label="Parent PIN" style={card}>
        <h2 style={title}>Parent PIN</h2>
        <p style={body}>Your 4-digit PIN is set. It&apos;s asked on grown-up pages whenever a kid is signed in on this device, and it unlocks for 15 minutes.</p>
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
      return;
    }
    setError(r.reason === "already-set" ? "A PIN is already set." : r.reason === "not-allowed" ? "A kid signed in — switch them out first." : "Something went wrong. Try again.");
  };

  return (
    <section aria-label="Parent PIN" style={card}>
      <h2 style={title}>Parent PIN</h2>
      <p style={body}>Four digits, asked on grown-up pages whenever a kid is signed in on this device. Set it once, somewhere the kids can&apos;t watch.</p>
      <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <label htmlFor="pin-new" style={hidden}>
            New 4-digit PIN
          </label>
          <input id="pin-new" className="fa-input" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} style={field} />
          <label htmlFor="pin-again" style={hidden}>
            Repeat the PIN
          </label>
          <input id="pin-again" className="fa-input" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••" value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, "").slice(0, 4))} style={field} />
        </div>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 15, lineHeight: "21px", color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <button className="mk-btn mk-btn--primary fa-click" type="submit" disabled={busy} style={{ alignSelf: "flex-start", minHeight: 48 }}>
          {busy ? "Setting…" : "Set the PIN"}
        </button>
      </form>
    </section>
  );
}

const card: CSSProperties = { display: "flex", flexDirection: "column", gap: 10, padding: 18, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "var(--shadow-raised)" };
const title: CSSProperties = { margin: 0, font: "600 18px/1.3 var(--font-display)" };
const body: CSSProperties = { margin: 0, fontSize: 16, lineHeight: "23px", color: "var(--ink-muted)" };
const field: CSSProperties = { flex: 1, minWidth: 0, minHeight: 56, padding: "0 16px", borderRadius: "var(--radius-sm)", border: 0, background: "var(--surface)", color: "var(--ink)", font: "600 20px/1 var(--font-text)", letterSpacing: ".35em", textAlign: "center" };
const hidden: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };
