"use client";

// Import a skill (board SkillImport): a standard agent skill as a .zip or .skill file, up to 5 MB. The server reads it
// in memory and lists what it keeps (SKILL.md, Markdown, item JSON) and what it drops (scripts above all: never kept
// or run), runs the safety scanner, and proposes the manifest (the skill's own skill.json, else Muse). The admin edits
// every field, then imports it as a draft version.
import { useEffect, useRef, useState } from "react";
import type { DroppedFile, ImportFields, KeptFile } from "@/lib/skills/import";
import { call, failWords, LOCK, SPARKLE, type Problem } from "./call";

type Inspect = { archive: { name: string; description: string; kept: KeptFile[]; dropped: DroppedFile[] }; fields: ImportFields; proposedBy: "skill.json" | "muse" | "guess"; safety: Problem[]; taken: string[] };

const LEVELS = ["P1", "P2", "P3", "P4", "P5", "P6", "Sec 1", "Sec 2", "Sec 3", "Sec 4"] as const;
const SUBJECTS = [
  ["maths", "Maths"],
  ["science", "Science"],
  ["english", "English"],
  ["chinese", "Chinese"],
] as const;
const TIERS = [
  ["", "None"],
  ["standard", "Standard"],
  ["foundation", "Foundation"],
  ["g1", "G1"],
  ["g2", "G2"],
  ["g3", "G3"],
] as const;
const MODES = [
  ["auto", "auto"],
  ["on_demand", "on demand"],
  ["off", "off"],
] as const;
const AGENTS = [
  ["tutor", "Kix Tutor"],
  ["vibe", "Vibe Zone"],
  ["parent", "Parent summary"],
  ["curator", "Knowledge agent"],
] as const;
const levelPrefix = (level: string) => (level.startsWith("Sec") ? `s${level.slice(4).trim()}-` : `${level.toLowerCase()}-`);
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (pack: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"inspect" | "import" | null>(null);
  const [found, setFound] = useState<Inspect | null>(null);
  const [fields, setFields] = useState<ImportFields | null>(null);
  const [topicsText, setTopicsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    sheet.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const inspect = async (f: File) => {
    setFile(f);
    setFound(null);
    setFields(null);
    setIdTouched(false);
    setError(null);
    setProblems([]);
    if (f.size > 5 * 1024 * 1024) {
      setError(`${kb(f.size)} is over the 5 MB limit.`);
      return;
    }
    setBusy("inspect");
    const form = new FormData();
    form.set("file", f);
    form.set("step", "inspect");
    const r = await call<Inspect>("POST", "/api/admin/skills/import", form);
    setBusy(null);
    if (!r.ok || !r.data) {
      setError(failWords(r, "That archive couldn't be read."));
      return;
    }
    setFound(r.data);
    setFields(r.data.fields);
    setTopicsText(r.data.fields.topics.map((t) => t.title).join("\n"));
  };

  const [idTouched, setIdTouched] = useState(false);
  const set = <K extends keyof ImportFields>(k: K, v: ImportFields[K]) => {
    if (k === "id") setIdTouched(true);
    setFields((f) => {
      if (!f || !found) return f;
      const next = { ...f, [k]: v };
      // An id the admin hasn't typed follows the level and subject.
      if ((k === "level" || k === "subject") && !idTouched) next.id = next.level === found.fields.level && next.subject === found.fields.subject ? found.fields.id : `${levelPrefix(next.level)}${next.subject}`;
      return next;
    });
  };
  const changed = (k: keyof ImportFields) => Boolean(found && fields && JSON.stringify(found.fields[k]) !== JSON.stringify(fields[k]));

  const doImport = async () => {
    if (!file || !fields || !found) return;
    const titles = topicsText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    const topics = titles.map((title) => found.fields.topics.find((t) => t.title === title) ?? { title, subskills: ["core"] });
    setBusy("import");
    setError(null);
    setProblems([]);
    const form = new FormData();
    form.set("file", file);
    form.set("step", "import");
    form.set("fields", JSON.stringify({ ...fields, topics: topics.length ? topics : found.fields.topics }));
    const r = await call<{ pack: string; version: string }>("POST", "/api/admin/skills/import", form);
    setBusy(null);
    if (!r.ok || !r.data) {
      setError(failWords(r, "The import was refused."));
      setProblems(r.problems);
      return;
    }
    onImported(r.data.pack);
  };

  const kept = found?.archive.kept ?? [];
  const refs = kept.filter((k) => k.path.startsWith("references/"));
  const items = kept.filter((k) => k.path.startsWith("items/"));
  const scripts = found?.archive.dropped.filter((d) => d.script) ?? [];
  const others = found?.archive.dropped.filter((d) => !d.script) ?? [];
  const exists = Boolean(fields && found?.taken.includes(fields.id));
  const blocked = Boolean(found?.safety.length);

  return (
    <div className="sk-back-scrim" role="presentation" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section ref={sheet} tabIndex={-1} className="sk-sheet" role="dialog" aria-modal="true" aria-labelledby="sk-import-title">
        <div className="sk-top">
          <h2 id="sk-import-title" className="sk-title" style={{ fontSize: 22 }}>
            Import a skill
          </h2>
          <button type="button" className="sk-btn" onClick={onClose} disabled={Boolean(busy)}>
            Close
          </button>
        </div>
        <p className="sk-sub">A standard agent skill: a folder with SKILL.md and its references, as a .zip or a .skill file. myKx keeps text only and never keeps or runs scripts.</p>
        <div className="sk-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), e.dataTransfer.files[0] && !busy && void inspect(e.dataTransfer.files[0]))}>
          <span className="sk-chip sk-def">{file?.name.toLowerCase().endsWith(".zip") ? ".zip" : ".skill"}</span>
          <span style={{ minWidth: 0, flex: "1 1 200px" }}>
            <b>{file ? file.name : "Drop a .zip or .skill file here"}</b>
            <small className="sk-muted" style={{ display: "block" }}>
              {file ? `${kb(file.size)}${found ? `, ${found.archive.kept.length + found.archive.dropped.length} files` : ""}` : "Up to 5 MB. Read in memory, never stored as uploaded."}
            </small>
          </span>
          <button type="button" className="sk-btn" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
            {file ? "Choose another" : "Choose a file"}
          </button>
          <input ref={input} type="file" accept=".zip,.skill,application/zip" hidden onChange={(e) => e.target.files?.[0] && void inspect(e.target.files[0])} />
        </div>
        {busy === "inspect" && (
          <p className="sk-sub" role="status" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="sk-spin" aria-hidden="true" /> Reading the archive{found ? "" : " and asking Muse for a manifest"}…
          </p>
        )}
        {error && (
          <p className="sk-note" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
        {problems.length > 0 && (
          <ul className="sk-problems" style={{ marginTop: 8 }}>
            {problems.map((p, i) => (
              <li key={i}>
                <b>{p.path || "pack"}{p.line ? `:${p.line}` : ""}</b> {p.message}
              </li>
            ))}
          </ul>
        )}
        {found && fields && (
          <>
            <ul className="sk-list">
              <li>
                <span className="sk-chip sk-ok">Found</span>
                <span>
                  SKILL.md with a name and description in its front matter: “{found.archive.name}”
                </span>
              </li>
              <li>
                <span className="sk-chip sk-ok">Kept</span>
                <span>
                  {refs.length} {refs.length === 1 ? "reference" : "references"}
                  {refs.length ? ` (${refs.map((r) => r.path.replace("references/", "")).join(", ")})` : ""} and {items.length} {items.length === 1 ? "item file" : "item files"}
                  {items.length ? " (questions are kept as drafts until you review them)" : ""}
                </span>
              </li>
              {scripts.length > 0 && (
                <li>
                  <span className="sk-chip sk-warn">Removed</span>
                  <span>
                    {scripts.map((d) => d.path).join(", ")}: scripts are never kept or run
                  </span>
                </li>
              )}
              {others.length > 0 && (
                <li>
                  <span className="sk-chip sk-plain">Left out</span>
                  <span>{others.map((d) => `${d.path} (${d.why})`).join("; ")}</span>
                </li>
              )}
              {found.safety.map((s, i) => (
                <li key={i}>
                  <span className="sk-chip sk-flag">Check</span>
                  <span>
                    {s.path}
                    {s.line ? `, line ${s.line}` : ""}: {s.message}. Packs never name a child, a school or an exam paper: fix it in the skill and import again.
                  </span>
                </li>
              ))}
              <li>
                <span className="sk-chip sk-muse">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="sk-sparkle">
                    <path d={SPARKLE} />
                  </svg>
                  {found.proposedBy === "muse" ? "Muse" : found.proposedBy === "skill.json" ? "Manifest" : "Guess"}
                </span>
                <span>
                  {found.proposedBy === "muse"
                    ? "Proposed the manifest from SKILL.md: level, subject, topics and which agents may load it. Edit anything below."
                    : found.proposedBy === "skill.json"
                      ? "The skill has its own myKx skill.json; it's filled in below. Edit anything."
                      : "Muse wasn't available, so this is a first guess from the skill's name. Edit every field."}
                </span>
              </li>
            </ul>
            <div className="sk-form">
              <label className={`sk-f${changed("id") ? " is-over" : ""}`}>
                <span>Pack id{changed("id") ? " (changed by you)" : ""}</span>
                <input className="sk-in" value={fields.id} onChange={(e) => set("id", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={40} />
              </label>
              <label className={`sk-f${changed("level") ? " is-over" : ""}`}>
                <span>Level{changed("level") ? " (changed by you)" : ""}</span>
                <select className="sk-in" value={fields.level} onChange={(e) => set("level", e.target.value as ImportFields["level"])}>
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className={`sk-f${changed("subject") ? " is-over" : ""}`}>
                <span>Subject{changed("subject") ? " (changed by you)" : ""}</span>
                <select className="sk-in" value={fields.subject} onChange={(e) => set("subject", e.target.value as ImportFields["subject"])}>
                  {SUBJECTS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`sk-f${changed("tier") ? " is-over" : ""}`}>
                <span>Tier{changed("tier") ? " (changed by you)" : ""}</span>
                <select className="sk-in" value={fields.tier ?? ""} onChange={(e) => set("tier", (e.target.value || null) as ImportFields["tier"])}>
                  {TIERS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="sk-form is-two">
              <label className={`sk-f${changed("title") ? " is-over" : ""}`}>
                <span>Title{changed("title") ? " (changed by you)" : ""}</span>
                <input className="sk-in" value={fields.title} maxLength={60} onChange={(e) => set("title", e.target.value)} />
              </label>
              <label className={`sk-f${changed("syllabus") ? " is-over" : ""}`}>
                <span>Syllabus{changed("syllabus") ? " (changed by you)" : ""}</span>
                <input className="sk-in" value={fields.syllabus} maxLength={100} onChange={(e) => set("syllabus", e.target.value)} />
              </label>
              <label className={`sk-f${changed("description") ? " is-over" : ""}`} style={{ gridColumn: "1 / -1" }}>
                <span>Description{changed("description") ? " (changed by you)" : ""}</span>
                <textarea className="sk-in" value={fields.description} maxLength={400} onChange={(e) => set("description", e.target.value)} />
              </label>
              <label className={`sk-f${topicsText !== found.fields.topics.map((t) => t.title).join("\n") ? " is-over" : ""}`}>
                <span>Topics, one per line</span>
                <textarea className="sk-in" value={topicsText} onChange={(e) => setTopicsText(e.target.value)} rows={5} />
              </label>
              <div className={`sk-f${changed("agents") ? " is-over" : ""}`}>
                <span>Agents that may load it{changed("agents") ? " (changed by you)" : ""}</span>
                {AGENTS.map(([k, label]) => (
                  <label key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, font: "700 13px var(--font-text)" }}>
                    {label}
                    <select className="sk-in" style={{ width: "auto", fontSize: 13 }} value={fields.agents[k]} onChange={(e) => set("agents", { ...fields.agents, [k]: e.target.value as ImportFields["agents"]["tutor"] })}>
                      {MODES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label className={`sk-f${changed("sourceKind") ? " is-over" : ""}`}>
                <span>Where it&apos;s from</span>
                <select className="sk-in" value={fields.sourceKind} onChange={(e) => set("sourceKind", e.target.value as ImportFields["sourceKind"])}>
                  <option value="own">Our own</option>
                  <option value="licensed">Licensed to us</option>
                </select>
              </label>
              <label className={`sk-f${changed("licence") ? " is-over" : ""}`}>
                <span>Licence</span>
                <input className="sk-in" value={fields.licence} maxLength={200} onChange={(e) => set("licence", e.target.value)} />
              </label>
            </div>
            {exists && <p className="sk-note" style={{ marginTop: 12 }}>A pack called {fields.id} already exists: this import becomes a new draft version of it. Its default (if it has one) always stays.</p>}
            <div className="sk-foot">
              <span className="sk-muted" style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 13, height: 13 }}>
                  <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d={LOCK} />
                </svg>
                Nothing reaches a child until you publish it.
              </span>
              <button type="button" className="sk-btn" onClick={onClose} disabled={Boolean(busy)}>
                Cancel
              </button>
              <button type="button" className="sk-btn sk-btn--pri" disabled={Boolean(busy) || blocked || !fields.id.startsWith(levelPrefix(fields.level))} onClick={() => void doImport()}>
                {busy === "import" ? <span className="sk-spin" aria-hidden="true" /> : null}
                {blocked ? "Fix the flagged lines first" : !fields.id.startsWith(levelPrefix(fields.level)) ? `The id starts with ${levelPrefix(fields.level)}` : exists ? "Import as a new draft" : "Import as draft v1.0"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
