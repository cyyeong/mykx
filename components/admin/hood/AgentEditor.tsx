"use client";

// Under the hood → one agent (board AgentEditor; founder, 29 Oct). Read and edit the agent's instructions, see the
// guardrails that are always added after them (fixed in code) and what code checks whatever the model says, its
// models and tools, and its versions: diff any of them against the published one, restore an older one or the
// built-in default, delete any but the default. Writes go through /api/admin/agents/[id] (admins only, behind the
// PIN, audited); Kix uses a newly published version within a minute. Platform content only, never a child's data.
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { AgentDetail, AgentListRow, VersionView } from "@/lib/agents/catalog";
import { diffHunks, diffLines, diffStats } from "@/lib/diff";
import "./agents.css";

type Tab = "instructions" | "guardrails" | "tools";
type Confirm = { kind: "publish" | "restore" | "delete"; version: number } | null;
type Reply<T> = { ok: true; data: T } | { ok: false; status: number; note: string | null };

async function call<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<Reply<T>> {
  try {
    const res = await fetch(url, { method, cache: "no-store", headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; note?: string }) | null;
    return res.ok && json?.ok !== false ? { ok: true, data: json as T } : { ok: false, status: res.status, note: json?.note ?? null };
  } catch {
    return { ok: false, status: 0, note: null };
  }
}

const clean = (s: string) => s.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
const when = (iso: string) => new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
const label = (v: VersionView) => (v.kind === "draft" ? `draft v${v.version}` : v.version === 1 ? "v1 (default)" : `v${v.version}`);

const LOCK = "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3";
function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, flex: "none" }}>
      <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/** The text the editor starts from: the draft being worked on, else what Kix uses now. */
const baseOf = (d: AgentDetail) => d.versions.find((v) => v.kind === "draft")?.text ?? d.versions.find((v) => v.current)?.text ?? "";

