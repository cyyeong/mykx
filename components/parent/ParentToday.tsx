"use client";

// The parent's Today (design board ParentDash; docs/prd/PARENT_INSIGHTS.md): what needs the grown-up first, then
// screen time against the limit, today's balance with Kix's next step, and wellbeing per session. Everything is
// computed by the guardian's deterministic rules on the server (/api/guardian/summary) and shown as "possibly …"
// with the evidence, against the child's own usual. Parent only; sample data is labelled (rule 8).
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";
import type { GuardianFlag } from "@/lib/guardian/flags";
import type { GuardianView, SessionRow } from "@/lib/guardian/view";
import "./parentDash.css";

type KidRef = { id: string; nickname: string; band: string | null; level: string | null };
type Summary = { kids: KidRef[]; kid: KidRef | null; view: GuardianView | null };
type Shared = { id: string; title: string; version: number; kid: string; spec: { cards: { front: string; back: string }[] } | null };

const KIND_LABEL = { learn: "Learning", play: "Play", create: "Making", other: "Browsing" } as const;
const KIND_COLOR = { learn: "var(--accent)", play: "var(--accent-2)", create: "var(--reward)", other: "var(--line)" } as const;
const KINDS = ["learn", "play", "create", "other"] as const;

const ICON = {
  warn: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  info: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 16v-4M12 8h.01",
  dot: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  spark: "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z",
};

function Icon({ d, size = 16, style }: { d: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, flex: "none", ...style }}>
      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const dayName = (day: string, long = false) => new Date(`${day}T04:00:00Z`).toLocaleDateString("en-SG", { weekday: long ? "long" : "short", timeZone: "UTC" });
