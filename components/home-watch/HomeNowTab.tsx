"use client";

// Home now (board HomeNow; docs/prd/GUARDIAN.md §2.2): the parent's view of the cameras as words, not a feed. A "Right
// now" line from Muse Spark, the newest unchecked note, a floor plan with the kids pinned in their rooms, each room's
// latest reading, and the day rolled into a timeline. Notes open as a sheet with the frames and "Right / Not right".
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/components/account/api";
import { clock, type Brief } from "@/components/location/types";
import { packColour, readableOn, type RoomKind } from "@/lib/home-watch/home-watch";
import { AlertSheet } from "./AlertSheet";
import { FloorPlan, type Pin } from "./FloorPlan";
import { KIND_TITLE, stretches, type HomeData } from "./types";
import "./homeNow.css";

type BriefReply = { brief: (Brief & { cached?: boolean }) | null };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const CARE_CUES = new Set(["crying", "frowning", "shouting posture"]);
/** Muse Spark's own sentence, kept to one line; if it's empty, the kind in short words. */
const headline = (reason: string, kind: string) => (reason.trim() ? (reason.length > 110 ? `${reason.slice(0, 107).trimEnd()}…` : reason) : `Possibly ${KIND_TITLE[kind] ?? "something to check"}`);

export function HomeNowTab({ onTab }: { onTab: (tab: "messages") => void }) {
  const [data, setData] = useState<HomeData | null>(null);
  const [denied, setDenied] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const [briefVersion, setBriefVersion] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    void api<HomeData>("GET", "/api/home").then((r) => {
      if (!live) return;
      if (r.status === 401 || r.status === 403) setDenied(true);
      else if (r.ok && r.data) setData(r.data);
    });
    return () => {
      live = false;
    };
  }, [version]);
  useEffect(() => {
    let live = true;
    void api<BriefReply>("GET", "/api/guardian/brief").then((r) => live && r.ok && r.data && setBrief(r.data.brief));
    return () => {
      live = false;
    };
  }, [briefVersion]);
  useEffect(() => {
    const a = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setVersion((n) => n + 1);
      setNow(Date.now());
    }, 10_000);
    const b = setInterval(() => document.visibilityState === "visible" && setBriefVersion((n) => n + 1), 60_000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  const isPaused = Boolean(data?.pausedUntil && Date.parse(data.pausedUntil) > now);
  const kidsByName = useMemo(() => new Map((data?.kids ?? []).map((k) => [k.nickname, k])), [data]);
  const roomName = useCallback((id: string) => data?.rooms.find((r) => r.camera.id === id)?.camera.room ?? "Home", [data]);

  const verdict = async (id: string, v: "right" | "not-right" | null) => {
    setBusy(true);
    const r = await api("PATCH", "/api/home/alerts", { id, verdict: v });
    setBusy(false);
    if (r.ok) {
      setVersion((n) => n + 1);
      setBriefVersion((n) => n + 1);
    }
  };
  const togglePause = async () => {
    await api("PATCH", "/api/home/prefs", { pauseHours: isPaused ? 0 : 1 });
    setVersion((n) => n + 1);
  };

  if (denied) return <p className="hn-empty">Sign in as a grown-up to see Home now.</p>;
  if (!data) return <p className="hn-note" role="status">Loading Home now…</p>;
  if (!data.devices.length) {
    return (
      <div className="hn-empty">
        <h2 className="pshell-h2">Home now</h2>
        <p className="pshell-p">Pair a computer running myKx Home Link (or the Home simulator) to see each room as words: who’s where and what they’re doing. Pictures are read by Muse Spark and then dropped.</p>
        <Link className="mk-btn mk-btn--primary" href="/family/guardian">
          Location and home cameras
        </Link>
      </div>
    );
  }

  const pins: Pin[] = [];
  const lit: Partial<Record<RoomKind, string>> = {};
  // A kid can only be in one room: the one whose reading of them is newest.
  const newest = new Map<string, string>();
  for (const r of data.rooms) {
    if (!r.latest || r.offline) continue;
    for (const p of r.latest.reading.people) if (p.likely && (newest.get(p.likely) ?? "") < r.latest.at) newest.set(p.likely, r.latest.at);
  }
  for (const r of data.rooms) {
    if (!r.latest || r.offline) continue;
    const reading = r.latest.reading;
    const here = reading.people.filter((p) => !p.likely || newest.get(p.likely) === r.latest!.at);
    if (!here.length) continue;
    lit[r.camera.roomKind] = reading.concern !== "none" ? "#FBE9DD" : "#E6EEFC";
    for (const p of here) {
      const kid = p.likely ? kidsByName.get(p.likely) : undefined;
      const colour = packColour(kid?.pack);
      pins.push({ room: r.camera.roomKind, label: kid?.nickname ?? (p.who === "adult" ? "Adult" : "Child"), who: p.who === "child" && !kid ? "unknown" : p.who, pack: kid?.pack ?? null, colour, ink: readableOn(colour) });
    }
  }
  const chosen = data.rooms.find((r) => r.camera.id === room) ?? null;
  const unchecked = data.alerts.filter((a) => !a.verdict);
  const banner = [...unchecked].sort((a, b) => (a.level === b.level ? b.at.localeCompare(a.at) : a.level === "urgent" ? -1 : 1))[0] ?? null;
  const sheet = data.alerts.find((a) => a.id === open) ?? null;
  const rolled = stretches(data.today);
  const status = isPaused
    ? `Paused until ${clock(data.pausedUntil!)}. No pictures are read while paused.`
    : data.camerasOn
      ? `${data.rooms.length} camera${data.rooms.length === 1 ? "" : "s"} · on until ${data.schedule.to}${data.devices.some((d) => d.kind === "simulator") ? " · synthetic pictures from the Home simulator" : ""}`
      : `Cameras are off outside ${data.schedule.from}–${data.schedule.to}. Change the hours in Location and home cameras.`;

  return (
    <div className="hn-root">
      <div className="hn-head">
        <div>
          <h2 className="pshell-h2" style={{ margin: 0 }}>
            Home now
          </h2>
          <p className="hn-status">{status}</p>
        </div>
        <button type="button" className="mk-btn mk-btn--secondary hn-btn" aria-pressed={isPaused} onClick={() => void togglePause()}>
          {isPaused ? "Resume" : "Pause 1 hour"}
        </button>
      </div>

      {brief && (
        <section className="hn-brief" aria-label="Right now">
          <p>{brief.text}</p>
          <small>{brief.source === "live" ? `Muse Spark · from the cameras and the map · ${clock(brief.at)}` : `Summary from the rules (Muse Spark wasn’t available) · ${clock(brief.at)}`}</small>
        </section>
      )}

      {banner && (
        <button type="button" className="hn-banner hn-click" data-level={banner.level} onClick={() => setOpen(banner.id)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l9.5 17h-19zM12 10v4M12 17.5h.01" />
          </svg>
          <span>
            <b>
              {banner.level === "urgent" ? "Urgent" : "Watch"} · {roomName(banner.cameraId)} · {clock(banner.at)}
            </b>
            <span className="t">{headline(banner.reason, banner.kind)}</span>
            <u>See what Muse saw</u>
          </span>
        </button>
      )}

      <div className="hn-cols">
        <section className="hn-card" aria-label="The flat">
          <FloorPlan lit={lit} selected={chosen?.camera.roomKind ?? null} pins={pins} label={`Floor plan. ${data.rooms.map((r) => `${r.camera.room}: ${r.latest?.reading.people.length ? r.latest.reading.people.map((p) => p.likely ?? p.who).join(", ") : "nobody"}`).join(". ")}. Bedrooms and bathrooms have no camera.`} />
          <ul className="hn-rooms">
            {data.rooms.map((r) => {
              const rd = r.latest?.reading;
              const who = rd?.people.length ? rd.people.map((p) => p.likely ?? (p.who === "adult" ? "adult" : "child")).join(", ") : "nobody";
              return (
                <li key={r.camera.id}>
                  <button type="button" className="hn-room hn-click" aria-pressed={room === r.camera.id} onClick={() => setRoom(room === r.camera.id ? null : r.camera.id)}>
                    <span>
                      <b>
                        {r.camera.room} <span>· {who}</span>
                      </b>
                      <span className="doing">{rd ? cap(rd.note || rd.activity) : "No reading yet"}</span>
                    </span>
                    <span className="meta">
                      {rd?.cue && <span className="hn-cue" data-tone={CARE_CUES.has(rd.cue) ? "care" : undefined}>{cap(rd.cue)}</span>}
                      {r.offline ? <span className="hn-off">Offline</span> : r.latest ? <span>{clock(r.latest.at)}{rd?.source === "cached" ? " · cached" : ""}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="hn-card" aria-label="Today at home">
          <h3>Today at home</h3>
          {rolled.length ? (
            <ol className="hn-time">
              {rolled.map((s, i) => (
                <li key={i}>
                  <span className="at">{clock(s.from) === clock(s.to) ? clock(s.from) : `${clock(s.from)}–${clock(s.to)}`}</span>
                  <span>
                    {(s.people.length ? s.people.map((p) => (p === "child" ? "A child" : p === "adult" ? "An adult" : p)).join(" and ") : "Nobody")} · {s.activity} <span style={{ color: "var(--ink-muted)" }}>({roomName(s.cameraId)})</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hn-note">Nothing yet today.</p>
          )}
          {data.alerts.length > 0 && (
            <>
              <h3 style={{ marginTop: 4 }}>Notes today</h3>
              <ul className="hn-notes">
                {data.alerts.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="hn-click" onClick={() => setOpen(a.id)}>
                      <span>
                        <span className="lv" data-level={a.level}>{a.level === "urgent" ? "Urgent" : "Watch"}</span> · {cap(KIND_TITLE[a.kind] ?? a.kind)} · {roomName(a.cameraId)}
                      </span>
                      <span>{clock(a.at)}{a.verdict ? ` · ${a.verdict === "right" ? "right" : "not right"}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="hn-note">Muse Spark reads one picture from each camera when something changes, then the picture is gone. You see words, not video. Cameras can miss things between checks. Kix never sees any of this.</p>
        </section>
      </div>

      <AlertSheet alert={sheet} room={sheet ? roomName(sheet.cameraId) : ""} onClose={() => setOpen(null)} onVerdict={(id, v) => void verdict(id, v)} onMessage={() => { setOpen(null); onTab("messages"); }} busy={busy} />
    </div>
  );
}