export function AgentEditor({ agentKey }: { agentKey: string }) {
  const [list, setList] = useState<AgentListRow[] | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<Tab>("instructions");
  const [compare, setCompare] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const load = (d: AgentDetail) => {
    setDetail(d);
    setText(baseOf(d));
    setNote("");
    setCompare(null);
    setConfirm(null);
    setList((l) => l?.map((r) => (r.key === d.agent.key ? { ...r, published: d.published, draft: d.draft } : r)) ?? l);
  };

  useEffect(() => {
    let live = true;
    void Promise.all([call<{ agents: AgentListRow[] }>("GET", "/api/admin/agents"), call<AgentDetail>("GET", `/api/admin/agents/${agentKey}`)]).then(([l, d]) => {
      if (!live) return;
      if (l.ok) setList(l.data.agents);
      if (d.ok) {
        setDetail(d.data);
        setText(baseOf(d.data));
      } else setFailed(d.status === 403 ? "Admins only." : d.status === 404 ? "There's no agent with that name." : "Couldn't load this agent.");
    });
    return () => {
      live = false;
    };
  }, [agentKey]);

  const base = detail ? baseOf(detail) : "";
  const dirty = Boolean(detail?.editable) && clean(text) !== clean(base);
  const current = detail?.versions.find((v) => v.current) ?? null;
  const draft = detail?.versions.find((v) => v.kind === "draft") ?? null;

  useEffect(() => {
    if (!dirty) return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stop);
    return () => window.removeEventListener("beforeunload", stop);
  }, [dirty]);

  async function act(body: Record<string, unknown>, done: (version: number) => string) {
    setBusy(true);
    setFlash(null);
    const r = await call<AgentDetail & { done: { version: number } }>("POST", `/api/admin/agents/${agentKey}`, body);
    setBusy(false);
    setConfirm(null);
    if (r.ok) {
      load(r.data);
      setFlash({ ok: true, text: done(r.data.done.version) });
    } else setFlash({ ok: false, text: r.note ?? (r.status === 403 ? "Admins only: unlock with the parent PIN and try again." : "Couldn't save that. Try again.") });
  }

  const muse = list?.filter((a) => a.models.length).length ?? 13;
  const rules = list ? list.length - muse : 2;

  return (
    <>
      <header className="ad-head">
        <div>
          <p className="ag-crumb">
            <Link href="/admin/under-the-hood">Under the hood</Link> <span aria-hidden="true">/</span> Agents
          </p>
          <h1 className="ad-h1">Under the hood: agents</h1>
          <p className="ad-lede">Click an agent to read and edit its instructions. Every change is a version; the built-in default can&apos;t be deleted.</p>
        </div>
        <span className="ag-chip ag-chip--muse">
          {muse} agents on Meta Muse · {rules} rules only
        </span>
      </header>

      <div className="ag-layout">
        <nav className="ad-card ag-list" aria-label="Agents">
          {list ? (
            <AgentLinks list={list} current={agentKey} dirty={dirty} />
          ) : (
            <p className="ad-muted">Loading…</p>
          )}
        </nav>

        {failed && <p className="ad-lede">{failed}</p>}
        {!detail && !failed && <p className="ad-lede ag-wait">Loading…</p>}

        {detail && !detail.editable && <ReadOnly detail={detail} />}

        {detail?.editable && current && (
          <>
            <section className="ad-card ag-editor" aria-labelledby="ag-name">
              <div className="ag-title">
                <h2 id="ag-name" className="ag-name">
                  {detail.agent.name}
                </h2>
                <span className="ag-chip ag-chip--pub">{current.version === 1 ? "Default (v1) in use" : `Published v${current.version}`}</span>
                {dirty ? <span className="ag-chip ag-chip--draft">Unsaved changes</span> : draft ? <span className="ag-chip ag-chip--draft">Editing draft v{draft.version}</span> : null}
              </div>

              <div className={confirm?.kind === "publish" ? "ag-actions is-asking" : "ag-actions"} role="group" aria-label="Save or publish">
                {confirm?.kind === "publish" ? (
                  <>
                    <span className="ag-ask">Publish as v{detail.publishAs}? Every family&apos;s Kix uses it within a minute.</span>
                    <button type="button" className="ag-btn" onClick={() => setConfirm(null)} disabled={busy}>
                      Cancel
                    </button>
                    <button type="button" className="ag-btn ag-btn--pri" onClick={() => act({ action: "publish", instructions: text, note: note || null }, (v) => `Published v${v}. Kix uses it within a minute.`)} disabled={busy}>
                      {busy ? "Publishing…" : `Publish v${detail.publishAs}`}
                    </button>
                  </>
                ) : (
                  <>
                    {dirty && (
                      <button type="button" className="ag-btn ag-btn--quiet" onClick={() => setText(base)} disabled={busy}>
                        Discard
                      </button>
                    )}
                    <button type="button" className="ag-btn" onClick={() => act({ action: "save-draft", instructions: text, note: note || null }, (v) => `Saved as draft v${v}. Kix still uses ${current.version === 1 ? "the default" : `v${current.version}`}.`)} disabled={busy || !dirty}>
                      Save draft
                    </button>
                    <button type="button" className="ag-btn ag-btn--pri" onClick={() => setConfirm({ kind: "publish", version: detail.publishAs ?? 0 })} disabled={busy || clean(text) === clean(current.text)}>
                      Publish v{detail.publishAs}
                    </button>
                  </>
                )}
              </div>

              <div className="ag-tabs" role="tablist" aria-label="About this agent">
                {(["instructions", "guardrails", "tools"] as const).map((t) => (
                  <button key={t} type="button" role="tab" id={`ag-tab-${t}`} aria-selected={tab === t} aria-controls={`ag-panel-${t}`} className="ag-tab" onClick={() => setTab(t)}>
                    {t === "instructions" ? "Instructions" : t === "guardrails" ? "Guardrails" : "Tools"}
                    {t === "guardrails" && <Icon d={LOCK} size={13} />}
                  </button>
                ))}
              </div>

              <div className="ag-body" role="tabpanel" id={`ag-panel-${tab}`} aria-labelledby={`ag-tab-${tab}`}>
                {flash && (
                  <p className={flash.ok ? "ag-flash" : "ag-flash is-bad"} role="status">
                    {flash.text}
                  </p>
                )}
                {tab === "instructions" && <InstructionsTab detail={detail} text={text} setText={setText} note={note} setNote={setNote} published={current.text} />}
                {tab === "guardrails" && <GuardrailsTab detail={detail} full />}
                {tab === "tools" && <ToolsTab detail={detail} />}
              </div>
            </section>

            <Versions detail={detail} text={text} dirty={dirty} compare={compare} setCompare={setCompare} confirm={confirm} setConfirm={setConfirm} busy={busy} act={act} />
          </>
        )}
      </div>
    </>
  );
}

