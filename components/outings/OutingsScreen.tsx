"use client";

// Do something together (board DoTogether; docs/prd/GUARDIAN.md §2.6): weekend ideas near the family's home area. Muse
// Spark searched the web with only the area, radius, interests and dates, then planned around NEA's weather and the kids'
// week; every idea carries the page it came from. "Add to our plan" keeps it; "Tell the kids" sends a family message from
// the grown-up (a message no model reads). "Ask Muse again" runs a new search, up to three a day.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/account/api";
import { useParentLook } from "@/components/parent/look";
import "@/components/parent/parent.css";
import { clock } from "@/components/location/types";
import { dayName, inviteText, sortIdeas, type OutingIdea, type OutingRun } from "@/lib/outings/outings";
import "./outings.css";

type Reply = { run: OutingRun | null; left: number; live: boolean; prefs: { homeArea: string; radiusKm: number; interests: string[] }; kids: { id: string; nickname: string }[] };
const BAND: Record<string, string> = { Cycling: "#2C7A47", Badminton: "#1F66C1", "Eating out": "#D9822B", Swimming: "#1C8EA8", "Nature walks": "#5C7A4E", Museums: "#7A52C7", Libraries: "#9A6B2F", "Board games": "#B24A7A", Other: "#4A5482" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function OutingsScreen() {
  const [data, setData] = useState<Reply | null>(null);
  const [denied, setDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [look] = useParentLook(null);
  const [version, setVersion] = useState(0);
  const [off, setOff] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [telling, setTelling] = useState<string | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [newLike, setNewLike] = useState("");

  useEffect(() => {
    let live = true;
    void api<Reply>("GET", "/api/outings").then((r) => {
      if (!live) return;
      if (r.status === 401 || r.status === 403) setDenied(true);
      else if (r.ok && r.data) {
        setData(r.data);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [version]);

  const run = data?.run ?? null;
  const tags = useMemo(() => [...new Set([...(data?.prefs.interests ?? []).map(cap), ...(run?.ideas.map((i) => i.tag) ?? [])])], [data, run]);
  if (denied) return <main className="ot-main"><p className="ot-note">Sign in as a grown-up to see ideas.</p></main>;
  if (!data && failed)
    return (
      <main className="ot-main">
        <p className="ot-note">The weekend ideas didn&apos;t load.</p>
        <button type="button" className="mk-btn mk-btn--secondary" onClick={() => setVersion((v) => v + 1)}>
          Try again
        </button>
      </main>
    );
  if (!data) return <main className="ot-main"><p className="ot-note" role="status">Loading…</p></main>;

  const ask = async () => {
    setAsking(true);
    setMsg(null);
    const r = await api<{ run: OutingRun }>("POST", "/api/outings");
    setAsking(false);
    if (r.ok) setVersion((v) => v + 1);
    else setMsg(r.note ?? (r.reason === "slow-down" ? "That’s three searches today. Tomorrow you get three more." : r.reason === "not-configured" ? "Muse Spark isn’t set up on this server, so there’s nothing new to search with." : "Muse couldn’t finish that search. Try again in a minute."));
  };
  const plan = async (i: OutingIdea) => {
    await api("PATCH", "/api/outings", { id: i.id, planned: !run!.planned.includes(i.id) });
    setVersion((v) => v + 1);
  };
  const send = async (i: OutingIdea) => {
    const text = inviteText(i);
    const results = await Promise.all(to.map((kidId) => api("POST", "/api/messages", { kidId, message: { body: text } })));
    setMsg(results.every((r) => r.ok) ? `Sent to ${data.kids.filter((k) => to.includes(k.id)).map((k) => k.nickname).join(" and ")}.` : "Some messages didn’t send. Try again.");
    setTelling(null);
  };
  const addLike = async () => {
    const l = newLike.trim().toLowerCase();
    if (l.length < 2) return;
    await api("PATCH", "/api/home/prefs", { interests: [...data.prefs.interests, l] });
    setNewLike("");
    setMsg("Added. It counts at the next search.");
    setVersion((v) => v + 1);
  };

  const shown = sortIdeas(run?.ideas.filter((i) => !off.includes(i.tag)) ?? []);
  const planned = run?.ideas.filter((i) => run.planned.includes(i.id)) ?? [];
  const weatherOf = (d: string) => run?.weather.find((w) => w.startsWith(dayName(d)))?.split(": ")[1] ?? "";
  const prov = !run ? "" : run.source === "sample" ? "Sample: a real Muse Spark web search from 28 Oct, kept so the demo never waits." : `Muse Spark with live web search · ${run.searches} searches · ${run.ideas.length} sourced ideas · weather from NEA · ${run.source === "cached" ? "saved from a search at" : ""} ${clock(run.at)}`.replace("  ", " ");

  return (
    <div className="ot-root" data-theme="anime-sky" data-band="teen" data-look={look}>
      <main className="ot-main">
        <header>
          <Link className="ot-back" href="/parent">
            ‹ Parent dashboard
          </Link>
          <h1 className="ot-h1">Do something together</h1>
          <p className="ot-sub">
            Near Home in {data.prefs.homeArea}, within {data.prefs.radiusKm} km{run ? ` · ${run.dates.map(dayName).join(" and ")}` : ""} ·{" "}
            <Link href="/family/guardian" style={{ color: "var(--accent)", fontWeight: 700 }}>Change</Link>
          </p>
        </header>

        {run ? (
          <section className="ot-summary" aria-label="Muse’s read on the weekend">
            <p>{run.summary}</p>
            <small>{prov}</small>
          </section>
        ) : (
          <section className="ot-summary">
            <p>No ideas yet. Ask Muse to search for things to do near {data.prefs.homeArea} this weekend.</p>
          </section>
        )}

        <div className="ot-bar" role="group" aria-label="Family interests">
          {tags.map((t) => (
            <button key={t} type="button" className="ot-chip" aria-pressed={!off.includes(t)} onClick={() => setOff(off.includes(t) ? off.filter((x) => x !== t) : [...off, t])}>
              {t}
            </button>
          ))}
          <span className="ot-add">
            <input className="ot-input" value={newLike} onChange={(e) => setNewLike(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addLike()} placeholder="Add an interest" aria-label="Add an interest" maxLength={30} />
            <button type="button" className="ot-chip" aria-pressed="false" onClick={() => void addLike()}>
              Add
            </button>
          </span>
          <button type="button" className="mk-btn mk-btn--secondary" style={{ minHeight: 36, padding: "0 14px", fontSize: 13, marginLeft: "auto" }} disabled={asking || data.left === 0 || !data.live} onClick={() => void ask()}>
            {asking ? "Muse is searching the web…" : "Ask Muse again"}
          </button>
        </div>
        <p className="ot-note" role="status" aria-live="polite">
          {asking ? "This takes about a minute: Muse is searching, then planning around the weather." : msg ?? (data.live ? `${data.left} of 3 searches left today.` : "Muse Spark isn’t set up on this server.")}
        </p>

        {planned.length > 0 && (
          <section className="ot-plan" aria-label="Our plan">
            <h2>Our plan</h2>
            <ul>
              {planned.map((i) => (
                <li key={i.id}>
                  {dayName(i.day)} {i.when}: {i.title}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="ot-days">
          {(run?.dates ?? []).map((d) => {
            const ideas = shown.filter((i) => i.day === d);
            return (
              <section key={d} className="ot-day" aria-label={dayName(d)}>
                <h2>
                  {dayName(d)} {weatherOf(d) && <span>· {weatherOf(d)}</span>}
                </h2>
                {ideas.length === 0 && <p className="ot-note">Nothing here for the interests you have on.</p>}
                {ideas.map((i) => {
                  const inPlan = run!.planned.includes(i.id);
                  return (
                    <article key={i.id} className="ot-card" style={{ ["--band" as string]: BAND[i.tag] ?? BAND.Other }}>
                      <div className="ot-top">
                        <span className="ot-when">{i.when}</span>
                        <span className="ot-tag">{i.tag}</span>
                      </div>
                      <h3>{i.title}</h3>
                      <p>{i.where}</p>
                      <p className="ot-facts">{i.facts}</p>
                      <p className="ot-why">
                        <b>Why this one:</b> {i.why}
                      </p>
                      <div className="ot-acts">
                        <button type="button" className="mk-btn mk-btn--primary" style={inPlan ? { background: "var(--success)" } : undefined} aria-pressed={inPlan} onClick={() => void plan(i)}>
                          {inPlan ? "In our plan ✓" : "Add to our plan"}
                        </button>
                        <button type="button" className="mk-btn mk-btn--secondary" aria-expanded={telling === i.id} onClick={() => { setTelling(telling === i.id ? null : i.id); setTo(data.kids.map((k) => k.id)); }}>
                          Tell the kids
                        </button>
                        <a className="ot-link" href={i.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {i.sourceHost} ↗
                        </a>
                      </div>
                      {telling === i.id && (
                        <div className="ot-tell">
                          <p style={{ fontWeight: 700 }}>“{inviteText(i)}”</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                            {data.kids.map((k) => (
                              <label key={k.id}>
                                <input type="checkbox" checked={to.includes(k.id)} onChange={() => setTo(to.includes(k.id) ? to.filter((x) => x !== k.id) : [...to, k.id])} style={{ width: 20, height: 20, accentColor: "var(--accent)" }} />
                                {k.nickname}
                              </label>
                            ))}
                          </div>
                          <button type="button" className="mk-btn mk-btn--primary" style={{ alignSelf: "flex-start", minHeight: 40 }} disabled={!to.length} onClick={() => void send(i)}>
                            Send from me
                          </button>
                          <p className="ot-note">It goes as a family message from you. No model reads it.</p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>

        <p className="ot-note">Muse searched for family activities near {data.prefs.homeArea} with your interests; it never sent your kids’ names or where they are. Opening hours and prices can change, so check the source before you go.</p>
      </main>
    </div>
  );
}
