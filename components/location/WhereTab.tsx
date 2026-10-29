"use client";

// Where they are (board GuardianMap; docs/prd/GUARDIAN.md §2.1): the parent's map tab. Muse Spark's "Right now" brief
// on top, a chip per kid, the map, and the chosen kid's afternoon: arrived and left, and how they're moving, said as
// "possibly". Points come from the kid's phone while myKx is open (the app is milestone M6) or, in the demo, from the
// Home simulator, and the page says which. A teen who has paused shows as paused, with the last point greyed.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";
import { packColour } from "@/lib/home-watch/home-watch";
import { MODES, MOTION_LABEL } from "@/lib/location/location";
import { WhereMap } from "./WhereMap";
import { agoLabel, clock, freshness, type Brief, type MapKid, type WhereData } from "./types";
import "./where.css";

type BriefReply = { brief: (Brief & { cached?: boolean }) | null };

function headline(k: MapKid, now: number): { title: string; sub: string } {
  const paused = Boolean(k.setting.pausedUntil && Date.parse(k.setting.pausedUntil) > now);
  if (!k.setting.enabled) return { title: `${k.nickname}’s location is off`, sub: "Turn it on in Location and home cameras." };
  if (paused) return { title: `${k.nickname} paused sharing`, sub: `Until ${clock(k.setting.pausedUntil!)}${k.latest ? ` · last seen ${agoLabel(k.latest.at, now)}` : ""}` };
  if (!k.latest) return { title: `No location from ${k.nickname} yet`, sub: "Points arrive while myKx is open on their phone." };
  const inPlace = k.events.length && k.events[0].kind === "arrived" ? k.events[0].placeName : null;
  const motion = k.latest.motion;
  const title = inPlace && (motion === "still" || motion === "unknown") ? `${k.nickname} is at ${inPlace}` : `${k.nickname}: ${MOTION_LABEL[motion].toLowerCase()}`;
  return { title, sub: `${inPlace && motion !== "still" ? `Near ${inPlace} · ` : ""}updated ${agoLabel(k.latest.at, now)}` };
}

export function WhereTab({ onTab }: { onTab: (tab: "messages") => void }) {
  const [data, setData] = useState<WhereData | null>(null);
  const [denied, setDenied] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [version, setVersion] = useState(0);
  const [briefVersion, setBriefVersion] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    void api<WhereData>("GET", "/api/location").then((r) => {
      if (!live) return;
      if (r.status === 401 || r.status === 403) setDenied(true);
      else if (r.ok && r.data) setData({ places: r.data.places, kids: r.data.kids });
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
    }, 20_000);
    const b = setInterval(() => document.visibilityState === "visible" && setBriefVersion((n) => n + 1), 60_000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  if (denied) return <p className="wh-empty">Sign in as a grown-up to see where everyone is.</p>;
  if (!data) return <p className="wh-note" role="status">Loading the map…</p>;
  const kids = data.kids.filter((k) => k.setting.enabled || k.latest);
  if (!kids.length) {
    return (
      <div className="wh-empty">
        <h2 className="pshell-h2">Location</h2>
        <p className="pshell-p">Location sharing is off for every kid. Turn it on, add Home and School, and pick how often.</p>
        <Link className="mk-btn mk-btn--primary" href="/family/guardian">
          Location and home cameras
        </Link>
      </div>
    );
  }
  const sel = kids.find((k) => k.id === pick) ?? kids.find((k) => k.latest) ?? kids[0];
  const h = headline(sel, now);
  const colour = packColour(sel.pack);
  const mode = MODES[sel.setting.mode];
  const events = [...sel.events].reverse();
  const fresh = sel.latest ? freshness(sel.latest.at, now) : "grey";

  return (
    <div className="wh-root">
      <div className="wh-head">
        <h2 className="pshell-h2" style={{ margin: 0 }}>
          Location
        </h2>
        <span className="wh-note">Today, {clock(new Date(now).toISOString())}</span>
      </div>

      {brief && (
        <section className="wh-brief" aria-label="Right now">
          <p>{brief.text}</p>
          <small>{brief.source === "live" ? `Muse Spark · from the map, your places and the cameras · ${clock(brief.at)}` : `Summary from the rules (Muse Spark wasn’t available) · ${clock(brief.at)}`}</small>
        </section>
      )}

      <div className="wh-kids" role="group" aria-label="Choose a child">
        {kids.map((k) => {
          const hh = headline(k, now);
          return (
            <button key={k.id} type="button" className="wh-kid" aria-pressed={k.id === sel.id} onClick={() => setPick(k.id)}>
              <span className="wh-dot" style={{ background: packColour(k.pack) }} aria-hidden="true" />
              <span style={{ minWidth: 0 }}>
                <b>{k.nickname}</b>
                <span className="sub">{hh.title.replace(`${k.nickname}: `, "").replace(`${k.nickname} is `, "")}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="wh-body">
        <div className="wh-mapbox">
          <WhereMap kids={kids} places={data.places} selectedId={sel.id} />
          <span className="wh-live">
            <i style={{ background: fresh === "fresh" ? "var(--success)" : fresh === "amber" ? "var(--warn)" : "var(--border-control)" }} />
            {sel.setting.enabled ? `Checks every ${Math.round(mode.movingSec / 60) || 1} min while moving` : "Sharing is off"}
          </span>
        </div>

        <section className="wh-sheet" aria-label={`${sel.nickname}’s afternoon`}>
          <div className="wh-who">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sel.pack ? `/art/kix/${sel.pack}-800.webp` : "/art/kix/kix-base-800.webp"} alt="" style={{ boxShadow: `0 0 0 3px var(--surface-raised), 0 0 0 6px ${colour}` }} />
            <div>
              <h3>{h.title}</h3>
              <p>{h.sub}</p>
            </div>
          </div>
          <ol className="wh-time">
            {events.map((e) => (
              <li key={e.id}>
                <span className="at">{clock(e.at)}</span>
                <span className="mark" style={{ background: colour }} aria-hidden="true" />
                <span className="what">
                  {e.kind === "arrived" ? "Arrived at" : "Left"} {e.placeName}
                </span>
              </li>
            ))}
            {sel.latest && (
              <li>
                <span className="at">{clock(sel.latest.at)}</span>
                <span className="mark" style={{ boxShadow: `inset 0 0 0 3px ${colour}`, background: "var(--surface-raised)" }} aria-hidden="true" />
                <span className="what">
                  {MOTION_LABEL[sel.latest.motion]}
                  <small>{agoLabel(sel.latest.at, now)}{sel.latest.battery !== null ? ` · battery ${sel.latest.battery}%` : ""}</small>
                </span>
              </li>
            )}
            {!events.length && !sel.latest && <li><span className="at" /><span className="mark" /><span className="what"><small>Nothing yet today.</small></span></li>}
          </ol>
          <div className="wh-acts">
            <button type="button" className="mk-btn mk-btn--primary" onClick={() => onTab("messages")}>
              Message {sel.nickname}
            </button>
            <Link className="mk-btn mk-btn--secondary" href="/family/guardian">
              Places and modes
            </Link>
          </div>
          <p className="wh-note">
            {sel.latest?.source === "sim" ? "Synthetic: a made-up route from the Home simulator. " : `Shared from ${sel.nickname}’s phone while myKx is open. `}
            {mode.label}: every {Math.round(mode.movingSec / 60) || 1} min while moving, every {Math.round(mode.stillSec / 60)} min while still. “Possibly” states come from speed and the phone’s motion; they can be wrong.
          </p>
        </section>
      </div>
    </div>
  );
}