function AgentLinks({ list, current, dirty }: { list: AgentListRow[]; current: string; dirty: boolean }) {
  const leave = (e: MouseEvent) => {
    if (dirty && !window.confirm("Leave without saving? Your edits will be lost.")) e.preventDefault();
  };
  const row = (a: AgentListRow) => (
    <Link key={a.key} href={`/admin/under-the-hood/agents/${a.key}`} className="ag-item" aria-current={a.key === current ? "page" : undefined} onClick={a.key === current ? undefined : leave}>
      <span className="ag-item-name">{a.name.replace(/ \(.*\)$/, "")}</span>
      <small>{a.editable ? `${a.published === 1 ? "default" : `v${a.published}`}${a.draft ? " · draft" : ""}` : a.models.length ? "fixed" : "rules"}</small>
    </Link>
  );
  return (
    <>
      <p className="ag-group">Instructions you can edit</p>
      <div className="ag-items">{list.filter((a) => a.editable).map(row)}</div>
      <p className="ag-group">Nothing to edit</p>
      <div className="ag-items">{list.filter((a) => !a.editable).map(row)}</div>
    </>
  );
}

/** Highlights {{variables}}, [junior]/[teen] tags, part headings and lines added since the published version. */
function Highlight({ text, vars, headings, added }: { text: string; vars: Set<string>; headings: Set<string>; added: boolean[] }) {
  const line = (l: string): ReactNode => {
    if (!l) return "​";
    if (headings.has(l.trim())) return <span className="ag-hd">{l}</span>;
    const tag = /^\[(junior|teen)\][ \t]?/.exec(l);
    const rest = tag ? l.slice(tag[0].length) : l;
    return (
      <>
        {tag && <span className="ag-tagx">{tag[0]}</span>}
        {rest.split(/(\{\{\s*[A-Za-z][A-Za-z0-9]*\s*\}\})/).map((part, i) => {
          const m = /^\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}$/.exec(part);
          return m ? (
            <span key={i} className={vars.has(m[1]) ? "ag-var" : "ag-var is-bad"}>
              {part}
            </span>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          );
        })}
      </>
    );
  };
  return (
    <>
      {text.split("\n").map((l, i) => (
        <span key={i} className="ag-ln" data-added={added[i] ? "true" : undefined}>
          {line(l)}
        </span>
      ))}
    </>
  );
}

