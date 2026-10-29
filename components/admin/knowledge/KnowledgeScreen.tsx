"use client";

// Admin → Add knowledge, as review sessions (board KnowledgeSession; founder, 29 Oct; SKILL_ENGINE.md §6). Add PDFs in
// any order: a question paper now, its answer sheet later. Muse Spark reads what each one is, sorts it by level and
// subject (the admin can change level, subject and tier: "changed by you"), and pairs a sheet with its paper; a
// separate Muse call cross-checks every answer and its spelling and flags anything unusual. Every pattern, trap,
// cue and question can be edited, removed or added. Publishing makes a new version of the skill (Admin → Skills);
// it is blocked while a key and Muse disagree. School papers stay private reference: patterns, statistics and
// Kix's own new questions, never their own questions (rule 10).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHECK_LABEL, DOC_LABEL, LEVELS, RIGHTS, RIGHTS_LABEL, SUBJECTS, TIER_LABEL, TIERS, type CrossCheck, type KixItem, type KnowledgeSession, type KnowledgeUpload, type PaperOverrides, type Resolution, type Review, type Rights, type SkillUpdate } from "@/lib/knowledge/knowledge";
import { checkOf, docKind, effectivePaper, entriesOf, keyedQuestions, normNo, pairUploads, publishBlockers, refineCounts, routeOf } from "@/lib/knowledge/session";
import { call, failWords, SPARKLE } from "../skills/call";
import "../skills/skills.css";
import { cleanLines, EntryEditor, type FieldSpec } from "./EntryEditor";
import { PaperFinds } from "./PaperFinds";
import "./knowledge.css";

type Pack = { id: string; title: string; version: string; topics: string[]; level: string | null; subject: string | null; tier: string | null };
type Listing = { uploads: KnowledgeUpload[]; updates: SkillUpdate[]; packs: Pack[]; sessions: KnowledgeSession[]; sessionsReady: boolean };
type Job = { name: string; size: number; state: "waiting" | "reading" | "done" | "failed"; note?: string };
type Kind = "archetypes" | "traps" | "markingCues" | "items";

const MAX_BYTES = 4 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
const SUBJECT_NAME: Record<string, string> = { maths: "Maths", science: "Science", english: "English", chinese: "Chinese", "higher-chinese": "Higher Chinese", tamil: "Tamil", malay: "Malay", other: "Other" };
const RIGHTS_SHORT: Record<Rights, string> = { "school-private": "School paper, private reference", own: "Our own material", licensed: "Licensed to us" };
const PREFIX: Record<Kind, string> = { archetypes: "a", traps: "t", markingCues: "c", items: "i" };
const RESOLVED_WORDS: Record<Resolution, string> = { "key-right": "You marked the key right", "use-muse": "Muse's answer is now the key", "use-fix": "The spelling fix is in the key" };

const FIELDS: Record<Kind, FieldSpec[]> = {
  archetypes: [
    { k: "pattern", label: "Pattern (in our own words)", kind: "area", wide: true, max: 160 },
    { k: "topic", label: "Topic", kind: "text", max: 60 },
    { k: "format", label: "Format", kind: "select", options: ["mcq", "short-answer", "open-ended", "structured", "other"] },
    { k: "marks", label: "Marks", kind: "number", max: 20 },
    { k: "count", label: "Questions like it", kind: "number", min: 1, max: 60 },
    { k: "difficulty", label: "Difficulty (1 to 4)", kind: "number", min: 1, max: 4 },
  ],
  traps: [
    { k: "trap", label: "Trap", kind: "area", wide: true, max: 200 },
    { k: "topic", label: "Topic", kind: "text", max: 60 },
  ],
  markingCues: [
    { k: "cue", label: "What the marking rewards", kind: "area", wide: true, max: 200 },
    { k: "topic", label: "Topic", kind: "text", max: 60 },
  ],
  items: [
    { k: "stem", label: "Question", kind: "area", wide: true, max: 600 },
    { k: "options", label: "Options, one per line (multiple choice)", kind: "lines", wide: true },
    { k: "answer", label: "Answer (an option number for multiple choice)", kind: "text", max: 300 },
    { k: "topic", label: "Topic", kind: "text", max: 60 },
    { k: "type", label: "Type", kind: "select", options: ["mcq", "short-answer", "open-ended"] },
    { k: "marks", label: "Marks", kind: "number", max: 10 },
    { k: "difficulty", label: "Difficulty (1 to 4)", kind: "number", min: 1, max: 4 },
  ],
};
const BLANK: Record<Kind, Record<string, unknown>> = {
  archetypes: { topic: "", pattern: "", marks: 1, count: 1, difficulty: 2, format: "short-answer", sourcePages: [] },
  traps: { topic: "", trap: "" },
  markingCues: { topic: "", cue: "" },
  items: { topic: "", type: "short-answer", stem: "", options: null, answer: "", marks: 1, difficulty: 2 },
};
const KIX_FIELDS: FieldSpec[] = [
  { k: "stem", label: "Question", kind: "area", wide: true, max: 700 },
  { k: "options", label: "Options, one per line (multiple choice)", kind: "lines", wide: true },
  { k: "answer", label: "Answer (an option number for multiple choice)", kind: "text", max: 200 },
  { k: "marks", label: "Marks", kind: "number", min: 1, max: 5 },
];

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sk-sparkle">
      <path d={SPARKLE} />
    </svg>
  );
}