const timeOf = (iso: string) => new Date(iso).toLocaleString("en-SG", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

function FlagCard({ flag, kid, onSeen }: { flag: GuardianFlag & { seen: boolean }; kid: string; onSeen: (id: string) => void }) {
  if (flag.level === "info") {
    return (
      <li className="pd-info">
        <Icon d={ICON.info} size={18} style={{ color: "var(--ink-muted)", marginTop: 2 }} />
        <div>
          <p className="pd-info-title">{flag.title}</p>
          {flag.mayHelp && <p className="pd-muted">{flag.mayHelp}</p>}
        </div>
      </li>
    );
  }
  const urgent = flag.level === "urgent";
  return (
    <article className={`pd-card pd-flag${urgent ? " is-urgent" : ""}${flag.seen ? " is-seen" : ""}`}>
      <div className="pd-flag-head">
        <span className={urgent ? "pd-badge is-urgent" : "pd-badge"}>
          <Icon d={urgent ? ICON.warn : ICON.eye} size={14} />
          {urgent ? "Urgent" : "Watch"}
        </span>
        <span className="pd-muted">{urgent ? "Shown at once, even in quiet hours" : `Since ${new Date(flag.since).toLocaleDateString("en-SG", { weekday: "long", timeZone: "Asia/Singapore" })}`}</span>
      </div>
      <h3 className="pd-h3">{flag.title}</h3>
      {flag.quote && (
        <blockquote className="pd-quote">
          <p>“{flag.quote}”</p>
          <span className="pd-muted">{timeOf(flag.at)}</span>
        </blockquote>
      )}
      {flag.saw.length > 0 && (
        <div className="pd-saw">
          <span className="pd-label">What we saw</span>
          <ul>
            {flag.saw.map((line) => (
              <li key={line}>
                <Icon d={ICON.dot} size={14} style={{ color: "var(--ink-muted)", marginTop: 4 }} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {flag.mayMean && (
        <p className="pd-p">
          <strong>What it may mean:</strong> {flag.mayMean}
        </p>
      )}
      {flag.mayHelp && (
        <p className="pd-p">
          <strong>What may help:</strong> {flag.mayHelp}
        </p>
      )}
      {flag.helplines && (
        <div className="pd-help">
          <Icon d={ICON.phone} size={18} style={{ marginTop: 2 }} />
          <p className="pd-p">
            <strong>Tinkle Friend</strong> <span className="pd-nowrap">1800 274 4788</span> (for children) · <strong>SOS</strong> <span className="pd-nowrap">1767</span> (24 hours)
          </p>
        </div>
      )}
      <div className="pd-actions">
        <button className="mk-btn mk-btn--secondary" type="button" aria-pressed={flag.seen} disabled={flag.seen} onClick={() => onSeen(flag.id)}>
          {flag.seen ? "Seen" : urgent ? `I've talked with ${kid}` : "Mark as seen"}
        </button>
      </div>
    </article>
  );
}

function ScreenTime({ view }: { view: GuardianView }) {
  const limit = view.settings.dailyLimitMin;
  const top = Math.max(limit * 1.4, ...view.days.map((d) => d.total), 10);
  const today = view.days[view.days.length - 1];
  const late = view.days.filter((d) => d.lateMinutes >= 1).length;
  return (
    <section className="pd-card pd-panel" aria-label="Screen time">
      <div className="pd-panel-head">
        <h2 className="pd-h2">Screen time</h2>
        <span className="pd-muted">Limit {limit} min a day</span>
      </div>
      <p className="pd-big">
        {Math.round(today.total)}
        <span className="pd-muted"> min today</span>
      </p>
      <div className="pd-legend" aria-hidden="true">
        {KINDS.map((k) => (
          <span key={k}>
            <i style={{ background: KIND_COLOR[k] }} />
            {KIND_LABEL[k]}
          </span>
        ))}
      </div>
      <div className="pd-chart" role="group" aria-label={`Minutes a day for the last 7 days, against a ${limit} minute limit`}>
        <div className="pd-limit" style={{ bottom: `${(limit / top) * 100}%` }}>
          <span>{limit} min limit</span>
        </div>
        {view.days.map((d) => (
          <div key={d.day} className="pd-slot" role="img" aria-label={`${dayName(d.day, true)}: ${Math.round(d.total)} minutes${d.overLimit ? ", over the limit" : ""}`}>
            <span className="pd-tip">
              {Math.round(d.total)} min{d.lateMinutes >= 1 ? ` · ${Math.round(d.lateMinutes)} late` : ""}
            </span>
            {d.overLimit && <span className="pd-over">over</span>}
            <div className="pd-bar" style={{ height: `${(d.total / top) * 100}%` }}>
              {KINDS.map((k) => (d.minutes[k] > 0 ? <span key={k} style={{ flexGrow: d.minutes[k], background: KIND_COLOR[k] }} /> : null))}
            </div>
            <span className="pd-day">{dayName(d.day)}</span>
          </div>
        ))}
      </div>
      <p className="pd-muted">{late ? `Used in quiet hours on ${late} ${late === 1 ? "day" : "days"} this week.` : "No use in quiet hours this week."}</p>
    </section>
  );
}

function Balance({ view, kid }: { view: GuardianView; kid: string }) {
  const today = view.days[view.days.length - 1];
  const s = view.settings;
  return (
    <section className="pd-card pd-panel" aria-label="Today's balance">
      <div className="pd-panel-head">
        <h2 className="pd-h2">Today&apos;s balance</h2>
        <span className="pd-muted">
          {Math.round(today.minutes.learn)} of {s.learnMinMin} min learning · play up to {s.playMaxMin}
        </span>
      </div>
      <div className="pd-mix" role="img" aria-label={KINDS.map((k) => `${KIND_LABEL[k]} ${Math.round(today.minutes[k])} min`).join(", ")}>
        {today.total > 0 ? KINDS.map((k) => (today.minutes[k] > 0 ? <span key={k} style={{ flexGrow: today.minutes[k], background: KIND_COLOR[k] }} title={`${KIND_LABEL[k]} ${Math.round(today.minutes[k])} min`} /> : null)) : <span className="pd-mix-empty" />}
      </div>
      <div className="pd-next">
        <Icon d={ICON.spark} size={20} style={{ color: "var(--reward)", marginTop: 2 }} />
        <div>
          <span className="pd-label">Kix suggests next for {kid}</span>
          <p className="pd-p">
            <strong>{view.next.line}</strong>
          </p>
          <p className="pd-muted">Why: {view.next.why}</p>
        </div>
      </div>
    </section>
  );
}

function SessionLine({ s, usual }: { s: SessionRow; usual: number }) {
  const low = s.focus <= usual - 20;
  const mood = s.mood && s.mood.mood !== "calm" ? s.mood.mood : null;
  return (
    <li>
      <details className="pd-session">
        <summary>
          <span className="pd-when">{timeOf(s.start)}</span>
          <span className="pd-mood">{mood ? `Possibly ${mood}` : "Seemed settled"}</span>
          <span className={low ? "pd-focus is-low" : "pd-focus"}>
            Focus {s.focus}
            {low ? " · watch" : ""}
          </span>
        </summary>
        <ul className="pd-why">
          <li>Usual focus for this child: {usual}.</li>
          {s.mood?.evidence.map((e) => <li key={e}>Words to Kix: “{e}”</li>)}
          {s.reasons.map((r) => (
            <li key={r}>{r[0].toUpperCase() + r.slice(1)}</li>
          ))}
          {s.cameraTired && <li>Camera: possibly sleepy (counted on this device only)</li>}
          {!s.mood && !s.reasons.length && !s.cameraTired && <li>Steady answers; nothing unusual.</li>}
          {s.mood && <li>Mood confidence: {s.mood.confidence}{s.mood.source === "spark" ? " (read after the session by Muse Spark)" : ""}.</li>}
        </ul>
      </details>
    </li>
  );
}

export function ParentToday() {
  const [data, setData] = useState<Summary | null>(null);
  const [kidId, setKidId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [shared, setShared] = useState<Shared[]>([]);

  useEffect(() => {
    let live = true;
    void api<{ shared: Shared[] }>("GET", "/api/family/shared").then((r) => live && r.ok && r.data && setShared(r.data.shared));
    return () => {
      live = false;
    };
  }, [version]);

  useEffect(() => {
    let live = true;
    void api<Summary>("GET", `/api/guardian/summary${kidId ? `?kid=${encodeURIComponent(kidId)}` : ""}`).then((r) => {
      if (!live) return;
      if (r.ok && r.data) {
        setData(r.data);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [kidId, version]);

  const markSeen = async (flagId: string) => {
    await api("POST", "/api/guardian/seen", { flagId });
    setVersion((v) => v + 1);
  };

  if (failed) return <p className="pshell-p">Couldn&apos;t load today&apos;s picture. Check your connection and try again.</p>;
  if (!data) return <p className="pshell-p">Loading today&apos;s picture…</p>;
  if (!data.kid || !data.view) return <p className="pshell-p">No kids yet. Add one in Your family to get started.</p>;
  const { view, kid } = data;
  const worth = view.flags.filter((f) => f.level !== "info");
  const info = view.flags.filter((f) => f.level === "info");

  return (
    <div className="pd-root">
      <div className="pd-top">
        <div>
          <h2 className="pd-h1">How {kid.nickname}&apos;s doing</h2>
          <span className="pd-muted">This week · only you can see this page.</span>
        </div>
        {view.synthetic && <span className="pd-sample">Includes sample data</span>}
      </div>

      <div className="pd-col pd-colA">
        {data.kids.length > 1 && (
          <div className="pd-kids" role="group" aria-label="Child">
            {data.kids.map((k) => (
              <button key={k.id} type="button" className="pd-click pd-kid" aria-pressed={k.id === kid.id} onClick={() => setKidId(k.id)}>
                {k.nickname}
                {k.level ? <span className="pd-kid-sub">{k.level}</span> : null}
              </button>
            ))}
          </div>
        )}
        <section className="pd-worth" aria-label="Worth a look">
          <h2 className="pd-h2">Worth a look</h2>
          {worth.length === 0 && (
            <article className="pd-card pd-clear">
              <h3 className="pd-h3">All clear</h3>
              <p className="pd-muted">Nothing needs you this week.</p>
            </article>
          )}
          {worth.map((f) => (
            <FlagCard key={f.id} flag={f} kid={kid.nickname} onSeen={markSeen} />
          ))}
          {info.length > 0 && <ul className="pd-infos">{info.map((f) => <FlagCard key={f.id} flag={f} kid={kid.nickname} onSeen={markSeen} />)}</ul>}
        </section>
      </div>

      <div className="pd-col pd-colB">
        <ScreenTime view={view} />
        <Balance view={view} kid={kid.nickname} />
      </div>

      <div className="pd-col pd-colC">
        <section className="pd-card pd-panel" aria-label="Wellbeing this week">
          <div className="pd-panel-head">
            <h2 className="pd-h2">Wellbeing this week</h2>
          </div>
          <p className="pd-muted">Focus (0–100) and mood per learning session, against {kid.nickname}&apos;s own usual. Tap one to see why.</p>
          {view.sessions.length ? (
            <ul className="pd-sessions">
              {view.sessions.map((s) => (
                <SessionLine key={s.id} s={s} usual={view.usualFocus} />
              ))}
            </ul>
          ) : (
            <p className="pd-p">No learning sessions this week yet.</p>
          )}
          <p className="pd-muted pd-sources">From answers, pauses and time away; {kid.nickname}&apos;s own words to Kix; the camera only if you switched it on (counts on the device, never pictures). Possibilities, not diagnoses.</p>
        </section>
        {shared.length > 0 && (
          <section className="pd-card pd-panel" aria-label="Shared with you">
            <div className="pd-panel-head">
              <h2 className="pd-h2">Shared with you</h2>
              <span className="pd-muted">From Vibe Zone</span>
            </div>
            <ul className="pd-sessions">
              {shared.map((c) => (
                <li key={c.id}>
                  <details className="pd-session">
                    <summary>
                      <span className="pd-when">
                        {c.kid} · version {c.version}
                      </span>
                      <span className="pd-mood">{c.title}</span>
                      <span className="pd-focus">{c.spec?.cards.length ?? 0} cards</span>
                    </summary>
                    <ul className="pd-why">
                      {c.spec?.cards.map((card, i) => (
                        <li key={i}>
                          <strong>{card.front}</strong> {card.back}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