function InstructionsTab({ detail, text, setText, note, setNote, published }: { detail: AgentDetail; text: string; setText: (s: string) => void; note: string; setNote: (s: string) => void; published: string }) {
  const ed = detail.editable!;
  const ref = useRef<HTMLTextAreaElement>(null);
  const vars = useMemo(() => new Set(ed.vars.map((v) => v.name)), [ed.vars]);
  const headings = useMemo(() => new Set(ed.multiPart ? ed.parts.map((p) => `## ${p.title}`) : []), [ed.multiPart, ed.parts]);
  // Lines of the editor that aren't in the published version, for the green bar.
  const added = useMemo(() => {
    const out: boolean[] = [];
    for (const l of diffLines(published, text)) if (l.kind !== "del") out.push(l.kind === "add");
    return out;
  }, [published, text]);
  const unknown = useMemo(() => [...new Set([...text.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g)].map((m) => m[1]).filter((n) => !vars.has(n)))], [text, vars]);
  const insert = (s: string) => {
    const el = ref.current;
    if (!el) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    setText(text.slice(0, a) + s + text.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + s.length, a + s.length);
    });
  };
  const over = text.length > ed.max;

  return (
    <>
      <p id="ag-help" className="ad-muted">
        Tone, style and method, in plain words. Words in {"{{ }}"} are filled in by code
        {ed.bands ? "; start a line with [junior] or [teen] to use it for one band only" : ""}.
        {ed.multiPart ? ` This agent has ${ed.parts.length} prompts: keep each "## " heading, and the lines under it go to that prompt.` : ""} Never write a child&apos;s name or details here: these instructions reach every family.
      </p>
      <div className="ag-code">
        <pre className="ag-hl" aria-hidden="true">
          <Highlight text={text} vars={vars} headings={headings} added={added} />
        </pre>
        <textarea ref={ref} className="ag-ta" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label={`Instructions for ${detail.agent.name}`} aria-describedby="ag-help ag-count" />
      </div>
      <div className="ag-under">
        <span id="ag-count" className={over ? "ag-count is-bad" : "ag-count"}>
          {text.length.toLocaleString("en-SG")} / {ed.max.toLocaleString("en-SG")} characters
        </span>
        {unknown.length > 0 && <span className="ag-count is-bad">Left out: {unknown.map((n) => `{{${n}}}`).join(", ")} (not filled in for this agent)</span>}
      </div>
      {ed.vars.length > 0 && (
        <div className="ag-fills" aria-label="Fill-ins">
          <span className="ad-muted">Insert:</span>
          {ed.vars.map((v) => (
            <button key={v.name} type="button" className="ag-fill" onClick={() => insert(`{{${v.name}}}`)} title={v.about}>
              <code>{`{{${v.name}}}`}</code>
              <span>{v.about}</span>
            </button>
          ))}
        </div>
      )}
      <label className="ag-note">
        <span>What changed (optional, shown in Versions)</span>
        <input className="ap-input" value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} maxLength={120} placeholder="For example: shorter sentences for juniors" />
      </label>
      <GuardrailsTab detail={detail} />
    </>
  );
}

