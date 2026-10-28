"use client";

// What my grown-ups see (board KidSharing; AGENTS.md rule 15): the kid's own page, in plain words, for the two things a
// grown-up can turn on: location sharing and the home cameras. A teen can pause sharing for 30 minutes (their grown-up
// is told straight away); a junior can't. It never shows where they are or what the cameras saw.
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";
import { clock } from "@/components/location/types";
import "./sharing.css";

export interface Mine {
  nickname: string;
  band: "junior" | "teen" | null;
  pack: string | null;
  sharing: { on: boolean; enabled: boolean; paused: boolean; pausedUntil: string | null; everySec: number | null; canPause: boolean };
  cameras: { on: boolean; rooms: string[]; from: string; to: string };
}

/** The chips a kid sees while something is on; each opens their page. */
export function chipsFor(m: Mine): { id: "share" | "cams"; label: string }[] {
  const out: { id: "share" | "cams"; label: string }[] = [];
  if (m.sharing.enabled) out.push({ id: "share", label: m.sharing.paused ? "Sharing paused" : "Sharing where you are" });
  if (m.cameras.on) out.push({ id: "cams", label: "Home cameras on" });
  return out;
}

export function SharingScreen() {
  const [m, setM] = useState<Mine | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void api<Mine>("GET", "/api/location/mine").then((r) => live && r.ok && r.data && setM(r.data));
    return () => {
      live = false;
    };
  }, [version]);

  if (!m) return <main className="ks-main"><p className="ks-small" role="status">Loading…</p></main>;
  const junior = m.band !== "teen";
  const every = m.sharing.everySec ? Math.max(1, Math.round(m.sharing.everySec / 60)) : null;
  const act = async (method: "POST" | "DELETE") => {
    setBusy(true);
    await api(method, "/api/location/pause", method === "POST" ? { minutes: 30 } : undefined);
    setBusy(false);
    setVersion((v) => v + 1);
  };
  const chips = chipsFor(m);

  return (
    <main className="ks-main">
      <header className="ks-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.pack ? `/art/kix/${m.pack}-800.webp` : "/art/kix/kix-base-800.webp"} alt="" />
        <div>
          <h1>{junior ? "Your grown-ups can see" : "What my grown-ups see"}</h1>
          <p>{junior ? "So they know you’re safe." : "Your grown-ups set these up. You can always check them here."}</p>
        </div>
      </header>

      <section className="ks-card" aria-label="Where I am">
        <h2>
          <span className="ks-dot" data-off={!m.sharing.enabled || m.sharing.paused || undefined} aria-hidden="true" />
          {!m.sharing.enabled ? "Nobody can see where you are" : m.sharing.paused ? `Paused until ${clock(m.sharing.pausedUntil!)}` : junior ? "Where you are" : "Sharing where I am"}
        </h2>
        {!m.sharing.enabled ? (
          <p>Your grown-ups haven’t turned on location sharing.</p>
        ) : m.sharing.paused ? (
          <p>Your grown-ups can see that you paused, and your last spot. Sharing starts again by itself.</p>
        ) : junior ? (
          <p>Your grown-ups see a little dot on a map when myKx is open on your phone.</p>
        ) : (
          <p>Your grown-ups see a dot on a map and whether you’re walking, running or still{every ? `, about every ${every} minutes while you move` : ""}. Only while myKx is open on this phone.</p>
        )}
        {m.sharing.canPause && (
          <>
            <button type="button" className="mk-btn mk-btn--secondary" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => void act(m.sharing.paused ? "DELETE" : "POST")}>
              {m.sharing.paused ? "Share again now" : "Pause for 30 minutes"}
            </button>
            <p className="ks-small">They’re told straight away when you pause.</p>
          </>
        )}
      </section>

      <section className="ks-card" aria-label="Home cameras">
        <h2>
          <span className="ks-dot" data-off={!m.cameras.on || undefined} aria-hidden="true" />
          {m.cameras.rooms.length === 0 ? "No home cameras" : m.cameras.on ? (junior ? "Home cameras" : `Home cameras are on until ${m.cameras.to}`) : "Home cameras are off right now"}
        </h2>
        {m.cameras.rooms.length === 0 ? (
          <p>Nobody has set up cameras at home.</p>
        ) : junior ? (
          <p>After school, the cameras tell your grown-ups which room you’re in and what you’re doing, like “reading”. They don’t watch your bedroom or the bathroom.</p>
        ) : (
          <p>The cameras in {m.cameras.rooms.join(", ")} send a short note for each room to your grown-ups, like “Study: homework, calm”. A picture is read by Muse Spark and then it’s gone, unless something looks unsafe: then they can see it for a day.</p>
        )}
      </section>

      <section className="ks-card" aria-label="Never">
        <h2>{junior ? "Kix never sees it" : "Never"}</h2>
        <ul>
          {junior ? (
            <>
              <li>Kix doesn’t know where you are.</li>
              <li>It never changes your stars.</li>
            </>
          ) : (
            <>
              <li>No camera in your bedroom or the bathroom.</li>
              <li>No live video and no recording.</li>
              <li>Kix never sees where you are or the cameras, and it never changes your stars.</li>
            </>
          )}
        </ul>
      </section>

      <section className="ks-chips-card" aria-label="Chips">
        <p className="ks-small" style={{ marginBottom: 8 }}>{chips.length ? "On Home you’ll see these while they’re on:" : "Nothing is on, so there are no chips."}</p>
        <div className="ks-chips">
          {chips.map((c) => (
            <span key={c.id} className="gchip">
              {c.label}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