/** "2025 P6 Maths SA2, Paper 2 (questions)": how a paper is named in the session. */
function titleOf(u: KnowledgeUpload): string {
  const e = u.extraction;
  if (!e) return u.fileName;
  const p = effectivePaper(u);
  const kind = docKind(u);
  const bits = [e.paper.year, p.level !== "unknown" ? p.level : null, SUBJECT_NAME[p.subject] ?? null, e.paper.examType].filter(Boolean).join(" ");
  const no = e.document?.paperNumber ? `, Paper ${e.document.paperNumber.replace(/^paper\s*/i, "")}` : "";
  const what = kind === "question-paper" ? "questions" : kind === "answer-sheet" ? "answer sheet" : kind === "both" ? "questions and answers" : "notes";
  return bits ? `${bits}${no} (${what})` : u.fileName;
}

function Toggle({ mark, onMark, label }: { mark: Review[string] | undefined; onMark: (m: Review[string]) => void; label: string }) {
  return (
    <span className="kn-toggle" role="group" aria-label={label}>
      <button type="button" aria-pressed={mark === "approved"} onClick={() => onMark("approved")}>
        Approve
      </button>
      <button type="button" aria-pressed={mark === "rejected"} onClick={() => onMark("rejected")}>
        {mark === "rejected" ? "Removed" : "Remove"}
      </button>
    </span>
  );
}

function CheckCell({ check, keyAnswer, resolved }: { check: CrossCheck | null; keyAnswer: string | null; resolved: Resolution | undefined }) {
  if (resolved) {
    return (
      <>
        <span className="sk-chip sk-ok">Settled</span>
        <small>{RESOLVED_WORDS[resolved]}</small>
      </>
    );
  }
  if (!check) return keyAnswer ? <span className="sk-chip sk-plain">Not checked yet</span> : <span className="sk-chip sk-warn">Waiting</span>;
  const cls = check.status === "ok" ? "sk-ok" : check.status === "mismatch" ? "sk-flag" : "sk-warn";
  return (
    <>
      <span className={`sk-chip ${cls}`}>{CHECK_LABEL[check.status]}</span>
      {check.status === "mismatch" && (
        <small>
          Key: {keyAnswer ?? "none"}. Muse works out {check.museAnswer ?? "something else"}. Check the key.
        </small>
      )}
      {check.status === "spelling" && <small>{check.fix ? `Should read: “${check.fix}”` : "A spelling slip in the key"}{check.note ? `. ${check.note}` : ""}</small>}
      {(check.status === "unusual" || check.status === "waiting") && check.note && <small>{check.note}</small>}
      {check.status === "ok" && check.note && <small>{check.note}</small>}
    </>
  );
}