function GuardrailsTab({ detail, full = false }: { detail: AgentDetail; full?: boolean }) {
  const ed = detail.editable!;
  const parts = ed.parts.map((p) => ({ title: p.title, lines: ed.guardrails.filter((g) => g.part === p.title) })).filter((p) => p.lines.length);
  const learned = detail.learned ?? [];
  return (
    <>
      <div className="ag-guard ag-learned">
        <h3 className="ag-h3">Learned cautions (Kix Synapse), added after the instructions and before the guardrails</h3>
        {learned.length ? (
          <ul>
            {learned.map((c) => (
              <li key={c.id} data-status={c.status}>
                {c.line}{" "}
                <small>
                  {c.status === "live" ? "live" : c.status} · by {c.by} · {new Date(c.at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                  {c.reportId && (
                    <>
                      {" "}
                      · <Link href={`/admin/synapse/${c.reportId}`}>the report</Link>
                    </>
                  )}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ad-muted">None yet. When a kid&apos;s report shows this agent made a mistake and the fix is proven, the caution appears here; undo it in Kix Synapse → Learned.</p>
        )}
      </div>
      <div className="ag-guard">
        <h3 className="ag-h3">
          <Icon d={LOCK} /> Guardrails (fixed in code, always added after the instructions)
        </h3>
        {parts.length ? (
          parts.map((p) => (
            <Fragment key={p.title}>
              {ed.multiPart && <p className="ag-part">{p.title}</p>}
              <ul>
                {p.lines.map((g, i) => (
                  <li key={i}>
                    {g.note && <strong>{g.note}: </strong>}
                    {g.text}
                  </li>
                ))}
              </ul>
            </Fragment>
          ))
        ) : (
          <p className="ad-muted">None in the prompt: the checks below hold in code.</p>
        )}
      </div>
      {full && (
        <div className="ag-guard ag-guard--code">
          <h3 className="ag-h3">Checked in code, whatever the model says</h3>
          <ul>
            {ed.enforced.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Facts({ detail }: { detail: AgentDetail }) {
  const ed = detail.editable;
  return (
    <dl className="ag-facts">
      <dt>Models</dt>
      <dd className="ad-models">
        {detail.agent.models.length ? (
          detail.agent.models.map((m) => (
            <code key={m} className="ad-model">
              {m}
            </code>
          ))
        ) : (
          <span className="ad-model is-none">no model: rules in code</span>
        )}
      </dd>
      {ed && (
        <>
          <dt>Tools and inputs</dt>
          <dd className="ad-tools">
            {ed.tools.length ? (
              ed.tools.map((t) => (
                <code key={t} className="ad-tool">
                  {t}
                </code>
              ))
            ) : (
              <span className="ad-muted">None: one call with structured output</span>
            )}
          </dd>
          <dt>Output</dt>
          <dd>{ed.output}</dd>
        </>
      )}
      <dt>Reads</dt>
      <dd>{detail.agent.reads}</dd>
      <dt>Never</dt>
      <dd>{detail.agent.never}</dd>
      {ed && ed.vars.length > 0 && (
        <>
          <dt>Filled in by code</dt>
          <dd>
            {ed.vars.map((v) => (
              <span key={v.name} className="ag-fillrow">
                <code>{`{{${v.name}}}`}</code> {v.about}
              </span>
            ))}
          </dd>
        </>
      )}
    </dl>
  );
}

function ToolsTab({ detail }: { detail: AgentDetail }) {
  return <Facts detail={detail} />;
}

function ReadOnly({ detail }: { detail: AgentDetail }) {
  return (
    <section className="ad-card ag-editor ag-editor--fixed" aria-labelledby="ag-name">
      <div className="ag-title">
        <h2 id="ag-name" className="ag-name">
          {detail.agent.name}
        </h2>
        <span className="ag-chip ag-chip--def">
          <Icon d={LOCK} size={13} /> Nothing to edit
        </span>
      </div>
      <p className="ag-why">{detail.readOnly}</p>
      <Facts detail={detail} />
    </section>
  );
}

function Versions(p: {
  detail: AgentDetail;
  text: string;
  dirty: boolean;
  compare: number | null;
  setCompare: (v: number | null) => void;
  confirm: Confirm;
  setConfirm: (c: Confirm) => void;
  busy: boolean;
  act: (body: Record<string, unknown>, done: (version: number) => string) => Promise<void>;
}) {
  const { detail, compare } = p;
  const vs = detail.versions;
  const current = vs.find((v) => v.current)!;
  const def = vs.find((v) => v.version === 1)!;
  const draft = vs.find((v) => v.kind === "draft") ?? null;
  // What the diff shows: a version picked with Diff, else the editor's unsaved edits, else the draft.
  const picked = compare !== null ? vs.find((v) => v.version === compare) : null;
  const pair = picked
    ? picked.current
      ? { title: `${label(def)} → ${label(picked)}`, before: def.text, after: picked.text }
      : { title: `${label(current)} → ${label(picked)}`, before: current.text, after: picked.text }
    : p.dirty
      ? { title: `${label(current)} → your edits`, before: current.text, after: p.text }
      : draft
        ? { title: `${label(current)} → ${label(draft)}`, before: current.text, after: draft.text }
        : null;
  const lines = pair ? diffLines(pair.before, pair.after) : [];
  const stats = diffStats(lines);
  const fallback = (v: VersionView) => vs.filter((x) => x.kind === "earlier" && x.version < v.version)[0]?.version ?? 1;

  return (
    <aside className="ad-card ag-versions" aria-labelledby="ag-vtitle">
      <h2 id="ag-vtitle" className="ag-h2">
        Versions
      </h2>
      <ol className="ag-vlist">
        {vs.map((v) => {
          const asking = p.confirm && p.confirm.kind !== "publish" && p.confirm.version === v.version ? p.confirm : null;
          return (
            <li key={v.version} className="ag-vrow" data-current={v.current ? "true" : undefined}>
              <b className="ag-vnum">v{v.version}</b>
              <div className="ag-vmeta">
                <span>
                  {v.kind === "default" ? (
                    <span className="ag-chip ag-chip--def">
                      <Icon d={LOCK} size={12} /> Default
                    </span>
                  ) : v.kind === "draft" ? (
                    <span className="ag-chip ag-chip--draft">Draft</span>
                  ) : v.kind === "published" ? (
                    <span className="ag-chip ag-chip--pub">Published</span>
                  ) : (
                    <span className="ag-vstate">Earlier</span>
                  )}
                  {v.current && <span className="ag-inuse"> In use</span>}
                </span>
                <small>{[v.note, v.at ? when(v.at) : null, v.by].filter(Boolean).join(" · ")}</small>
              </div>
              {asking ? (
                <div className="ag-confirm">
                  <span>
                    {asking.kind === "restore"
                      ? `Publish ${label(v)}'s instructions again as v${detail.next}? Kix uses them within a minute.`
                      : v.current
                        ? `Delete v${v.version}? Kix goes back to ${fallback(v) === 1 ? "the default" : `v${fallback(v)}`}.`
                        : `Delete ${label(v)}? It leaves the list; the audit log keeps a record.`}
                  </span>
                  <span className="ag-acts">
                    <button type="button" className="ag-btn" onClick={() => p.setConfirm(null)} disabled={p.busy}>
                      Cancel
                    </button>
                    {asking.kind === "restore" ? (
                      <button type="button" className="ag-btn ag-btn--pri" disabled={p.busy} onClick={() => p.act({ action: "restore", version: v.version }, (n) => `Restored ${label(v)} as v${n}. Kix uses it within a minute.`)}>
                        Restore
                      </button>
                    ) : (
                      <button type="button" className="ag-btn ag-btn--del" disabled={p.busy} onClick={() => p.act({ action: "delete", version: v.version }, () => `Deleted ${label(v)}.`)}>
                        Delete
                      </button>
                    )}
                  </span>
                </div>
              ) : (
                <span className="ag-acts">
                  {!(v.version === 1 && v.current) && (
                    <button type="button" className="ag-btn" aria-pressed={compare === v.version} onClick={() => p.setCompare(compare === v.version ? null : v.version)}>
                      Diff
                    </button>
                  )}
                  {!v.current && v.kind !== "draft" && (
                    <button type="button" className="ag-btn" onClick={() => p.setConfirm({ kind: "restore", version: v.version })} disabled={p.busy}>
                      Restore
                    </button>
                  )}
                  {v.version !== 1 && (
                    <button type="button" className="ag-btn ag-btn--del" onClick={() => p.setConfirm({ kind: "delete", version: v.version })} disabled={p.busy}>
                      Delete
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="ag-diffbox" aria-live="polite">
        {pair ? (
          <>
            <h3 className="ag-h3">
              Diff: {pair.title}
              <span className="ag-stat">
                {stats.added || stats.removed ? (
                  <>
                    <span className="is-add">+{stats.added}</span> <span className="is-del">−{stats.removed}</span>
                  </>
                ) : (
                  "no changes"
                )}
              </span>
            </h3>
            {stats.added || stats.removed ? (
              <div className="ag-diff">
                {diffHunks(lines, 1).map((l, i) => (
                  <span key={i} className="ag-dl" data-kind={l.kind}>
                    <span className="ag-dsign" aria-hidden="true">
                      {l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}
                    </span>
                    <span className="ap-sr">{l.kind === "add" ? "Added: " : l.kind === "del" ? "Removed: " : ""}</span>
                    {l.text || "​"}
                  </span>
                ))}
              </div>
            ) : (
              <p className="ad-muted">The same instructions, word for word.</p>
            )}
          </>
        ) : (
          <p className="ad-muted">Pick Diff on a version to compare it with the one Kix uses now.</p>
        )}
      </div>
    </aside>
  );
}
