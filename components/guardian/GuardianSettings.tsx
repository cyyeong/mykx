"use client";

// Location and home cameras (board GuardianSettings; docs/prd/GUARDIAN.md §2.1, §2.2, §2.6): per kid, whether and how
// often their location is shared, and the parent's own places; the camera hours, the paired computers and a pairing
// code; the parent's own words for each kid (no face matching); the home area and interests for outing ideas; and the
// promises. Everything saves as you change it, behind the parent PIN, and is audited on the server.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/account/api";
import { Switch } from "@/components/account/Switch";
import { agoLabel, clock, type WhereData } from "@/components/location/types";
import type { GuardianPrefs, HomeCamera } from "@/lib/home-watch/home-watch";
import { MODES, type LocationMode, type PlaceKind } from "@/lib/location/location";
import "./guardian.css";

type DevicesReply = { devices: { id: string; name: string; kind: "home-link" | "simulator"; paired: boolean; lastSeenAt: string | null }[]; cameras: HomeCamera[] };
type PrefsReply = { prefs: GuardianPrefs };
type Hit = { SEARCHVAL: string; ADDRESS: string; LATITUDE: string; LONGITUDE: string };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LIKES = ["badminton", "swimming", "cycling", "eating out", "nature walks", "museums", "libraries", "board games"];
const MODE_NOTE: Record<LocationMode, string> = {
  live: "Every 30 s while moving, every 5 min while still. Uses the most battery.",
  balanced: "Every 2 min while moving, every 15 min while still.",
  saver: "Every 10 min while moving, every 30 min while still.",
  school: "Balanced on weekdays from 13:00 to 19:00, off at other times.",
};
const PROMISES = [
  "No camera sees a bathroom or any bedroom: Home Link asks you to confirm for each camera, and myKx refuses those rooms.",
  "Tell everyone at home where the cameras are, including your helper.",
  "Muse Spark reads a picture and then it’s gone. Pictures behind a note are kept 24 hours, for you to check.",
  "Room notes are kept 14 days and places 30 days. You can delete any of it.",
  "Kix never sees any of this, and it never changes stars, mastery or rewards.",
  "Every note says “possibly” and waits for you to check it.",
];

