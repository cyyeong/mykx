"use client";

// Admin → Add knowledge (design board AdminUpload; SKILL_ENGINE.md §6). Upload several PDFs at once; the Content
// Curator (Muse Spark, Standard) reads each into question patterns, traps and marking cues and routes it to a
// skill pack, or proposes a new one. Every entry waits for an admin's approval; publishing gives the pack its next
// minor version, which Kix reads when it tutors. School papers stay private reference: patterns only (rule 10).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/components/account/api";
import { RIGHTS, RIGHTS_LABEL, type KnowledgeUpload, type Review, type Rights, type SkillUpdate } from "@/lib/knowledge/knowledge";
import "@/components/admin/people/people.css";
import "./knowledge.css";

type Pack = { id: string; title: string; version: string };
type Listing = { uploads: KnowledgeUpload[]; updates: SkillUpdate[]; packs: Pack[] };
type Job = { name: string; size: number; state: "waiting" | "reading" | "done" | "failed"; note?: string };

const NAV = [
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/knowledge", label: "Add knowledge", current: true },
  { href: "/admin/people", label: "People" },
  { href: "/admin/under-the-hood", label: "Under the hood" },
];

const MAX_BYTES = 4 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function Toggle({ mark, onMark }: { mark: Review[string] | undefined; onMark: (m: Review[string]) => void }) {
  return (
    <span className="kn-toggle">
      <button type="button" aria-pressed={mark === "approved"} onClick={() => onMark("approved")}>
        Approve
      </button>
      <button type="button" aria-pressed={mark === "rejected"} onClick={() => onMark("rejected")}>
        Reject
      </button>
    </span>
  );
}

