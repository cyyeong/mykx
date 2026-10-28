"use client";

// Admin → Skills → one pack (board SkillEditor; founder, 29 Oct). The pack's files in a text editor, Save draft and
// Publish, its versions (diff, restore, delete; the built-in default shows a lock and can't be deleted), Enhance with
// Muse (a proposal shown as a diff, accepted into the draft) and Import. Every save is checked on the server (the
// pack schemas and the safety scanner) and here as you type (JSON, the manifest and item schemas). Kix, Ask Kix, the
// Vibe Zone and printable papers read the published version, else the default.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EnhanceProposal } from "@/lib/skills/enhance";
import { SkillItemSchema, SkillManifestSchema } from "@/lib/skills/schema";
import type { SkillVersionMeta } from "@/lib/skills/versions";
import { AdminFrame } from "../AdminFrame";
import { call, failWords, LOCK, SPARKLE, type CallResult, type Problem } from "./call";
import { DiffView, type DiffPair } from "./DiffView";
import { ImportDialog } from "./ImportDialog";
import "./skills.css";

type PackData = { pack: string; hasDefault: boolean; defaultVersion: string | null; published: string | null; draft: string | null; versions: SkillVersionMeta[]; selected: string; files: Record<string, string> };
type Files = Record<string, string>;

const SOURCE: Record<string, string> = { edit: "Edited", enhance: "Enhance with Muse", import: "Imported", knowledge: "Knowledge", restore: "Restored" };
const when = (iso: string) => new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
const short = (v: string) => v.replace(/\.0$/, "");

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sk-sparkle">
      <path d={SPARKLE} />
    </svg>
  );
}
function Lock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d={LOCK} />
    </svg>
  );
}

