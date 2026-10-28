"use client";

// Admin → Add knowledge → New papers found: what the weekly paper scout (app/api/cron/papers) found on the approved
// sites. Papers the agent may download itself get "Read it with the knowledge agent"; the rest are links to open and
// download by hand, then upload above. Skipped ones say why (robots.txt, site terms, only old papers). Links only:
// a paper is never kept, and school papers become patterns only (rule 10).
import { useEffect, useMemo, useState } from "react";
import { api } from "@/components/account/api";
import type { KnowledgeUpload } from "@/lib/knowledge/knowledge";
import type { PaperFind, ScoutRun } from "@/lib/papers/finds";

type Listing = { finds: PaperFind[]; runs: ScoutRun[]; weekly: boolean };
type Reading = Record<string, { state: "reading" | "done" | "failed"; note: string }>;

const SITE: Record<string, string> = { sgexam: "sgexam", testpapersfree: "testpapersfree", sgtestpaper: "sgtestpaper", tutorly: "tutorly", mathtutor: "mathtutor" };
const when = (iso: string) => new Date(iso).toLocaleString("en-SG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const label = (f: PaperFind) => [f.year, f.type, f.school].filter(Boolean).join(" · ") || f.title;
const subjectName = (s: string | null) => (s ? s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") : "Other");

export function PaperFinds({ onRead, sessionId = null }: { onRead: () => void; sessionId?: string | null }) {
  const [data, setData] = useState<Listing | null>(null);
  const [version, setVersion] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    void api<Listing>("GET", "/api/admin/papers").then((r) => live && r.ok && r.data && setData(r.data));
    return () => {
      live = false;
    };
  }, [version]);

  const last = data?.runs[0] ?? null;
  const current = useMemo(() => (data && last ? data.finds.filter((f) => f.lastSeen >= last.at) : []), [data, last]);
  // A paper read in this visit stays in view, so its result shows where it was clicked.
  const visible = useMemo(() => current.filter((f) => f.fetch !== "skip" && (showAll || f.status === "new" || reading[f.id])), [current, showAll, reading]);
  const skipped = current.filter((f) => f.fetch === "skip");
  const fresh = current.filter((f) => f.fetch !== "skip" && f.status === "new").length;
  const groups = useMemo(() => {
    const m = new Map<string, PaperFind[]>();
    for (const f of visible) {
      const k = `${f.level ?? "?"} ${subjectName(f.subject)}`;
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    // Papers the agent can read itself first, then by level and subject.
    const auto = (l: PaperFind[]) => (l.some((f) => f.fetch === "auto" && f.status !== "read") ? 0 : 1);
    return [...m.entries()].sort(([a, la], [b, lb]) => auto(la) - auto(lb) || a.localeCompare(b));
  }, [visible]);

  const scan = async () => {
    setScanning(true);
    setNote(null);
    const r = await api<{ run: ScoutRun }>("POST", "/api/admin/papers");
    setScanning(false);
    setNote(r.ok ? null : "The scout couldn't finish. Try again in a minute.");
    setVersion((v) => v + 1);
  };

  const mark = async (list: PaperFind[], status: "seen" | "dismissed" | "new") => {
    const ids = new Set(list.filter((f) => f.status !== "read").map((f) => f.id));
    if (!ids.size) return;
    setData((d) => (d ? { ...d, finds: d.finds.map((x) => (ids.has(x.id) ? { ...x, status } : x)) } : d));
    await api("PATCH", "/api/admin/papers", { ids: [...ids], status });
  };

  const read = async (f: PaperFind) => {
    setReading((s) => ({ ...s, [f.id]: { state: "reading", note: "Downloading and reading… about a minute" } }));
    const r = await api<{ upload: KnowledgeUpload; find: PaperFind }>("POST", "/api/admin/papers/read", { id: f.id, ...(sessionId ? { sessionId } : {}) });
    const u = r.data?.upload;
    const done = r.ok && u?.status === "ready";
    setReading((s) => ({ ...s, [f.id]: done ? { state: "done", note: `Read → ${u.pack ?? "no pack"}. Review it below.` } : { state: "failed", note: u?.error ?? (r.reason === "download-failed" ? "Couldn't download it from the site (it may have moved). Open the page and upload it by hand." : r.reason === "download-by-hand" ? "This one has to be downloaded by hand." : "Couldn't read it.") } }));
    if (done) {
      setData((d) => (d ? { ...d, finds: d.finds.map((x) => (x.id === f.id ? r.data!.find : x)) } : d));
      onRead();
    }
  };

  return (
    <section className="kn-card pf-root" aria-label="New papers found">
      <header className="kn-card-head">
        <div>
          <h2 className="kn-h2">New papers found</h2>
          <p className="kn-muted">
            {data?.weekly ? "The scout checks the approved sites every Monday at 6 am." : "The weekly check is off on this server (CRON_SECRET isn't set); run it by hand."} It reads robots.txt first, pauses between pages and downloads nothing on its own.
            {last ? ` Last run ${when(last.at)}${last.trigger === "admin" ? " (by an admin)" : ""}: ${last.found} latest papers, ${last.fresh} new.` : " It hasn't run yet."}
          </p>
        </div>
        <button type="button" className="mk-btn mk-btn--primary" disabled={scanning} onClick={() => void scan()}>
          {scanning ? "Checking the sites…" : "Run the scout now"}
        </button>
      </header>
      {scanning && <p className="kn-note">Checking five sites politely, one page every 1.5 seconds. This takes about a minute.</p>}
      {note && !scanning && <p className="kn-note">{note}</p>}

      {last && (
        <div className="pf-bar">
          <span className="kn-toggle" role="group" aria-label="Show">
            <button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>
              New ({fresh})
            </button>
            <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>
              All latest ({current.length - skipped.length})
            </button>
          </span>
          <span className="kn-muted">
            <b className="pf-dot" data-f="auto" /> the agent can read it · <b className="pf-dot" data-f="manual" /> download by hand, then upload above
          </span>
        </div>
      )}

      {last && !groups.length && <p className="kn-muted">{showAll ? "Nothing to show." : "Nothing new since you last looked. “All latest” lists everything from the last run."}</p>}
      {groups.map(([group, list]) => {
        const reasons = [...new Map(list.filter((f) => f.status !== "read").map((f) => [`${f.site}|${f.reason}`, f])).values()];
        const unseen = list.filter((f) => f.status === "new");
        const autoN = list.filter((f) => f.fetch === "auto" && f.status !== "read").length;
        return (
          <details key={group} className="pf-group" open={autoN > 0}>
            <summary>
              <span className="kn-main">{group}</span>
              <span className="kn-muted">
                {list.length} {list.length === 1 ? "paper" : "papers"} · latest {Math.max(...list.map((f) => f.year ?? 0))}
                {autoN ? ` · ${autoN} the agent can read` : ""}
                {list[0].pack ? ` · → ${list[0].pack}${list[0].packIsNew ? " (new pack)" : ""}` : ""}
              </span>
            </summary>
            <div className="pf-why">
              <ul>
                {reasons.map((f) => (
                  <li key={`${f.site}|${f.reason}`}>
                    <b>{SITE[f.site]}</b>: {f.reason}
                  </li>
                ))}
              </ul>
              {unseen.length > 0 && (
                <button type="button" className="mk-btn mk-btn--secondary pf-btn" onClick={() => void mark(unseen, "seen")}>
                  {unseen.length === 1 ? "Mark as seen" : `Mark all ${unseen.length} seen`}
                </button>
              )}
            </div>
            <ul className="pf-rows">
              {list.map((f) => {
                const job = reading[f.id];
                return (
                  <li key={f.id} data-status={f.status}>
                    <b className="pf-dot" data-f={f.fetch} role="img" aria-label={f.fetch === "auto" ? "The agent can read it" : "Download by hand"} />
                    <span className="pf-what">
                      <span className="kn-main">{label(f)}</span>
                      {f.status === "new" && <span className="pf-new">New</span>}
                      <span className="kn-muted">
                        {SITE[f.site]}
                        {job ? ` · ${job.note}` : f.status === "read" ? " · read by the knowledge agent: review it below" : ""}
                      </span>
                    </span>
                    <span className="pf-acts">
                      {f.fetch === "auto" && f.status !== "read" ? (
                        <button type="button" className="mk-btn mk-btn--primary pf-btn" disabled={job?.state === "reading"} onClick={() => void read(f)}>
                          {job?.state === "reading" ? "Reading…" : "Read it with the knowledge agent"}
                        </button>
                      ) : f.fetch === "manual" ? (
                        <a className="pf-link" href={f.pageUrl} target="_blank" rel="noopener noreferrer" onClick={() => f.status === "new" && void mark([f], "seen")}>
                          Open the page ↗
                        </a>
                      ) : null}
                      {f.status !== "read" && (
                        <button type="button" className="pf-x" aria-label={f.status === "dismissed" ? "Show again" : "Dismiss"} title={f.status === "dismissed" ? "Show again" : "Dismiss"} onClick={() => void mark([f], f.status === "dismissed" ? "new" : "dismissed")}>
                          {f.status === "dismissed" ? "↺" : "×"}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      {last && (skipped.length > 0 || last.problems.length > 0) && (
        <details className="pf-group">
          <summary>
            <span className="kn-main">Skipped and problems</span>
            <span className="kn-muted">
              {skipped.length} skipped · {last.problems.length} notes from the last run
            </span>
          </summary>
          <ul className="pf-problems">
            {last.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
            {skipped.slice(0, 30).map((f) => (
              <li key={f.id}>
                {f.level} {subjectName(f.subject)} {label(f)} ({SITE[f.site]}): {f.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
