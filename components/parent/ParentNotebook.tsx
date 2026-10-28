"use client";

// Notebook (rule 11): what Kix remembers about one kid, as a few short pages the Memory Keeper keeps after each
// session, plus each session's mood reading. Every change is listed; the grown-up can edit a page or wipe it all.
// Never a label or diagnosis, never a score: progress lives in the learner record.
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";
import type { NotebookRevision, StoredSessionRead } from "@/lib/auth/store";
import type { PageSlug } from "@/lib/notebook/notebook";
import "./parentDash.css";
import "./family.css";

type KidRef = { id: string; nickname: string };
type Page = { slug: PageSlug; title: string; body: string; updatedAt: string | null };
type Book = { kids: KidRef[]; kid: KidRef | null; pages: Page[]; revisions: NotebookRevision[]; reads: StoredSessionRead[] };

const day = (iso: string) => new Date(iso).toLocaleString("en-SG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });
const MOOD_WORD: Record<string, string> = { calm: "calm", happy: "happy", curious: "curious", unsure: "unsure", frustrated: "frustrated", tired: "tired", worried: "worried" };

function PageCard({ page, kidId, onSaved }: { page: Page; kidId: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.body);
  const [note, setNote] = useState<string | null>(null);
  const lines = page.body.split("\n").filter(Boolean);
  const save = async () => {
    const r = await api("PATCH", "/api/notebook", { kidId, page: page.slug, body: draft });
    if (r.ok) {
      setEditing(false);
      setNote(null);
      onSaved();
    } else setNote(r.status === 400 ? "The Notebook keeps to kind, plain observations: no labels or diagnoses." : "Couldn't save. Try again.");
  };
  return (
    <article className="pd-card nb-page">
      <div className="pd-panel-head">
        <h3 className="pd-h3">{page.title}</h3>
        {!editing && (
          <button
            type="button"
            className="fm-chip"
            onClick={() => {
              setDraft(page.body);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea className="nb-edit" value={draft} rows={6} maxLength={1500} onChange={(e) => setDraft(e.target.value)} aria-label={`Edit ${page.title}`} />
          {note && <p className="pd-muted nb-warn">{note}</p>}
          <div className="pd-actions">
            <button type="button" className="mk-btn mk-btn--primary" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="mk-btn mk-btn--secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : lines.length ? (
        <ul className="nb-lines">
          {lines.map((l, i) => {
            const m = /^(\d{4}-\d{2}-\d{2}): (.*)$/.exec(l);
            return (
              <li key={i}>
                {m ? (
                  <>
                    <span className="nb-date">{new Date(`${m[1]}T04:00:00Z`).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "UTC" })}</span> {m[2]}
                  </>
                ) : (
                  l
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pd-muted">Nothing yet.</p>
      )}
    </article>
  );
}

export function ParentNotebook() {
  const [data, setData] = useState<Book | null>(null);
  const [kidId, setKidId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    let live = true;
    void api<Book>("GET", `/api/notebook${kidId ? `?kid=${encodeURIComponent(kidId)}` : ""}`).then((r) => {
      if (!live) return;
      if (r.ok && r.data) setData(r.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [kidId, version]);

  if (failed) return <p className="pshell-p">Couldn&apos;t load the Notebook. Check your connection and try again.</p>;
  if (!data) return <p className="pshell-p">Loading the Notebook…</p>;
  if (!data.kid) return <p className="pshell-p">No kids yet. Add one in Your family to get started.</p>;
  const kid = data.kid;
  const empty = data.pages.every((p) => !p.body) && !data.reads.length;

  const wipe = async () => {
    await api("DELETE", "/api/notebook", { kidId: kid.id });
    setConfirmWipe(false);
    setVersion((v) => v + 1);
  };

  return (
    <div className="nb-root">
      <div className="fm-head">
        <div>
          <h2 className="pd-h1">What Kix remembers about {kid.nickname}</h2>
          <span className="pd-muted">Kix reads these pages to be a kinder sidekick. Possibilities, never labels; scores live elsewhere.</span>
        </div>
        {data.kids.length > 1 && (
          <div className="pd-kids fm-kids" role="group" aria-label="Child">
            {data.kids.map((k) => (
              <button key={k.id} type="button" className="pd-click pd-kid" aria-pressed={k.id === kid.id} onClick={() => setKidId(k.id)}>
                {k.nickname}
              </button>
            ))}
          </div>
        )}
      </div>

      {empty && (
        <article className="pd-card nb-intro">
          <h3 className="pd-h3">Nothing written yet</h3>
          <p className="pd-p">After a session where {kid.nickname} talks to Kix, the Memory Keeper (Muse Spark) adds a line or two here: how they like to learn, how they ask, slips to watch, memorable moments. You can edit or wipe anything.</p>
        </article>
      )}

      <div className="nb-grid">
        {data.pages.map((p) => (
          <PageCard key={`${kid.id}-${p.slug}-${p.updatedAt}`} page={p} kidId={kid.id} onSaved={() => setVersion((v) => v + 1)} />
        ))}
      </div>

      <div className="nb-grid nb-grid--2">
        <section className="pd-card pd-panel" aria-label="Mood after each session">
          <h3 className="pd-h3">Mood after each session</h3>
          <p className="pd-muted">From {kid.nickname}&apos;s own words to Kix in that session, against nothing but themselves. Possibly, not certainly.</p>
          {data.reads.length ? (
            <ul className="pd-sessions">
              {data.reads.map((r) => (
                <li key={r.sessionStart} className="nb-read">
                  <span className="pd-when">{day(r.sessionEnd)}</span>
                  <span className="pd-mood">
                    Possibly {MOOD_WORD[r.mood] ?? r.mood} <span className="pd-muted">({r.confidence} confidence)</span>
                    {r.concern && <span className="pd-badge is-urgent nb-concern">Worth a look</span>}
                  </span>
                  {r.evidence.length > 0 && <span className="pd-muted">“{r.evidence.join("”, “")}”</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pd-muted">No readings in the last two weeks.</p>
          )}
        </section>
        <section className="pd-card pd-panel" aria-label="Every change">
          <div className="pd-panel-head">
            <h3 className="pd-h3">Every change</h3>
            {confirmWipe ? (
              <span className="pd-actions">
                <button type="button" className="fm-chip is-danger" onClick={() => void wipe()}>
                  Yes, wipe all
                </button>
                <button type="button" className="fm-chip" onClick={() => setConfirmWipe(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="fm-chip" onClick={() => setConfirmWipe(true)} disabled={!data.revisions.length && data.pages.every((p) => !p.body)}>
                Wipe the Notebook
              </button>
            )}
          </div>
          {data.revisions.length ? (
            <ul className="pd-sessions">
              {data.revisions.map((r, i) => (
                <li key={i} className="nb-read">
                  <span className="pd-when">
                    {day(r.at)} · {r.by === "memory-keeper" ? "Memory Keeper" : "You"} · {data.pages.find((p) => p.slug === r.slug)?.title ?? r.slug}
                  </span>
                  {r.reason && <span className="pd-muted">{r.reason}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pd-muted">No changes yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