/** What's wrong with one file, as the admin types (the server checks the whole pack again on save). */
function fileErrors(path: string, text: string, packId: string): string[] {
  const out: string[] = [];
  if (path === "SKILL.md") {
    if (!/^---\n[\s\S]*?^name:\s*\S[\s\S]*?\n---/m.test(text) || !/^description:\s*\S/m.test(text.split("\n---")[0] ?? "")) out.push("Needs front matter with name and description (--- name: … description: … ---).");
    return out;
  }
  if (!path.endsWith(".json")) return out;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return [`Not valid JSON: ${(e as Error).message}`];
  }
  if (path === "skill.json") {
    const r = SkillManifestSchema.safeParse(raw);
    if (!r.success) for (const i of r.error.issues.slice(0, 8)) out.push(`${i.path.join(".") || "manifest"}: ${i.message}`);
    else if (r.data.id !== packId) out.push(`id is "${r.data.id}"; this pack is "${packId}".`);
    return out;
  }
  if (!Array.isArray(raw)) return ["Must be a list of items."];
  raw.forEach((it, n) => {
    const r = SkillItemSchema.safeParse(it);
    if (!r.success && out.length < 8) out.push(`${(it as { id?: string })?.id ?? `item ${n + 1}`}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
  });
  return out;
}

const fetchPack = (packId: string, v?: string) => call<PackData>("GET", `/api/admin/skills/${packId}${v ? `?v=${encodeURIComponent(v)}` : ""}`);

const draftsIn = (text: string): string[] => {
  try {
    const list = JSON.parse(text) as { id?: string; status?: string }[];
    return Array.isArray(list) ? list.filter((i) => i?.status === "draft" && i.id).map((i) => i.id!) : [];
  } catch {
    return [];
  }
};

export function SkillEditor({ packId }: { packId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PackData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buf, setBuf] = useState<Files>({});
  const [current, setCurrent] = useState("SKILL.md");
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [diff, setDiff] = useState<{ title: string; pairs: DiffPair[] } | null>(null);
  const [ask, setAsk] = useState("");
  const [proposal, setProposal] = useState<EnhanceProposal | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [newRef, setNewRef] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const askRef = useRef<HTMLTextAreaElement>(null);

  const apply = useCallback((r: CallResult<PackData>) => {
    if (!r.ok || !r.data) {
      setLoadError(r.status === 404 ? "No such pack." : failWords(r, "Couldn't load the pack."));
      return;
    }
    const d = r.data;
    setData(d);
    setBuf(d.files);
    setReviewIds([]);
    setCurrent((c) => (d.files[c] !== undefined ? c : d.files["SKILL.md"] !== undefined ? "SKILL.md" : (Object.keys(d.files)[0] ?? "SKILL.md")));
  }, []);
  const load = useCallback(async (v?: string) => apply(await fetchPack(packId, v)), [packId, apply]);
  useEffect(() => {
    let live = true;
    void fetchPack(packId).then((r) => {
      if (live) apply(r);
    });
    return () => {
      live = false;
    };
  }, [packId, apply]);

  const base = useMemo(() => data?.files ?? {}, [data]);
  const changes = useMemo(() => {
    const c: Record<string, string | null> = {};
    for (const [p, t] of Object.entries(buf)) if (base[p] !== t) c[p] = t;
    for (const p of Object.keys(base)) if (buf[p] === undefined) c[p] = null;
    return c;
  }, [buf, base]);
  const dirty = Object.keys(changes).length > 0 || reviewIds.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const errors = useMemo(() => Object.fromEntries(Object.entries(buf).map(([p, t]) => [p, fileErrors(p, t, packId)])), [buf, packId]);
  const anyErrors = Object.values(errors).some((e) => e.length > 0);
  const manifest = useMemo(() => {
    try {
      return JSON.parse(buf["skill.json"] ?? "{}") as { title?: string; level?: string; subject?: string };
    } catch {
      return {};
    }
  }, [buf]);

  const rows = useMemo(() => data?.versions ?? [], [data]);
  const pubRow = rows.find((r) => r.id === data?.published) ?? null;
  const draftRow = rows.find((r) => r.id === data?.draft) ?? null;
  const nextVersion = useMemo(() => {
    if (draftRow) return draftRow.version;
    const all = [...rows.map((r) => r.version), ...(data?.defaultVersion ? [data.defaultVersion] : [])].map((v) => v.split(".").map(Number));
    if (!all.length) return "1.0.0";
    all.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [ma, mi] = all[all.length - 1];
    return `${ma}.${mi + 1}.0`;
  }, [rows, draftRow, data]);
  const selectedLabel = data?.selected === "default" ? `the default v${short(data.defaultVersion ?? "1.0.0")}` : `v${short(rows.find((r) => r.id === data?.selected)?.version ?? "")}`;
  const editingDraft = Boolean(data && data.selected === data.draft);

  const save = async (o: { source?: "edit" | "enhance"; note?: string | null; files?: Files } = {}): Promise<string | null> => {
    if (!data) return null;
    const files = o.files ?? buf;
    const ch: Record<string, string | null> = {};
    for (const [p, t] of Object.entries(files)) if (base[p] !== t) ch[p] = t;
    for (const p of Object.keys(base)) if (files[p] === undefined) ch[p] = null;
    setBusy("save");
    setProblems([]);
    setMessage(null);
    const r = await call<{ id: string; version: string }>("POST", `/api/admin/skills/${packId}`, { action: "save", base: data.selected, changes: ch, markReviewed: reviewIds, note: o.note ?? null, source: o.source ?? "edit" });
    setBusy(null);
    if (!r.ok || !r.data) {
      setProblems(r.problems);
      setMessage({ ok: false, text: failWords(r, "Couldn't save the draft.") });
      return null;
    }
    setMessage({ ok: true, text: `Saved as draft v${short(r.data.version)}. Kix still reads ${pubRow ? `v${short(pubRow.version)}` : "the default"} until you publish.` });
    await load(r.data.id);
    return r.data.id;
  };

  const publish = async () => {
    if (!data) return;
    let id = data.draft;
    if (dirty || !editingDraft) id = await save();
    if (!id) return;
    setBusy("publish");
    const r = await call<{ id: string; version: string }>("POST", `/api/admin/skills/${packId}`, { action: "publish", id });
    setBusy(null);
    if (!r.ok || !r.data) {
      setProblems(r.problems);
      setMessage({ ok: false, text: failWords(r, "Publishing was refused.") });
      return;
    }
    setMessage({ ok: true, text: `v${short(r.data.version)} is published. Kix, Ask Kix and printable papers read it from the next request.` });
    await load(r.data.id);
  };

  const act = async (action: "restore" | "delete" | "delete-pack", id: string) => {
    setBusy(action);
    setMessage(null);
    setProblems([]);
    const r = await call<{ id?: string; version?: string; deleted?: number }>("POST", `/api/admin/skills/${packId}`, action === "delete-pack" ? { action, confirm: typed } : { action, id });
    setBusy(null);
    setConfirm(null);
    if (!r.ok || !r.data) {
      setProblems(r.problems);
      setMessage({ ok: false, text: failWords(r, "That didn't work.") });
      return;
    }
    if (action === "delete-pack") {
      router.push("/admin/skills");
      return;
    }
    setMessage({ ok: true, text: action === "restore" ? `Restored as v${short(r.data.version ?? "")}, now published.` : "Deleted. Kix reads the newest published version left, or the default." });
    await load(action === "restore" ? r.data.id : undefined);
  };

  const showDiff = async (row: SkillVersionMeta | "default") => {
    const ref = row === "default" ? "default" : row.id;
    const [a, against] = await Promise.all([
      call<PackData>("GET", `/api/admin/skills/${packId}?v=${ref}`),
      // Compared with what Kix reads now; the published one is compared with the default (or itself if it is the default).
      call<PackData>("GET", `/api/admin/skills/${packId}?v=${row !== "default" && row.id === data?.published ? (data?.hasDefault ? "default" : ref) : (data?.published ?? "default")}`),
    ]);
    if (!a.data || !against.data) return;
    const before = against.data.files;
    const after = a.data.files;
    const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    const label = row === "default" ? `the default v${short(data?.defaultVersion ?? "")}` : `v${short(row.version)}`;
    const otherLabel = against.data.selected === "default" ? "the default" : `v${short(rows.find((r) => r.id === against.data!.selected)?.version ?? "")}`;
    setDiff({ title: `${label} compared with ${otherLabel}`, pairs: paths.map((p) => ({ path: p, before: before[p] ?? null, after: after[p] ?? null })) });
  };

  const enhance = async () => {
    if (!data || ask.trim().length < 8) return;
    setBusy("enhance");
    setProposal(null);
    setMessage(null);
    const r = await call<{ proposal: EnhanceProposal }>("POST", `/api/admin/skills/${packId}/enhance`, { ask: ask.trim(), base: data.selected, changes });
    setBusy(null);
    if (!r.ok || !r.data) {
      setMessage({ ok: false, text: failWords(r, "Muse couldn't propose changes this time.") });
      return;
    }
    setProposal(r.data.proposal);
    if (!r.data.proposal.changes.length) setMessage({ ok: false, text: "Muse didn't propose any change. Try saying more about what to improve." });
  };
  const accept = async () => {
    if (!proposal) return;
    const next = { ...buf };
    for (const c of proposal.changes) next[c.path] = c.after;
    setBuf(next);
    setDiff(null);
    const id = await save({ source: "enhance", note: ask.trim().slice(0, 140), files: next });
    if (id) setProposal(null);
  };

  const addReference = () => {
    const name = (newRef ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!name) return;
    const path = `references/${name}.md`;
    if (buf[path] === undefined) setBuf({ ...buf, [path]: `# ${newRef!.trim()}\n\n## First section\n\nWrite the method here. Agents read a reference section by section (each ## heading).\n` });
    setCurrent(path);
    setNewRef(null);
  };
  const removeFile = (path: string) => {
    const next = { ...buf };
    delete next[path];
    setBuf(next);
    setCurrent("SKILL.md");
  };

  if (loadError)
    return (
      <AdminFrame current="/admin/skills">
        <Link href="/admin/skills" className="sk-back">
          ← Skills
        </Link>
        <p className="sk-note">{loadError}</p>
      </AdminFrame>
    );

  const paths = Object.keys(buf).sort();
  const refs = paths.filter((p) => p.startsWith("references/"));
  const items = paths.filter((p) => p.startsWith("items/"));
  const fileTag = (p: string) => {
    if (errors[p]?.length) return <small className="is-bad">fix</small>;
    if (base[p] === undefined) return <small className="is-edit">new</small>;
    if (changes[p] !== undefined) return <small className="is-edit">edited</small>;
    if (p.startsWith("items/")) {
      try {
        const n = (JSON.parse(buf[p]) as unknown[]).length;
        const d = draftsIn(buf[p]).length;
        return <small>{d ? `${n} · ${d} draft` : n}</small>;
      } catch {
        return null;
      }
    }
    if (p === "skill.json") return <small>manifest</small>;
    if (p === "references/exam-patterns.md") return <small>from knowledge</small>;
    return null;
  };
  const fileButton = (p: string) => (
    <button key={p} type="button" className="sk-file" aria-current={p === current} onClick={() => (setCurrent(p), setDiff(null))}>
      <span>{p.replace(/^(references|items)\//, "")}</span>
      {fileTag(p)}
    </button>
  );
  const drafts = current.startsWith("items/") ? draftsIn(buf[current] ?? "").filter((id) => !reviewIds.includes(id)) : [];
  const flagged = proposal?.checks.filter((c) => c.status !== "ok") ?? [];
  const lines = (a: string | null, b: string) => {
    const x = (a ?? "").split("\n");
    const y = b.split("\n");
    const added = y.filter((l) => !x.includes(l)).length;
    return a === null ? "new" : `+${added}`;
  };

  return (
    <AdminFrame current="/admin/skills">
      <div>
        <Link href="/admin/skills" className="sk-back">
          ← Skills
        </Link>
      </div>
      {!data ? (
        <p className="sk-sub">Loading the pack…</p>
      ) : (
        <>
          <header className="sk-top">
            <div style={{ minWidth: 0 }}>
              <h1 className="sk-title">{manifest.title ?? packId}</h1>
              <p className="sk-sub">Kix Tutor, Ask Kix, the Vibe Zone and printable papers read the published version.</p>
              <div className="sk-badges">
                <span className="sk-chip sk-pub">Published {pubRow ? `v${short(pubRow.version)}` : data.hasDefault ? `v${short(data.defaultVersion ?? "1.0.0")} (default)` : "none yet"}</span>
                {draftRow && <span className="sk-chip sk-draft">Draft v{short(draftRow.version)}</span>}
                {data.hasDefault ? (
                  <span className="sk-chip sk-def">
                    <Lock />
                    Default v{short(data.defaultVersion ?? "1.0.0")} (built in)
                  </span>
                ) : (
                  <span className="sk-chip sk-plain">Imported pack</span>
                )}
                <span className="sk-chip sk-plain">{packId}</span>
              </div>
            </div>
            <div className="sk-tools">
              <button type="button" className="sk-btn" onClick={() => setImporting(true)}>
                Import skill (.zip, .skill)
              </button>
              <button type="button" className="sk-btn sk-btn--muse" onClick={() => askRef.current?.focus()}>
                <Sparkle />
                Enhance with Muse
              </button>
              <button type="button" className="sk-btn" disabled={!dirty || anyErrors || Boolean(busy)} onClick={() => void save()}>
                {busy === "save" && <span className="sk-spin" aria-hidden="true" />}
                Save draft
              </button>
              <button type="button" className="sk-btn sk-btn--pri" disabled={anyErrors || Boolean(busy) || (!dirty && !draftRow)} onClick={() => void publish()} title={!dirty && !draftRow ? "Change something first: publishing makes a new version" : undefined}>
                {busy === "publish" && <span className="sk-spin" aria-hidden="true" />}
                Publish v{short(nextVersion)}
              </button>
            </div>
          </header>

          {message && (
            <p className={`sk-note${message.ok ? " is-ok" : ""}`} role={message.ok ? "status" : "alert"}>
              {message.text}
            </p>
          )}
          {problems.length > 0 && (
            <ul className="sk-problems" aria-label="What to fix">
              {problems.map((p, i) => (
                <li key={i}>
                  <b>
                    {p.path || "pack"}
                    {p.line ? `:${p.line}` : ""}
                  </b>{" "}
                  {p.message}
                </li>
              ))}
            </ul>
          )}

          <div className="sk-grid">
            <nav className="sk-card sk-files" aria-label="Pack files">
              <h3 className="sk-h3">Pack files</h3>
              {paths.filter((p) => p === "skill.json" || p === "SKILL.md").map(fileButton)}
              <h3 className="sk-h3">References</h3>
              {refs.map(fileButton)}
              {newRef === null ? (
                <div className="sk-addfile">
                  <button type="button" className="sk-btn sk-btn--sm" onClick={() => setNewRef("")}>
                    New reference
                  </button>
                </div>
              ) : (
                <form className="sk-addfile" onSubmit={(e) => (e.preventDefault(), addReference())}>
                  <label className="sk-f" style={{ flex: "1 1 140px" }}>
                    <span>Title</span>
                    <input className="sk-in" autoFocus value={newRef} maxLength={60} onChange={(e) => setNewRef(e.target.value)} />
                  </label>
                  <button type="submit" className="sk-btn sk-btn--sm sk-btn--pri">
                    Add
                  </button>
                  <button type="button" className="sk-btn sk-btn--sm" onClick={() => setNewRef(null)}>
                    Cancel
                  </button>
                </form>
              )}
              <h3 className="sk-h3">Items</h3>
              {items.length ? items.map(fileButton) : <p className="sk-muted" style={{ padding: "0 10px" }}>No questions yet.</p>}
            </nav>

            <div className="sk-ed">
              {diff ? (
                <DiffView title={diff.title} pairs={diff.pairs} onClose={() => setDiff(null)} />
              ) : (
                <>
                  <div className="sk-card sk-edhead">
                    <span className="sk-h2">{current}</span>
                    <span className="sk-muted" style={{ flex: "1 1 220px", textAlign: "right" }}>
                      {editingDraft ? "Editing the draft. The default stays untouched." : `Editing a copy of ${selectedLabel}. Saving makes it the draft v${short(nextVersion)}; ${selectedLabel} stays as it is.`}
                    </span>
                    {drafts.length > 0 && (
                      <button type="button" className="sk-btn sk-btn--sm" onClick={() => setReviewIds([...reviewIds, ...drafts])}>
                        Mark {drafts.length} draft {drafts.length === 1 ? "question" : "questions"} reviewed
                      </button>
                    )}
                    {(current.startsWith("references/") || current.startsWith("items/")) && (
                      <button type="button" className="sk-btn sk-btn--sm sk-btn--del" onClick={() => removeFile(current)}>
                        Remove file
                      </button>
                    )}
                  </div>
                  {reviewIds.length > 0 && <p className="sk-note is-ok">{reviewIds.length} draft {reviewIds.length === 1 ? "question is" : "questions are"} marked reviewed by you when you save. Only reviewed questions reach a child.</p>}
                  <label className="ap-sr" htmlFor="sk-editor">
                    {current}
                  </label>
                  <textarea
                    id="sk-editor"
                    className="sk-text sk-mono"
                    spellCheck={current.endsWith(".md")}
                    value={buf[current] ?? ""}
                    onChange={(e) => setBuf({ ...buf, [current]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Tab" && !e.shiftKey) {
                        e.preventDefault();
                        const t = e.currentTarget;
                        const s = t.selectionStart;
                        const v = `${t.value.slice(0, s)}  ${t.value.slice(t.selectionEnd)}`;
                        setBuf({ ...buf, [current]: v });
                        requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
                      }
                      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                        e.preventDefault();
                        if (dirty && !anyErrors && !busy) void save();
                      }
                    }}
                  />
                  {errors[current]?.length > 0 && (
                    <ul className="sk-problems" aria-live="polite">
                      {errors[current].map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <section className="sk-card sk-vers" aria-label="Versions">
                <span className="sk-h2">Versions</span>
                {rows.map((r) => {
                  const isPub = r.id === data.published;
                  return (
                    <div key={r.id} className="sk-vrow" data-open={r.id === data.selected}>
                      <b>v{short(r.version)}</b>
                      <span>
                        {isPub ? <span className="sk-chip sk-pub">Published</span> : r.status === "draft" ? <span className="sk-chip sk-draft">Draft</span> : <span className="sk-muted" style={{ display: "inline" }}>Earlier</span>}
                        <small>
                          {SOURCE[r.source] ?? r.source}, {when(r.publishedAt ?? r.createdAt)}
                          {r.note ? ` · ${r.note.length > 110 ? `${r.note.slice(0, 110)}…` : r.note}` : ""}
                        </small>
                      </span>
                      <span className="sk-acts">
                        {r.id !== data.selected && (
                          <button type="button" className="sk-btn sk-btn--sm" onClick={() => (dirty && !window.confirm("Leave your unsaved changes?") ? null : void load(r.id))}>
                            Open
                          </button>
                        )}
                        <button type="button" className="sk-btn sk-btn--sm" onClick={() => void showDiff(r)}>
                          Diff
                        </button>
                        {!isPub && r.status === "published" && (
                          <button type="button" className="sk-btn sk-btn--sm" disabled={Boolean(busy)} onClick={() => void act("restore", r.id)}>
                            Restore
                          </button>
                        )}
                        {confirm === r.id ? (
                          <button type="button" className="sk-btn sk-btn--sm sk-btn--del" disabled={Boolean(busy)} onClick={() => void act("delete", r.id)}>
                            Delete v{short(r.version)}?
                          </button>
                        ) : (
                          (data.hasDefault || rows.length > 1) && (
                            <button type="button" className="sk-btn sk-btn--sm sk-btn--del" onClick={() => setConfirm(r.id)}>
                              Delete
                            </button>
                          )
                        )}
                      </span>
                    </div>
                  );
                })}
                {data.hasDefault && (
                  <div className="sk-vrow" data-open={data.selected === "default"}>
                    <b>v{short(data.defaultVersion ?? "1.0.0")}</b>
                    <span>
                      <span className="sk-chip sk-def">
                        <Lock />
                        Default
                      </span>
                      <small>Built into myKx; can&apos;t be deleted{data.published === "default" ? ". Kix reads it now." : ""}</small>
                    </span>
                    <span className="sk-acts">
                      {data.selected !== "default" && (
                        <button type="button" className="sk-btn sk-btn--sm" onClick={() => (dirty && !window.confirm("Leave your unsaved changes?") ? null : void load("default"))}>
                          Open
                        </button>
                      )}
                      {rows.length > 0 && (
                        <button type="button" className="sk-btn sk-btn--sm" onClick={() => void showDiff("default")}>
                          Diff
                        </button>
                      )}
                      {data.published !== "default" && (
                        <button type="button" className="sk-btn sk-btn--sm" disabled={Boolean(busy)} onClick={() => void act("restore", "default")}>
                          Restore
                        </button>
                      )}
                    </span>
                  </div>
                )}
                {!data.hasDefault && (
                  <div className="sk-vrow">
                    <b />
                    <span>
                      <small>An imported pack has no built-in default: deleting all its versions deletes the pack.</small>
                    </span>
                    <span className="sk-acts">
                      {confirm === "pack" ? (
                        <>
                          <label className="sk-f">
                            <span>Type {packId} to confirm</span>
                            <input className="sk-in" value={typed} onChange={(e) => setTyped(e.target.value)} />
                          </label>
                          <button type="button" className="sk-btn sk-btn--sm sk-btn--del" disabled={typed !== packId || Boolean(busy)} onClick={() => void act("delete-pack", packId)}>
                            Delete the pack
                          </button>
                        </>
                      ) : (
                        <button type="button" className="sk-btn sk-btn--sm sk-btn--del" onClick={() => setConfirm("pack")}>
                          Delete this pack
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </section>
            </div>

            <aside className="sk-side">
              <section className="sk-card" aria-label="Enhance with Muse">
                <span className="sk-h2">
                  <Sparkle /> Enhance with Muse
                </span>
                <p className="sk-sub">Tell Muse what to improve. It proposes changes as a draft you review; nothing is published by itself.</p>
                <label className="ap-sr" htmlFor="sk-ask">
                  What should Muse improve?
                </label>
                <textarea id="sk-ask" ref={askRef} className="sk-ask" value={ask} maxLength={1200} onChange={(e) => setAsk(e.target.value)} placeholder="Add practice on before-and-after with the total unchanged, and the trap where children change the total. Six questions, PSLE style." />
                <div className="sk-row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="sk-btn sk-btn--muse" disabled={ask.trim().length < 8 || Boolean(busy)} onClick={() => void enhance()}>
                    {busy === "enhance" ? <span className="sk-spin" aria-hidden="true" /> : <Sparkle />}
                    {busy === "enhance" ? "Muse is reading the pack…" : "Ask Muse"}
                  </button>
                </div>
                {busy === "enhance" && <p className="sk-muted" role="status">This takes a minute or two: Muse writes the changes, then works every new question out again.</p>}
                {proposal && (
                  <>
                    {proposal.summary && <p className="sk-sub">{proposal.summary}</p>}
                    <ul className="sk-prop">
                      {proposal.changes
                        .filter((c) => !c.path.startsWith("items/"))
                        .map((c) => (
                          <li key={c.path}>
                            <span className="sk-chip sk-muse">{lines(c.before, c.after)}</span>
                            <span>
                              {c.before === null ? "New" : "Changes in"} {c.path}
                              {c.why ? `: ${c.why}` : ""}
                            </span>
                          </li>
                        ))}
                      {proposal.items.length > 0 && (
                        <li>
                          <span className="sk-chip sk-muse">+{proposal.items.length}</span>
                          <span>New questions with worked answers, checked by Muse (drafts until you mark them reviewed)</span>
                        </li>
                      )}
                      {proposal.checks.length > 0 && flagged.length === 0 && (
                        <li>
                          <span className="sk-chip sk-ok">Checks out</span>
                          <span>Muse worked every new question again and got the same answers.</span>
                        </li>
                      )}
                      {flagged.map((c) => (
                        <li key={c.id}>
                          <span className={`sk-chip ${c.status === "mismatch" ? "sk-flag" : "sk-warn"}`}>{c.status === "mismatch" ? "Check" : c.status === "spelling" ? "Spelling" : "Unusual"}</span>
                          <span>
                            {c.id}: {c.status === "mismatch" ? `Muse got ${c.museAnswer ?? "a different answer"} when it worked it again.` : ""} {c.note ?? ""}
                          </span>
                        </li>
                      ))}
                      {proposal.ignored.map((x, i) => (
                        <li key={`i${i}`}>
                          <span className="sk-chip sk-plain">Left out</span>
                          <span className="sk-muted">{x}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="sk-row">
                      <button type="button" className="sk-btn" disabled={!proposal.changes.length} onClick={() => setDiff({ title: "Muse's proposal compared with your draft", pairs: proposal.changes.map((c) => ({ path: c.path, before: buf[c.path] ?? null, after: c.after })) })}>
                        Review diff
                      </button>
                      <button type="button" className="sk-btn sk-btn--pri" disabled={!proposal.changes.length || Boolean(busy)} onClick={() => void accept()}>
                        Accept into draft
                      </button>
                      <button type="button" className="sk-btn" onClick={() => setProposal(null)}>
                        Discard
                      </button>
                    </div>
                  </>
                )}
              </section>
              <section className="sk-card" aria-label="About versions">
                <span className="sk-h2">How versions work</span>
                <ul className="sk-prop">
                  <li>
                    <span className="sk-chip sk-def">
                      <Lock />
                      Default
                    </span>
                    <span>The pack built into myKx. It always stays; restore it any time.</span>
                  </li>
                  <li>
                    <span className="sk-chip sk-draft">Draft</span>
                    <span>Save draft keeps your changes here. Children never see a draft.</span>
                  </li>
                  <li>
                    <span className="sk-chip sk-pub">Published</span>
                    <span>The newest published version is the one Kix reads. Every publish is checked: pack schemas and the safety scanner (no child&apos;s name, school or paper).</span>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImported={(p) => {
            setImporting(false);
            if (p === packId) void load();
            else router.push(`/admin/skills/${p}`);
          }}
        />
      )}
    </AdminFrame>
  );
}