export function GuardianSettings() {
  const [where, setWhere] = useState<WhereData | null>(null);
  const [prefs, setPrefs] = useState<GuardianPrefs | null>(null);
  const [dev, setDev] = useState<DevicesReply | null>(null);
  const [denied, setDenied] = useState(false);
  const [kidId, setKidId] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; until: string } | null>(null);
  const [name, setName] = useState("Home Link");
  const [msg, setMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [version, setVersion] = useState(0);
  const [now] = useState(() => Date.now());
  const loadAll = useCallback(() => {
    setVersion((n) => n + 1);
  }, []);
  useEffect(() => {
    let live = true;
    void Promise.all([api<WhereData>("GET", "/api/location"), api<PrefsReply>("GET", "/api/home/prefs"), api<DevicesReply>("GET", "/api/home/devices")]).then(([w, p, d]) => {
      if (!live) return;
      if ([w, p, d].some((r) => r.status === 401 || r.status === 403)) return setDenied(true);
      if (w.ok && w.data) setWhere({ places: w.data.places, kids: w.data.kids });
      if (p.ok && p.data) setPrefs(p.data.prefs);
      if (d.ok && d.data) setDev(d.data);
    });
    return () => {
      live = false;
    };
  }, [version]);

  const savePrefs = async (patch: Record<string, unknown>) => {
    const r = await api<PrefsReply>("PATCH", "/api/home/prefs", patch);
    if (r.ok && r.data) setPrefs(r.data.prefs);
    else setMsg(r.reason === "invalid" ? "That didn’t save: the start must be before the end." : "That didn’t save. Try again.");
  };
  const saveKid = async (id: string, patch: { enabled?: boolean; mode?: LocationMode }) => {
    await api("PATCH", "/api/location/settings", { kidId: id, ...patch });
    loadAll();
  };

  if (denied) return <main className="gs-main"><p className="gs-note">Sign in as a grown-up to change these.</p></main>;
  if (!where || !prefs || !dev) return <main className="gs-main"><p className="gs-note" role="status">Loading…</p></main>;
  const kid = where.kids.find((k) => k.id === kidId) ?? where.kids[0];
  const paused = Boolean(prefs.camsPausedUntil && Date.parse(prefs.camsPausedUntil) > now);
  const teen = kid?.band === "teen";

  return (
    <div className="gs-root" data-theme="anime-sky" data-band="teen">
      <div className="gs-main">
        <header>
          <Link className="gs-back" href="/family">
            ‹ Your family
          </Link>
          <h1 className="gs-h1">Location and home cameras</h1>
          <p className="gs-lede">Only grown-ups in your family can change these. Kids always see when sharing or cameras are on.</p>
          {msg && <p className="gs-note" role="status" style={{ color: "var(--warn)" }}>{msg}</p>}
        </header>

        {kid && (
          <section className="gs-card" aria-labelledby="gs-where-h">
            <h2 id="gs-where-h">Where they are</h2>
            <div className="gs-chips" role="group" aria-label="Child">
              {where.kids.map((k) => (
                <button key={k.id} type="button" className="gs-chip" aria-pressed={k.id === kid.id} onClick={() => setKidId(k.id)}>
                  {k.nickname}
                </button>
              ))}
            </div>
            <div className="gs-row">
              <span className="t">
                <b id="gs-share-l">Share {kid.nickname}’s location</b>
                <span>From {kid.nickname}’s phone while myKx is open (the demo uses the Home simulator)</span>
              </span>
              <Switch on={kid.setting.enabled} labelledBy="gs-share-l" onToggle={() => void saveKid(kid.id, { enabled: !kid.setting.enabled })} />
            </div>
            <div>
              <h3 id="gs-how-l" style={{ marginBottom: 6 }}>How often</h3>
              <div className="gs-seg" role="radiogroup" aria-labelledby="gs-how-l">
                {(Object.keys(MODES) as LocationMode[]).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={kid.setting.mode === m} onClick={() => void saveKid(kid.id, { mode: m })}>
                    {MODES[m].label}
                  </button>
                ))}
              </div>
              <p className="gs-note" style={{ marginTop: 6 }}>{MODE_NOTE[kid.setting.mode]}</p>
            </div>
            {teen && (
              <div className="gs-row gs-tile">
                <span className="gs-note" style={{ color: "var(--ink)", fontSize: 14 }}>
                  {kid.nickname} can pause for 30 minutes. You’re told straight away.
                </span>
                <span className="gs-state">On for teens</span>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h3>Places</h3>
              {where.places.map((p) => (
                <div key={p.id} className="gs-row gs-tile">
                  <span className="t">
                    <b>{p.name}</b>
                    <span>Within {p.radiusM} m · tells you when they arrive and leave</span>
                  </span>
                  <button type="button" className="gs-link" onClick={async () => { await api("DELETE", "/api/location/places", { id: p.id }); loadAll(); }}>
                    Remove
                  </button>
                </div>
              ))}
              {adding ? <PlaceForm onDone={() => { setAdding(false); loadAll(); }} onCancel={() => setAdding(false)} /> : (
                <button type="button" className="mk-btn mk-btn--secondary" onClick={() => setAdding(true)}>
                  Add a place
                </button>
              )}
            </div>
            <p className="gs-note">Places are your own pins, so no map service sees where {kid.nickname} is. Points are kept 30 days.</p>
          </section>
        )}

        <section className="gs-card" aria-labelledby="gs-cam-h">
          <h2 id="gs-cam-h">Home cameras</h2>
          <div className="gs-row">
            <span className="t">
              <b id="gs-pause-l">{paused ? `Paused until ${clock(prefs.camsPausedUntil!)}` : "Running on your schedule"}</b>
              <span>{paused ? "No pictures are read while paused." : `${prefs.camFrom}–${prefs.camTo} on ${prefs.camDays.length === 7 ? "every day" : prefs.camDays.map((d) => DAYS[d - 1]).join(", ")}`}</span>
            </span>
            <button type="button" className="mk-btn mk-btn--secondary" style={{ minHeight: 40 }} onClick={() => void savePrefs({ pauseHours: paused ? 0 : 1 })}>
              {paused ? "Resume" : "Pause 1 hour"}
            </button>
          </div>
          <div>
            <h3 id="gs-days-l" style={{ marginBottom: 6 }}>Days</h3>
            <div className="gs-chips" role="group" aria-labelledby="gs-days-l">
              {DAYS.map((d, i) => {
                const on = prefs.camDays.includes(i + 1);
                return (
                  <button key={d} type="button" className="gs-chip" aria-pressed={on} onClick={() => void savePrefs({ camDays: on ? prefs.camDays.filter((x) => x !== i + 1) : [...prefs.camDays, i + 1] })}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label className="gs-label">
              From
              <input className="gs-input" type="time" value={prefs.camFrom} onChange={(e) => e.target.value && void savePrefs({ camFrom: e.target.value })} />
            </label>
            <label className="gs-label">
              To
              <input className="gs-input" type="time" value={prefs.camTo} onChange={(e) => e.target.value && void savePrefs({ camTo: e.target.value })} />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h3>Computers and cameras</h3>
            {dev.devices.length === 0 && <p className="gs-note">No computer is paired yet.</p>}
            {dev.devices.map((d) => (
              <div key={d.id} className="gs-tile" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="gs-row" style={{ minHeight: 40 }}>
                  <span className="t">
                    <b>{d.name}</b>
                    <span>{d.kind === "simulator" ? "Home simulator (synthetic pictures)" : "Home Link"} · {d.paired ? (d.lastSeenAt ? `seen ${agoLabel(d.lastSeenAt, now)}` : "paired") : "waiting for its code"}</span>
                  </span>
                  <button type="button" className="gs-link" onClick={async () => { await api("DELETE", "/api/home/devices", { id: d.id }); loadAll(); }}>
                    Remove
                  </button>
                </div>
                {dev.cameras.filter((c) => c.deviceId === d.id && c.enabled).map((c) => {
                  const off = !c.lastFrameAt || now - Date.parse(c.lastFrameAt) > 10 * 60_000;
                  return (
                    <div key={c.id} className="gs-row" style={{ minHeight: 32 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{c.room}</span>
                      <span className="gs-state" data-bad={off || undefined}>{off ? (c.lastFrameAt ? `Offline ${agoLabel(c.lastFrameAt, now).replace(" ago", "")}` : "No picture yet") : "Online"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            <p className="gs-note">Up to 10 cameras per computer. Add or rename them on the computer running Home Link.</p>
          </div>
          <div className="gs-box">
            <h3>Pair a computer</h3>
            {code && (
              <>
                <p className="gs-code" aria-live="polite">{code.code}</p>
                <p className="gs-note">Open myKx Home Link on the computer and type this code. It works once and runs out at {clock(code.until)}.</p>
              </>
            )}
            <label className="gs-label">
              Name it
              <input className="gs-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="button" className="mk-btn mk-btn--primary" disabled={!name.trim()} onClick={async () => {
              const r = await api<{ code: string }>("POST", "/api/home/devices", { name: name.trim(), kind: "home-link" });
              if (r.ok && r.data) { setCode({ code: r.data.code, until: new Date(Date.now() + 15 * 60_000).toISOString() }); loadAll(); setMsg(null); }
              else setMsg(r.reason === "too-many" ? "You have four computers already. Remove one first." : "Couldn’t make a code. Try again.");
            }}>
              {code ? "Make a new code" : "Show a pairing code"}
            </button>
          </div>
        </section>

        <section className="gs-card" aria-labelledby="gs-who-h">
          <h2 id="gs-who-h">How Muse tells your kids apart</h2>
          <p className="gs-note">A few words each, in your own words. There’s no face matching. Grown-ups, helpers and visitors are never named.</p>
          {where.kids.map((k) => (
            <label key={k.id} className="gs-label">
              {k.nickname}
              <input className="gs-input" key={prefs.descriptions[k.id] ?? ""} defaultValue={prefs.descriptions[k.id] ?? ""} maxLength={120} placeholder="e.g. about 9, short black hair, often a blue T-shirt" onBlur={(e) => e.target.value !== (prefs.descriptions[k.id] ?? "") && void savePrefs({ descriptions: { [k.id]: e.target.value } })} />
            </label>
          ))}
        </section>

        <section className="gs-card" aria-labelledby="gs-out-h">
          <h2 id="gs-out-h">Things to do together</h2>
          <label className="gs-label">
            Home area
            <input className="gs-input" key={prefs.homeArea} defaultValue={prefs.homeArea} maxLength={60} onBlur={(e) => e.target.value.trim().length >= 2 && e.target.value.trim() !== prefs.homeArea && void savePrefs({ homeArea: e.target.value.trim() })} />
          </label>
          <div>
            <h3 id="gs-rad-l" style={{ marginBottom: 6 }}>How far</h3>
            <div className="gs-seg" role="radiogroup" aria-labelledby="gs-rad-l" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {([1, 3, 5] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={prefs.radiusKm === r} onClick={() => void savePrefs({ radiusKm: r })}>
                  {r} km
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ marginBottom: 6 }}>What your family likes</h3>
            <div className="gs-chips">
              {[...new Set([...LIKES, ...prefs.interests])].map((l) => {
                const on = prefs.interests.includes(l);
                return (
                  <button key={l} type="button" className="gs-chip" aria-pressed={on} onClick={() => void savePrefs({ interests: on ? prefs.interests.filter((x) => x !== l) : [...prefs.interests, l] })}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="gs-note">Each morning Muse Spark can search the web for places and events near your home area that fit these. It searches with the area and your interests only, never the kids’ names or where they are.</p>
        </section>

        <section className="gs-card" aria-labelledby="gs-pro-h">
          <h2 id="gs-pro-h">Our promises</h2>
          <ul className="gs-promises">
            {PROMISES.map((p) => (
              <li key={p}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** A new place from an address (OneMap's search, called from the browser with only what's typed) or from this device. */
function PlaceForm({ onDone, onCancel }: { onDone: () => void | Promise<void>; onCancel: () => void }) {
  const [kind, setKind] = useState<PlaceKind>("home");
  const [label, setLabel] = useState("Home");
  const [radius, setRadius] = useState(150);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const save = async (lat: number, lng: number) => {
    const r = await api("POST", "/api/location/places", { name: label.trim() || (kind === "home" ? "Home" : kind === "school" ? "School" : "Place"), kind, lat, lng, radiusM: radius });
    if (r.ok) await onDone();
    else setErr(r.reason === "too-many" ? "That’s ten places already." : "Couldn’t save that place.");
  };
  const search = async () => {
    setErr(null);
    if (q.trim().length < 3) return;
    try {
      const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q.trim())}&returnGeom=Y&getAddrDetails=Y&pageNum=1`);
      const json = (await res.json()) as { results?: Hit[] };
      setHits((json.results ?? []).slice(0, 5));
      if (!json.results?.length) setErr("No match. Try a postal code or a building name.");
    } catch {
      setErr("The address search isn’t reachable right now.");
    }
  };
  const here = () => {
    setErr(null);
    if (!navigator.geolocation) return setErr("This device can’t share its location.");
    navigator.geolocation.getCurrentPosition((p) => void save(p.coords.latitude, p.coords.longitude), () => setErr("Couldn’t get this device’s location."), { enableHighAccuracy: true, timeout: 10_000 });
  };

  return (
    <div className="gs-form">
      <div className="gs-chips" role="radiogroup" aria-label="Kind of place">
        {(["home", "school", "other"] as const).map((k) => (
          <button key={k} type="button" role="radio" className="gs-chip" aria-checked={kind === k} onClick={() => { setKind(k); setLabel(k === "home" ? "Home" : k === "school" ? "School" : ""); }}>
            {k === "home" ? "Home" : k === "school" ? "School" : "Other"}
          </button>
        ))}
      </div>
      <label className="gs-label">
        Name
        <input className="gs-input" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <div className="gs-seg" role="radiogroup" aria-label="How close counts as there" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {[100, 150, 200, 300].map((r) => (
          <button key={r} type="button" role="radio" aria-checked={radius === r} onClick={() => setRadius(r)}>
            {r} m
          </button>
        ))}
      </div>
      <label className="gs-label">
        Find an address
        <div style={{ display: "flex", gap: 8 }}>
          <input className="gs-input" value={q} placeholder="Postal code or building name" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()} />
          <button type="button" className="mk-btn mk-btn--secondary" style={{ flex: "none" }} onClick={() => void search()}>
            Search
          </button>
        </div>
      </label>
      {hits.length > 0 && (
        <ul className="gs-results">
          {hits.map((h) => (
            <li key={`${h.LATITUDE},${h.LONGITUDE}`}>
              <button type="button" onClick={() => void save(Number(h.LATITUDE), Number(h.LONGITUDE))}>
                {h.SEARCHVAL}
                <span className="gs-note" style={{ display: "block" }}>{h.ADDRESS}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="gs-note" style={{ color: "var(--warn)" }} role="status">{err}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="mk-btn mk-btn--secondary" onClick={here}>
          Use this device’s location
        </button>
        <button type="button" className="gs-link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="gs-note">The search sends only what you type to OneMap (the Singapore Land Authority). Nothing about the kids.</p>
    </div>
  );
}