export function KnowledgeScreen() {
  const [data, setData] = useState<Listing | null>(null);
  const [denied, setDenied] = useState(false);
  const [reload, setReload] = useState(0);
  const [sessionId, setSessionId] = useState<string | null | undefined>(undefined);
  const [picked, setPicked] = useState<string | null>(null);
  const [rights, setRights] = useState<Rights>("school-private");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string; pack?: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void call<Listing>("GET", "/api/admin/knowledge").then((r) => {
      if (!live) return;
      if (r.status === 401 || r.status === 403) setDenied(true);
      else if (r.ok && r.data) setData(r.data);
    });
    return () => {
      live = false;
    };
  }, [reload]);

  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const activeId = sessionId !== undefined ? sessionId : (sessions[0]?.id ?? null);
  const session = sessions.find((s) => s.id === activeId) ?? null;
  const mine = useMemo(() => (data?.uploads ?? []).filter((u) => (activeId ? u.sessionId === activeId : !u.sessionId) && (!u.publishedIn || u.sessionId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [data, activeId]);
  const legacyCount = (data?.uploads ?? []).filter((u) => !u.sessionId && !u.publishedIn).length;
  const packIds = useMemo(() => (data?.packs ?? []).map((p) => p.id), [data]);
  const pairs = useMemo(() => pairUploads(mine), [mine]);
  const byId = useMemo(() => new Map(mine.map((u) => [u.id, u])), [mine]);
  const selected = byId.get(picked ?? "") ?? mine.find((u) => u.status === "ready") ?? null;
  const open = mine.filter((u) => u.status === "ready" && !u.publishedIn);
  const targets = useMemo(() => {
    const m = new Map<string, KnowledgeUpload[]>();
    for (const u of open) {
      const r = routeOf(u, packIds);
      if (r) m.set(r.pack, [...(m.get(r.pack) ?? []), u]);
    }
    for (const p of Object.keys(session?.kixItems ?? {})) if (!m.has(p) && session?.kixItems[p]?.length) m.set(p, []);
    return [...m.entries()];
  }, [open, packIds, session]);

  const replace = (u: KnowledgeUpload) => setData((d) => (d ? { ...d, uploads: d.uploads.map((x) => (x.id === u.id ? u : x)) } : d));
  const replaceSession = (s: KnowledgeSession) => setData((d) => (d ? { ...d, sessions: d.sessions.some((x) => x.id === s.id) ? d.sessions.map((x) => (x.id === s.id ? s : x)) : [s, ...d.sessions] } : d));

  const patch = async (body: Record<string, unknown>) => {
    const r = await call<{ upload: KnowledgeUpload }>("PATCH", "/api/admin/knowledge", body);
    if (r.ok && r.data) replace(r.data.upload);
    else setMessage({ ok: false, text: failWords(r, "That change didn't save.") });
    return r.ok;
  };
  const review = (u: KnowledgeUpload, next: Review) => {
    replace({ ...u, review: next });
    void patch({ op: "review", id: u.id, review: next });
  };

  const readFiles = async (files: File[]) => {
    setBusy("upload");
    setMessage(null);
    const list: Job[] = files.map((f) => ({ name: f.name, size: f.size, state: f.size > MAX_BYTES ? "failed" : "waiting", note: f.size > MAX_BYTES ? `${mb(f.size)} is over the 4 MB limit` : undefined }));
    setJobs(list);
    let sid = activeId;
    for (let i = 0; i < files.length; i++) {
      if (list[i].state === "failed") continue;
      list[i] = { ...list[i], state: "reading" };
      setJobs([...list]);
      const form = new FormData();
      form.set("file", files[i]);
      form.set("rights", rights);
      if (sid) form.set("sessionId", sid);
      const r = await call<{ upload: KnowledgeUpload; session: KnowledgeSession | null }>("POST", "/api/admin/knowledge", form);
      const u = r.data?.upload;
      if (r.data?.session) {
        sid = r.data.session.id;
        replaceSession(r.data.session);
        setSessionId(sid);
      }
      list[i] = u?.status === "ready" ? { ...list[i], state: "done", note: `${DOC_LABEL[docKind(u)]}${u.pack ? ` → ${u.pack}` : ""}` } : { ...list[i], state: "failed", note: u?.error ?? failWords(r, "couldn't read it") };
      setJobs([...list]);
      if (u) setData((d) => (d ? { ...d, uploads: [u, ...d.uploads.filter((x) => x.id !== u.id)] } : d));
    }
    setBusy(null);
    setReload((v) => v + 1);
  };

  const newSession = async () => {
    const r = await call<{ session: KnowledgeSession }>("POST", "/api/admin/knowledge/sessions", {});
    if (r.ok && r.data) {
      replaceSession(r.data.session);
      setSessionId(r.data.session.id);
      setPicked(null);
      setJobs([]);
    } else setMessage({ ok: false, text: failWords(r, "Couldn't start a session.") });
  };

  const recheck = async (id: string) => {
    setBusy(`check:${id}`);
    const r = await call<{ uploads: KnowledgeUpload[] }>("POST", "/api/admin/knowledge/check", { id });
    setBusy(null);
    if (r.ok && r.data) r.data.uploads.forEach(replace);
    else setMessage({ ok: false, text: failWords(r, "Muse couldn't check it this time.") });
  };

  const saveKix = async (pack: string, items: KixItem[]) => {
    if (!session) return;
    replaceSession({ ...session, kixItems: { ...session.kixItems, [pack]: items } });
    const r = await call<{ session: KnowledgeSession }>("PATCH", "/api/admin/knowledge/sessions", { id: session.id, pack, kixItems: items });
    if (!r.ok) setMessage({ ok: false, text: failWords(r, "That change didn't save.") });
  };
  const writeKix = async (pack: string) => {
    if (!session) return;
    setBusy(`kix:${pack}`);
    setMessage(null);
    const r = await call<{ session: KnowledgeSession }>("POST", "/api/admin/knowledge/questions", { sessionId: session.id, pack, n: 4 });
    setBusy(null);
    if (r.ok && r.data) replaceSession(r.data.session);
    else setMessage({ ok: false, text: failWords(r, "Kix couldn't write questions this time.") });
  };

  const publish = async (pack: string, draft: boolean) => {
    setBusy(`${draft ? "draft" : "publish"}:${pack}`);
    setMessage(null);
    const r = await call<{ update: { pack: string; version: string; status: string }; warnings: string[] }>("POST", "/api/admin/knowledge/publish", { pack, sessionId: activeId, draft });
    setBusy(null);
    if (!r.ok || !r.data) {
      setMessage({ ok: false, text: [failWords(r, "Publishing was refused."), ...r.blockers, ...r.problems.map((p) => `${p.path}${p.line ? `:${p.line}` : ""} ${p.message}`)].join(" ") });
      return;
    }
    setMessage({ ok: true, pack, text: draft ? `Saved as draft v${r.data.update.version} of ${pack}. Review it in the editor, then publish.` : `${pack} v${r.data.update.version} is published. Kix reads it from the next request; the old version can be restored.` });
    setReload((v) => v + 1);
  };

  // ── The papers column ────────────────────────────────────────────────────
  const paperCard = (u: KnowledgeUpload) => {
    const kind = docKind(u);
    const partner = byId.get(pairs.get(u.id) ?? "");
    const p = effectivePaper(u);
    const route = routeOf(u, packIds);
    const e = u.extraction;
    const candidates = mine.filter((x) => x.id !== u.id && x.status === "ready" && (kind === "answer-sheet" ? docKind(x) === "question-paper" : docKind(x) === "answer-sheet"));
    const setOverride = (o: PaperOverrides) => void patch({ op: "override", id: u.id, overrides: o });
    return (
      <div key={u.id} className="ks-filewrap" data-on={selected?.id === u.id}>
        <button type="button" className="ks-file" aria-current={selected?.id === u.id} onClick={() => (setPicked(u.id), setEditing(null))} style={selected?.id === u.id ? { boxShadow: "none" } : undefined}>
          <b>{titleOf(u)}</b>
          <small>
            {u.status === "failed"
              ? `Couldn't read it: ${u.error ?? "unknown"}`
              : [RIGHTS_SHORT[u.rights], e ? `${e.paper.pages} pages` : null, kind !== "answer-sheet" && e ? `${e.paper.questionCount} questions` : null, `added ${hhmm(u.createdAt)}`, u.publishedIn ? `published in v${u.publishedIn}` : null].filter(Boolean).join(" · ")}
          </small>
        </button>
        {u.status === "ready" && (kind === "question-paper" || kind === "answer-sheet") && (
          <>
            <span className={`ks-pair${partner ? "" : " is-none"}`}>
              {partner && <Sparkle />}
              {partner ? `${kind === "answer-sheet" ? "Answers" : "Paired with"}: ${titleOf(partner)} (added ${hhmm(partner.createdAt)})${u.state.pairWith ? ", by you" : ""}` : kind === "answer-sheet" ? "Not paired yet: pick its question paper" : "No answer sheet yet"}
            </span>
            {candidates.length > 0 && !u.publishedIn && (
              <label>
                <span className="ap-sr">Pairing</span>
                <select className="ks-pairsel" value={u.state.pairWith === undefined ? "auto" : u.state.pairWith === null ? "none" : u.state.pairWith} onChange={(ev) => void patch({ op: "pair", id: u.id, with: ev.target.value })}>
                  <option value="auto">Pair automatically</option>
                  <option value="none">Not paired</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      Pair with {titleOf(c)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {u.status === "ready" && (
          <>
            <div className="ks-sel">
              <label className={p.changed.level ? "is-over" : ""}>
                Level{p.changed.level ? " (changed by you)" : ""}
                <select value={p.level} disabled={Boolean(u.publishedIn)} onChange={(ev) => setOverride({ ...u.state.overrides, level: ev.target.value as PaperOverrides["level"] })}>
                  {p.level === "unknown" && <option value="unknown">Unknown</option>}
                  {LEVELS.filter((l) => l !== "unknown").map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className={p.changed.subject ? "is-over" : ""}>
                Subject{p.changed.subject ? " (changed by you)" : ""}
                <select value={p.subject} disabled={Boolean(u.publishedIn)} onChange={(ev) => setOverride({ ...u.state.overrides, subject: ev.target.value as PaperOverrides["subject"] })}>
                  {p.subject === "other" && <option value="other">Other</option>}
                  {SUBJECTS.filter((s) => s !== "other").map((s) => (
                    <option key={s} value={s}>
                      {SUBJECT_NAME[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={p.changed.tier ? "is-over" : ""}>
                Tier{p.changed.tier ? " (changed by you)" : ""}
                <select value={p.tier ?? ""} disabled={Boolean(u.publishedIn)} onChange={(ev) => setOverride({ ...u.state.overrides, tier: (ev.target.value || null) as PaperOverrides["tier"] })}>
                  <option value="">None</option>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <span className="ks-route">{route ? `${route.isNew ? "New pack: " : "Refines "}${route.pack}${p.changed.level || p.changed.subject ? " (re-sorted by you)" : " (sorted by Muse)"}` : "No pack yet: set the level and subject"}</span>
          </>
        )}
      </div>
    );
  };

  // ── What Muse found ──────────────────────────────────────────────────────
  const entrySection = (u: KnowledgeUpload, kind: Kind, title: string) => {
    const list = entriesOf(u)[kind] as unknown as Record<string, unknown>[];
    if (kind === "items" && u.rights === "school-private") return null;
    if (!list.length && kind === "items") return null;
    const pre = PREFIX[kind];
    const save = async (next: Record<string, unknown>[], approveIndex?: number) => {
      setBusy("edit");
      const ok = await patch({ op: "edit", id: u.id, kind, entries: next });
      if (ok && approveIndex !== undefined) {
        const r = { ...u.review, [`${pre}:${approveIndex}`]: "approved" as const };
        await patch({ op: "review", id: u.id, review: r });
      }
      setBusy(null);
      setEditing(null);
    };
    const normalise = (v: Record<string, unknown>) => (kind === "items" ? { ...v, options: cleanLines(v.options, true) } : v);
    return (
      <section className="ks-sec" aria-label={title}>
        <div className="ks-sechead">
          <h4 className="kn-h4" style={{ margin: 0 }}>
            {title} ({list.length})
          </h4>
          {!u.publishedIn && (
            <button type="button" className="sk-btn sk-btn--sm" onClick={() => setEditing(`${u.id}:${kind}:new`)}>
              Add
            </button>
          )}
        </div>
        <ul className="ks-entries">
          {list.map((x, i) => {
            const key = `${pre}:${i}`;
            const mark = u.review[key];
            const id = `${u.id}:${kind}:${i}`;
            const check = kind === "items" ? checkOf(u, `i:${i}`) : null;
            const resolved = kind === "items" ? u.state.resolved?.[`i:${i}`] : undefined;
            return (
              <li key={i} className="ks-entry" data-mark={mark}>
                {editing === id ? (
                  <EntryEditor fields={FIELDS[kind]} value={x} saving={busy === "edit"} onCancel={() => setEditing(null)} onSave={(v) => void save(list.map((y, n) => (n === i ? normalise(v) : y)))} />
                ) : (
                  <>
                    <div>
                      {kind === "archetypes" && (
                        <>
                          <p className="kn-main">{String(x.pattern)}</p>
                          <p className="kn-muted">
                            {String(x.topic)} · {String(x.format)} · {String(x.marks)} marks · ×{String(x.count)} · difficulty {String(x.difficulty)}
                          </p>
                        </>
                      )}
                      {(kind === "traps" || kind === "markingCues") && (
                        <p className="kn-main">
                          <span className="kn-muted">{String(x.topic)}: </span>
                          {String(kind === "traps" ? x.trap : x.cue)}
                        </p>
                      )}
                      {kind === "items" && (
                        <>
                          <p className="kn-main">{String(x.stem)}</p>
                          {Array.isArray(x.options) && <p className="kn-muted">{(x.options as string[]).map((o, n) => `(${n + 1}) ${o}`).join("  ")}</p>}
                          <p className="kn-muted">
                            {String(x.topic)} · {String(x.type)} · {String(x.marks)} marks · answer: {String(x.answer)}
                          </p>
                          <p className="kn-muted" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                            <CheckCell check={check} keyAnswer={String(x.answer)} resolved={resolved} />
                          </p>
                        </>
                      )}
                    </div>
                    {!u.publishedIn && (
                      <span className="ks-entry-acts">
                        {kind === "items" && check?.status === "mismatch" && !resolved && (
                          <>
                            <button type="button" className="sk-btn sk-btn--sm" onClick={() => void patch({ op: "resolve", id: u.id, key: `i:${i}`, how: "key-right" })}>
                              Answer is right
                            </button>
                            {check.museAnswer && (
                              <button type="button" className="sk-btn sk-btn--sm" onClick={() => void patch({ op: "resolve", id: u.id, key: `i:${i}`, how: "use-muse" })}>
                                Use Muse&apos;s
                              </button>
                            )}
                          </>
                        )}
                        <button type="button" className="sk-btn sk-btn--sm" onClick={() => setEditing(id)}>
                          Edit
                        </button>
                        <Toggle label={`Entry ${i + 1}`} mark={mark} onMark={(m) => review(u, { ...u.review, [key]: m })} />
                      </span>
                    )}
                  </>
                )}
              </li>
            );
          })}
          {editing === `${u.id}:${kind}:new` && (
            <li className="ks-entry">
              <EntryEditor fields={FIELDS[kind]} value={BLANK[kind]} saving={busy === "edit"} onCancel={() => setEditing(null)} onSave={(v) => void save([...list, normalise(v)], list.length)} />
            </li>
          )}
        </ul>
      </section>
    );
  };

  const questionTable = (paper: KnowledgeUpload, sheet: KnowledgeUpload | null) => {
    const rows = keyedQuestions(paper, sheet);
    if (!rows.length) return null;
    const editKey = async (no: string, value: string) => {
      setBusy("edit");
      const questions = entriesOf(paper).questions.map((q) => (normNo(q.no) === normNo(no) ? { ...q, keyAnswer: value.trim() || null } : q));
      await patch({ op: "edit", id: paper.id, kind: "questions", entries: questions });
      setBusy(null);
      setEditing(null);
    };
    return (
      <div className="ks-scroll">
        <table className="ks-table">
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: "34%" }} />
            <col style={{ width: "20%" }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>Q</th>
              <th>Pattern</th>
              <th>Answer {sheet ? "(from the sheet)" : docKind(paper) === "both" ? "(from the paper)" : ""}</th>
              <th>Muse&apos;s check</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const check = checkOf(paper, q.key);
              const resolved = paper.state.resolved?.[q.key];
              const flag = check?.status === "mismatch" && !resolved;
              const warn = !resolved && (check ? check.status !== "ok" && check.status !== "mismatch" : !q.keyAnswer);
              const id = `${paper.id}:key:${q.key}`;
              return (
                <tr key={q.key} className={flag ? "is-flag" : warn ? "is-warn" : ""}>
                  <td className="ks-q">{q.no.toUpperCase().startsWith("Q") ? q.no : `Q${q.no}`}</td>
                  <td>
                    {q.pattern}
                    {q.marks ? ` (${q.marks} ${q.marks === 1 ? "mark" : "marks"})` : ""}
                  </td>
                  <td>
                    {editing === id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void editKey(q.no, String(new FormData(e.currentTarget).get("key") ?? ""));
                        }}
                        style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                      >
                        <label className="sk-f" style={{ flex: "1 1 100px" }}>
                          <span>Key</span>
                          <input name="key" className="sk-in" defaultValue={q.keyAnswer ?? ""} maxLength={200} autoFocus />
                        </label>
                        <button type="submit" className="sk-btn sk-btn--sm sk-btn--pri">
                          Save
                        </button>
                      </form>
                    ) : (
                      <>
                        {q.keyAnswer ?? <span className="kn-muted">no answer yet</span>}
                        {q.keyFrom === "you" && <small>changed by you</small>}
                      </>
                    )}
                  </td>
                  <td>
                    <CheckCell check={check} keyAnswer={q.keyAnswer} resolved={resolved} />
                    {!paper.publishedIn && (
                      <span className="ks-acts">
                        {flag && (
                          <>
                            <button type="button" className="sk-btn sk-btn--sm" onClick={() => void patch({ op: "resolve", id: paper.id, key: q.key, how: "key-right" })}>
                              Key is right
                            </button>
                            {check?.museAnswer && (
                              <button type="button" className="sk-btn sk-btn--sm" onClick={() => void patch({ op: "resolve", id: paper.id, key: q.key, how: "use-muse" })}>
                                Use Muse&apos;s
                              </button>
                            )}
                          </>
                        )}
                        {check?.status === "spelling" && check.fix && !resolved && (
                          <button type="button" className="sk-btn sk-btn--sm" onClick={() => void patch({ op: "resolve", id: paper.id, key: q.key, how: "use-fix" })}>
                            Use the fix
                          </button>
                        )}
                        {resolved && (
                          <button type="button" className="sk-btn sk-btn--sm" onClick={() => void patch({ op: "resolve", id: paper.id, key: q.key, how: null })}>
                            Undo
                          </button>
                        )}
                        <button type="button" className="sk-btn sk-btn--sm" onClick={() => setEditing(editing === id ? null : id)}>
                          Edit
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const found = (u: KnowledgeUpload) => {
    const e = u.extraction;
    if (!e) return <p className="kn-note">Muse couldn&apos;t read {u.fileName}: {u.error ?? "unknown"}</p>;
    const kind = docKind(u);
    const partner = byId.get(pairs.get(u.id) ?? "") ?? null;
    const paper = kind === "answer-sheet" ? partner : u;
    const sheet = kind === "answer-sheet" ? u : kind === "question-paper" ? partner : null;
    const checks = paper?.state.checks ?? [];
    const mism = checks.filter((c) => c.status === "mismatch" && !paper?.state.resolved?.[c.key]).length;
    const toCheck = paper ? keyedQuestions(paper, sheet).filter((q) => !paper.state.resolved?.[q.key] && (checkOf(paper, q.key) ? !["ok", "mismatch"].includes(checkOf(paper, q.key)!.status) : true)).length : 0;
    const approveRest = () => {
      const all: Review = { ...u.review };
      const en = entriesOf(u);
      en.archetypes.forEach((_, i) => (all[`a:${i}`] ??= "approved"));
      en.traps.forEach((_, i) => (all[`t:${i}`] ??= "approved"));
      en.markingCues.forEach((_, i) => (all[`c:${i}`] ??= "approved"));
      en.items.forEach((_, i) => (all[`i:${i}`] ??= "approved"));
      review(u, all);
    };
    return (
      <>
        <div className="ks-head">
          <h2 className="sk-h2" style={{ flex: "1 1 260px" }}>
            What Muse found: {titleOf(u)}
          </h2>
          <span className="sk-badges" style={{ marginTop: 0 }}>
            {mism > 0 && <span className="sk-chip sk-flag">{mism} mismatch</span>}
            {toCheck > 0 && <span className="sk-chip sk-warn">{toCheck} to check</span>}
            <span className="sk-chip sk-plain">{e.confidence} confidence</span>
          </span>
        </div>
        {e.notes && <p className="kn-note">{e.notes}</p>}
        {u.rights === "school-private" && <p className="ks-rule">A school paper teaches Kix its patterns, traps and marking. Its questions are never kept or shown to children; Kix writes its own new questions from them.</p>}
        {kind === "answer-sheet" && !partner && (
          <>
            <p className="kn-note">This answer sheet isn&apos;t paired yet. Add or pick its question paper and Muse checks every answer.</p>
            {entriesOf(u).questions.length > 0 && (
              <p className="kn-muted">
                {entriesOf(u).questions.length} answers read: {entriesOf(u).questions.slice(0, 12).map((q) => `${q.no} ${q.keyAnswer ?? "?"}`).join(" · ")}
                {entriesOf(u).questions.length > 12 ? " …" : ""}
              </p>
            )}
          </>
        )}
        {paper && (
          <section className="ks-sec" aria-label="Answers and Muse's check">
            <div className="ks-sechead">
              <h4 className="kn-h4" style={{ margin: 0 }}>
                Questions and answers{kind === "answer-sheet" ? `, checked against ${titleOf(paper)}` : ""}
              </h4>
              {!paper.publishedIn && keyedQuestions(paper, sheet).some((q) => q.keyAnswer) && (
                <button type="button" className="sk-btn sk-btn--sm sk-btn--muse" disabled={Boolean(busy)} onClick={() => void recheck(paper.id)}>
                  {busy === `check:${paper.id}` ? <span className="sk-spin" aria-hidden="true" /> : <Sparkle />}
                  {busy === `check:${paper.id}` ? "Muse is checking…" : paper.state.checkedAt ? "Check again" : "Check the answers"}
                </button>
              )}
            </div>
            {questionTable(paper, sheet) ?? <p className="kn-muted">Muse didn&apos;t list the questions by number for this one.</p>}
          </section>
        )}
        {!u.publishedIn && (
          <div className="sk-row" style={{ marginTop: 0 }}>
            <button type="button" className="sk-btn sk-btn--sm" onClick={approveRest}>
              Approve the rest
            </button>
            <span className="kn-muted" style={{ alignSelf: "center" }}>
              Remove what&apos;s wrong, edit what&apos;s close, add what Muse missed.
            </span>
          </div>
        )}
        {entrySection(u, "archetypes", "Question patterns")}
        {entrySection(u, "traps", "Traps")}
        {entrySection(u, "markingCues", "Marking cues")}
        {entrySection(u, "items", "Questions (only approved ones reach children)")}
      </>
    );
  };

  const kixPanel = (pack: string) => {
    const items = session?.kixItems[pack] ?? [];
    const set = (i: number, patchItem: Partial<KixItem>) => void saveKix(pack, items.map((k, n) => (n === i ? { ...k, ...patchItem } : k)));
    return (
      <section className="ks-sec" aria-label="Kix's own questions">
        <div className="ks-sechead">
          <span className="sk-h2">
            <Sparkle /> Kix&apos;s own questions from these patterns ({items.length})
          </span>
          {session && (
            <button type="button" className="sk-btn sk-btn--sm sk-btn--muse" disabled={Boolean(busy)} onClick={() => void writeKix(pack)}>
              {busy === `kix:${pack}` ? <span className="sk-spin" aria-hidden="true" /> : <Sparkle />}
              {busy === `kix:${pack}` ? "Kix is writing…" : items.length ? "Write 4 more" : "Write 4 questions"}
            </button>
          )}
        </div>
        {busy === `kix:${pack}` && <p className="kn-muted">Kix writes fresh questions from the approved patterns (never a paper&apos;s wording), then Muse works each one out again. About a minute.</p>}
        {!items.length && busy !== `kix:${pack}` && <p className="kn-muted">Approve some patterns, then let Kix write practice questions from them: new wording and numbers, checked by Muse.</p>}
        <ul className="ks-entries">
          {items.map((k, i) => {
            const id = `kix:${pack}:${i}`;
            const keyText = k.type === "mcq" && k.options ? `${k.answer}: ${k.options[Number(k.answer) - 1] ?? ""}` : k.answer;
            return (
              <li key={i} className="ks-entry" data-mark={k.mark}>
                {editing === id ? (
                  <EntryEditor
                    fields={KIX_FIELDS}
                    value={k as unknown as Record<string, unknown>}
                    onCancel={() => setEditing(null)}
                    onSave={(v) => {
                      setEditing(null);
                      set(i, { stem: String(v.stem), answer: String(v.answer), marks: Number(v.marks) || 1, options: k.type === "mcq" ? cleanLines(v.options, true) : null, check: undefined, resolved: undefined });
                    }}
                  />
                ) : (
                  <>
                    <div>
                      <p className="kn-main">
                        <b>N{i + 1}</b> {k.stem}
                      </p>
                      {k.options && <p className="kn-muted">{k.options.map((o, n) => `(${n + 1}) ${o}`).join("  ")}</p>}
                      <p className="kn-muted">
                        {k.topic} · {k.marks} {k.marks === 1 ? "mark" : "marks"} · answer: {keyText}
                      </p>
                      <p className="kn-muted" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                        {k.check?.status === "ok" && !k.resolved ? <span className="sk-chip sk-ok">Worked twice</span> : <CheckCell check={k.check ?? null} keyAnswer={keyText} resolved={k.resolved} />}
                      </p>
                    </div>
                    <span className="ks-entry-acts">
                      {k.check?.status === "mismatch" && !k.resolved && (
                        <button type="button" className="sk-btn sk-btn--sm" onClick={() => set(i, { resolved: "key-right" })}>
                          Answer is right
                        </button>
                      )}
                      <button type="button" className="sk-btn sk-btn--sm" onClick={() => setEditing(id)}>
                        Edit
                      </button>
                      <Toggle label={`Kix's question N${i + 1}`} mark={k.mark} onMark={(m) => set(i, { mark: m })} />
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  const summary = ([pack, ups]: [string, KnowledgeUpload[]]) => {
    const base = data?.packs.find((p) => p.id === pack);
    const kix = session?.kixItems[pack] ?? [];
    const counts = refineCounts(ups, kix, base?.topics ?? []);
    const blockers = publishBlockers(ups, kix);
    const nothing = blockers.length === 1 && blockers[0].startsWith("Approve");
    return (
      <section key={pack} className="sk-card ks-sum" aria-label={`Refines ${pack}`}>
        <span className="sk-h2">This refines {base?.title ?? `${pack} (a new pack)`}</span>
        <p className="sk-sub">Publishing makes a new version of the skill; the old one can be restored.</p>
        <ul>
          <li>
            <span className="sk-chip sk-muse">+{counts.archetypes}</span>question patterns, with marks
          </li>
          <li>
            <span className="sk-chip sk-muse">+{counts.traps}</span>traps
          </li>
          <li>
            <span className="sk-chip sk-muse">+{counts.cues}</span>marking cues
          </li>
          {counts.items > 0 && (
            <li>
              <span className="sk-chip sk-muse">+{counts.items}</span>questions from our own or licensed material
            </li>
          )}
          <li>
            <span className="sk-chip sk-muse">+{counts.kix}</span>new questions by Kix, answers checked
          </li>
          {counts.topics > 0 && (
            <li>
              <span className="sk-chip sk-muse">+{counts.topics}</span>
              {counts.topics === 1 ? "topic" : "topics"} new to the pack&apos;s scope
            </li>
          )}
        </ul>
        {blockers.length && !nothing ? (
          <div className="ks-rule" role="status">
            Resolve these before publishing:
            <ul>
              {blockers.slice(0, 6).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ) : nothing ? (
          <p className="ks-rule">{blockers[0]}</p>
        ) : (
          <p className="ks-rule is-ok">Ready: every key either checks out or has been settled by you.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          <button type="button" className="sk-btn" disabled={Boolean(busy) || blockers.length > 0} onClick={() => void publish(pack, true)}>
            {busy === `draft:${pack}` && <span className="sk-spin" aria-hidden="true" />}
            Save as a draft version
          </button>
          <button type="button" className="sk-btn sk-btn--pri" disabled={Boolean(busy) || blockers.length > 0} onClick={() => void publish(pack, false)}>
            {busy === `publish:${pack}` && <span className="sk-spin" aria-hidden="true" />}
            Publish to {base?.title ?? pack}
          </button>
        </div>
      </section>
    );
  };

  const selectedPack = selected ? routeOf(selected, packIds)?.pack : null;

  return (
    <>
      <header className="ks-head">
        <div>
          <h1 className="ad-h1">{session ? `Review session: ${session.title.replace(/^Review session,\s*/, "")}` : activeId === null && legacyCount ? "Earlier uploads" : "Add knowledge"}</h1>
          <p className="ad-lede">Add papers in any order: a question paper now, its answer sheet later. Muse pairs them, sorts them by subject and level, and checks every answer. You can change anything; publishing makes the pack&apos;s next version.</p>
        </div>
        <div className="ks-bar">
          {(sessions.length > 0 || legacyCount > 0) && (
            <label>
              <span className="ap-sr">Review session</span>
              <select className="ks-pick" value={activeId ?? "legacy"} onChange={(e) => (setSessionId(e.target.value === "legacy" ? null : e.target.value), setPicked(null), setJobs([]))}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
                {legacyCount > 0 && <option value="legacy">Earlier uploads ({legacyCount})</option>}
              </select>
            </label>
          )}
          {data?.sessionsReady && (
            <button type="button" className="sk-btn" onClick={() => void newSession()}>
              New session
            </button>
          )}
          <label>
            <span className="ap-sr">Where the PDFs are from</span>
            <select className="ks-pick" value={rights} onChange={(e) => setRights(e.target.value as Rights)}>
              {RIGHTS.map((r) => (
                <option key={r} value={r}>
                  {RIGHTS_SHORT[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="sk-btn sk-btn--pri" disabled={busy === "upload" || denied} onClick={() => input.current?.click()}>
            {busy === "upload" && <span className="sk-spin" aria-hidden="true" />}
            Add PDFs
          </button>
          <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => e.target.files?.length && void readFiles([...e.target.files])} />
        </div>
      </header>

      {denied ? (
        <p className="kn-note">Admins only. Sign in as an admin (and unlock with the parent PIN if a kid is on this device).</p>
      ) : !data ? (
        <p className="ad-lede">Loading…</p>
      ) : (
        <>
          {message && (
            <p className={`sk-note${message.ok ? " is-ok" : ""}`} role={message.ok ? "status" : "alert"}>
              {message.text}{" "}
              {message.pack && (
                <Link href={`/admin/skills/${message.pack}`} style={{ color: "inherit" }}>
                  Open {message.pack} in the editor
                </Link>
              )}
            </p>
          )}
          {!data.sessionsReady && <p className="kn-note">Review sessions need supabase/migrations/20261030_skill_versions.sql in the database. Until it&apos;s run, uploads work as before, without pairing or edits.</p>}
          {jobs.length > 0 && (
            <ul className="kn-jobs sk-card" aria-live="polite" style={{ padding: 12 }}>
              {jobs.map((j, i) => (
                <li key={i} data-state={j.state}>
                  <span className="kn-main">{j.name}</span>
                  <span className="kn-muted">{mb(j.size)}</span>
                  <span className="kn-state">{j.state === "reading" ? "Muse is reading it…" : j.state === "waiting" ? "Waiting" : j.state === "done" ? `Ready: ${j.note ?? ""}` : `Failed: ${j.note ?? ""}`}</span>
                </li>
              ))}
            </ul>
          )}
          {!mine.length ? (
            <div
              className="sk-card kn-drop ks-empty"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const files = [...e.dataTransfer.files].filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
                if (files.length && !busy) void readFiles(files);
              }}
            >
              <p className="kn-main">Drop PDFs here, or use Add PDFs. Up to 4 MB and about 20 pages each; read once and never kept.</p>
              <p className="kn-muted">{RIGHTS_LABEL[rights]}</p>
            </div>
          ) : (
            <div className="ks-grid">
              <div className="sk-card ks-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), !busy && void readFiles([...e.dataTransfer.files].filter((f) => f.name.toLowerCase().endsWith(".pdf"))))}>
                <span className="sk-h2">Papers in this session</span>
                {mine.map(paperCard)}
                <p className="ks-rule">A school paper teaches Kix its patterns, traps and marking. Its questions are never kept or shown to children; Kix writes its own new questions from them.</p>
              </div>
              <div className="sk-card ks-col">
                {selected ? found(selected) : <p className="kn-muted">Pick a paper.</p>}
                {selectedPack && selected?.status === "ready" && kixPanel(selectedPack)}
              </div>
              <div className="ks-col">
                {targets.length ? targets.map(summary) : <p className="sk-card kn-muted">Nothing to publish yet.</p>}
                {(session?.published.length ?? 0) > 0 && (
                  <section className="sk-card ks-sum" aria-label="Made by this session">
                    <span className="sk-h2">Made by this session</span>
                    <ul>
                      {session!.published.map((p, i) => (
                        <li key={i}>
                          <span className={`sk-chip ${p.status === "published" ? "sk-pub" : "sk-draft"}`}>{p.status === "published" ? "Published" : "Draft"}</span>
                          <Link href={`/admin/skills/${p.pack}`}>
                            {p.pack} v{p.version}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          )}

          <PaperFinds onRead={() => setReload((v) => v + 1)} sessionId={activeId} />

          {data.updates.length > 0 && (
            <section className="kn-card" aria-label="Published">
              <h2 className="kn-h2">Published knowledge</h2>
              <ul className="kn-list">
                {[...data.updates].reverse().map((u) => (
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
    </>
  );
}