function UploadCard({ u, onReview }: { u: KnowledgeUpload; onReview: (id: string, review: Review) => void }) {
  const e = u.extraction!;
  const mark = (key: string, m: Review[string]) => onReview(u.id, { ...u.review, [key]: m });
  const approveAll = () => {
    const all: Review = { ...u.review };
    e.archetypes.forEach((_, i) => (all[`a:${i}`] ??= "approved"));
    e.traps.forEach((_, i) => (all[`t:${i}`] ??= "approved"));
    e.markingCues.forEach((_, i) => (all[`c:${i}`] ??= "approved"));
    e.items.forEach((_, i) => (all[`i:${i}`] ??= "approved"));
    onReview(u.id, all);
  };
  const p = e.paper;
  return (
    <article className="kn-card">
      <header className="kn-card-head">
        <div>
          <h3 className="kn-h3">{u.fileName}</h3>
          <p className="kn-muted">
            {[p.level !== "unknown" ? p.level : null, p.subject, p.year, p.examType, p.school].filter(Boolean).join(" · ")} · {p.pages} pages · {p.questionCount} questions
            {p.totalMarks ? ` · ${p.totalMarks} marks` : ""} · read by Muse Spark, {e.confidence} confidence
          </p>
        </div>
        <span className={u.packIsNew ? "kn-route is-new" : "kn-route"}>{u.pack ? `${u.packIsNew ? "New pack: " : "→ "}${u.pack}` : "No pack (level or subject unclear)"}</span>
      </header>
      {e.notes && <p className="kn-note">{e.notes}</p>}
      <div className="kn-actions">
        <button type="button" className="mk-btn mk-btn--secondary" onClick={approveAll}>
          Approve the rest
        </button>
        <span className="kn-muted">{u.rights === "school-private" ? "School paper: patterns only. Its questions are never kept or shown to children." : RIGHTS_LABEL[u.rights]}</span>
      </div>
      <section>
        <h4 className="kn-h4">Question patterns ({e.archetypes.length})</h4>
        <ul className="kn-list">
          {e.archetypes.map((a, i) => (
            <li key={i}>
              <div>
                <p className="kn-main">{a.pattern}</p>
                <p className="kn-muted">
                  {a.topic} · {a.format} · {a.marks} marks · ×{a.count} · difficulty {a.difficulty}
                  {a.sourcePages.length ? ` · p. ${a.sourcePages.join(", ")}` : ""}
                </p>
              </div>
              <Toggle mark={u.review[`a:${i}`]} onMark={(m) => mark(`a:${i}`, m)} />
            </li>
          ))}
        </ul>
      </section>
      {(e.traps.length > 0 || e.markingCues.length > 0) && (
        <section className="kn-two">
          <div>
            <h4 className="kn-h4">Traps ({e.traps.length})</h4>
            <ul className="kn-list">
              {e.traps.map((t, i) => (
                <li key={i}>
                  <p className="kn-main">
                    <span className="kn-muted">{t.topic}: </span>
                    {t.trap}
                  </p>
                  <Toggle mark={u.review[`t:${i}`]} onMark={(m) => mark(`t:${i}`, m)} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="kn-h4">Marking cues ({e.markingCues.length})</h4>
            <ul className="kn-list">
              {e.markingCues.map((c, i) => (
                <li key={i}>
                  <p className="kn-main">
                    <span className="kn-muted">{c.topic}: </span>
                    {c.cue}
                  </p>
                  <Toggle mark={u.review[`c:${i}`]} onMark={(m) => mark(`c:${i}`, m)} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      {e.items.length > 0 && (
        <section>
          <h4 className="kn-h4">Questions ({e.items.length}): only approved ones reach children</h4>
          <ul className="kn-list">
            {e.items.map((it, i) => (
              <li key={i}>
                <div>
                  <p className="kn-main">{it.stem}</p>
                  <p className="kn-muted">
                    {it.topic} · {it.type} · {it.marks} marks · answer: {it.answer}
                  </p>
                </div>
                <Toggle mark={u.review[`i:${i}`]} onMark={(m) => mark(`i:${i}`, m)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

export function KnowledgeScreen() {
  const [data, setData] = useState<Listing | null>(null);
  const [denied, setDenied] = useState(false);
  const [version, setVersion] = useState(0);
  const [rights, setRights] = useState<Rights>("school-private");
  const [source, setSource] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void api<Listing>("GET", "/api/admin/knowledge").then((r) => {
      if (!live) return;
      if (r.status === 401 || r.status === 403) setDenied(true);
      else if (r.ok && r.data) setData(r.data);
    });
    return () => {
      live = false;
    };
  }, [version]);

  const pending = useMemo(() => (data?.uploads ?? []).filter((u) => u.status === "ready" && !u.publishedIn), [data]);
  const byPack = useMemo(() => {
    const m = new Map<string, KnowledgeUpload[]>();
    for (const u of pending) if (u.pack) m.set(u.pack, [...(m.get(u.pack) ?? []), u]);
    return [...m.entries()];
  }, [pending]);

  const readFiles = async (files: File[]) => {
    setBusy(true);
    setPublished(null);
    const list: Job[] = files.map((f) => ({ name: f.name, size: f.size, state: f.size > MAX_BYTES ? "failed" : "waiting", note: f.size > MAX_BYTES ? `${mb(f.size)} is over the 4 MB limit` : undefined }));
    setJobs(list);
    for (let i = 0; i < files.length; i++) {
      if (list[i].state === "failed") continue;
      list[i] = { ...list[i], state: "reading" };
      setJobs([...list]);
      const form = new FormData();
      form.set("file", files[i]);
      form.set("rights", rights);
      if (source.trim()) form.set("sourceUrl", source.trim());
      try {
        const res = await fetch("/api/admin/knowledge", { method: "POST", body: form });
        const body = (await res.json()) as { ok: boolean; upload?: KnowledgeUpload; reason?: string };
        const u = body.upload;
        list[i] = u?.status === "ready" ? { ...list[i], state: "done", note: u.pack ? `${u.packIsNew ? "new pack " : "→ "}${u.pack}` : "no pack" } : { ...list[i], state: "failed", note: u?.error ?? body.reason ?? "couldn't read" };
      } catch {
        list[i] = { ...list[i], state: "failed", note: "network error" };
      }
      setJobs([...list]);
    }
    setBusy(false);
    setVersion((v) => v + 1);
  };

  const review = async (id: string, next: Review) => {
    setData((d) => (d ? { ...d, uploads: d.uploads.map((u) => (u.id === id ? { ...u, review: next } : u)) } : d));
    await api("PATCH", "/api/admin/knowledge", { id, review: next });
  };

  const publish = async (pack: string) => {
    const r = await api<{ update: SkillUpdate }>("POST", "/api/admin/knowledge/publish", { pack });
    setPublished(r.ok && r.data ? `${pack} v${r.data.update.version} is live. Kix uses it from the next session.` : "Nothing approved yet for that pack.");
    setVersion((v) => v + 1);
  };

  return (
    <div className="ap-root" data-theme="anime-sky" data-band="teen" style={{ width: "100%", minHeight: "100dvh", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
      <div className="ap-shell">
        <nav className="ap-nav" aria-label="Admin" style={{ flex: "none", boxSizing: "border-box", display: "flex", background: "var(--surface-raised)" }}>
          <div className="ap-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wordmark-on-light.svg" alt="myKx" style={{ height: 24, width: "auto" }} />
          </div>
          <div className="ap-navlist">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="ap-navi" aria-current={n.current ? "page" : undefined} style={{ display: "block", padding: 12, borderRadius: "var(--radius-sm)", fontSize: 16, lineHeight: "20px", fontWeight: 600, ...(n.current ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-muted)" }) }}>
                {n.label}
              </Link>
            ))}
          </div>
        </nav>

        <main className="ap-main kn-main-col">
          <header>
            <h1 className="kn-h1">Add knowledge</h1>
            <p className="kn-lede">Upload papers or notes, several at a time. Kix&apos;s Content Curator (Muse Spark) reads each one into question patterns, traps and marking cues, sends it to the right skill pack, and waits for your review. Publishing makes it the pack&apos;s next version.</p>
          </header>

          {denied ? (
            <p className="kn-note">Admins only. Sign in as an admin (and unlock with the parent PIN if a kid is on this device).</p>
          ) : (
            <>
              <section className="kn-card kn-upload" aria-label="Upload">
                <div
                  className="kn-drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = [...e.dataTransfer.files].filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
                    if (files.length && !busy) void readFiles(files);
                  }}
                >
                  <p className="kn-main">Drop PDFs here, or</p>
                  <button type="button" className="mk-btn mk-btn--primary" disabled={busy} onClick={() => input.current?.click()}>
                    Choose PDFs
                  </button>
                  <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => e.target.files?.length && void readFiles([...e.target.files])} />
                  <p className="kn-muted">Up to 4 MB and about 20 pages each. Files are read once and not kept.</p>
                </div>
                <fieldset className="kn-rights">
                  <legend className="kn-h4">Where are they from?</legend>
                  {RIGHTS.map((r) => (
                    <label key={r}>
                      <input type="radio" name="rights" value={r} checked={rights === r} onChange={() => setRights(r)} />
                      <span>{RIGHTS_LABEL[r]}</span>
                    </label>
                  ))}
                  <label className="kn-source">
                    <span className="kn-muted">Source page (optional)</span>
                    <input type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://…" />
                  </label>
                </fieldset>
                {jobs.length > 0 && (
                  <ul className="kn-jobs" aria-live="polite">
                    {jobs.map((j, i) => (
                      <li key={i} data-state={j.state}>
                        <span className="kn-main">{j.name}</span>
                        <span className="kn-muted">{mb(j.size)}</span>
                        <span className="kn-state">{j.state === "reading" ? "Reading…" : j.state === "waiting" ? "Waiting" : j.state === "done" ? `Ready ${j.note ?? ""}` : `Failed: ${j.note ?? ""}`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {published && <p className="kn-note">{published}</p>}

              {byPack.length > 0 && (
                <section className="kn-card" aria-label="Publish">
                  <h2 className="kn-h2">Ready to publish</h2>
                  <ul className="kn-list">
                    {byPack.map(([pack, list]) => {
                      const approved = list.reduce((n, u) => n + Object.values(u.review).filter((m) => m === "approved").length, 0);
                      const base = data?.packs.find((p) => p.id === pack);
                      return (
                        <li key={pack}>
                          <div>
                            <p className="kn-main">
                              {base?.title ?? `${pack} (new pack)`} <span className="kn-muted">{base ? `v${base.version} today` : "first version will be 0.1.0"}</span>
                            </p>
                            <p className="kn-muted">
                              {list.length} {list.length === 1 ? "upload" : "uploads"} · {approved} approved
                            </p>
                          </div>
                          <button type="button" className="mk-btn mk-btn--primary" disabled={!approved} onClick={() => void publish(pack)}>
                            Publish
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {pending.map((u) => (
                <UploadCard key={u.id} u={u} onReview={(id, r) => void review(id, r)} />
              ))}

              {(data?.updates.length ?? 0) > 0 && (
                <section className="kn-card" aria-label="Published">
                  <h2 className="kn-h2">Published</h2>
                  <ul className="kn-list">
                    {[...(data?.updates ?? [])].reverse().map((u) => (
                      <li key={u.id}>
                        <div>
                          <p className="kn-main">
                            {u.pack} v{u.version}
                          </p>
                          <p className="kn-muted">
                            {u.summary} · {u.archetypes.length} patterns, {u.traps.length} traps, {u.markingCues.length} cues, {u.items.length} questions · {new Date(u.publishedAt).toLocaleDateString("en-SG")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
