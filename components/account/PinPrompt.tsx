"use client";

// The PIN prompt a grown-up sees on their pages while a kid session is active
// on the device. A correct entry unlocks for 15 minutes, then the page reloads
// through the gate.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "./api";

const MESSAGES: Record<string, string> = {
  wrong: "That wasn't it — try again.",
  locked: "Too many tries. Wait a minute, then try again.",
  "slow-down": "Too many tries. Wait a moment, then try again.",
};

export function PinPrompt() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || pin.length !== 4) return;
    setBusy(true);
    setError("");
    const r = await api<{ unlocked?: boolean }>("POST", "/api/auth/pin", { action: "verify", pin });
    setBusy(false);
    if (r.ok) {
      setPin("");
      router.refresh();
      return;
    }
    setError(MESSAGES[r.reason ?? ""] ?? "Something went wrong. Try again.");
  };

  return (
    <main style={{ margin: "0 auto", maxWidth: 480, padding: "48px 20px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 22, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "var(--shadow-raised)" }}>
        <h1 style={{ margin: 0, font: "600 22px/1.25 var(--font-display)" }}>Grown-ups only</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: "23px", color: "var(--ink-muted)" }}>
          A kid is signed in on this device. Enter your 4-digit parent PIN to continue.
        </p>
        <form onSubmit={(e) => void submit(e)} style={{ display: "flex", gap: 8 }}>
          <label htmlFor="pin-prompt" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Parent PIN
          </label>
          <input
            id="pin-prompt"
            className="fa-input"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ flex: 1, minWidth: 0, minHeight: 56, padding: "0 16px", borderRadius: "var(--radius-sm)", border: 0, background: "var(--surface)", color: "var(--ink)", font: "600 20px/1 var(--font-text)", letterSpacing: ".35em", textAlign: "center" }}
          />
          <button className="mk-btn mk-btn--primary fa-click" type="submit" disabled={busy || pin.length !== 4} style={{ minHeight: 56 }}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 15, lineHeight: "21px", color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--ink-muted)" }}>
          No PIN yet, or forgot it? Switch the kid out first (their avatar menu → Switch profile), then open Your family.
        </p>
      </div>
    </main>
  );
}
