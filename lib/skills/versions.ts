// Skill versions (founder, 29 Oct; docs/prd/SKILL_ENGINE.md §6 and §7). A pack's text files (skill.json, SKILL.md,
// references/*.md, items/*.json) can be edited, enhanced by Muse, imported or refined by the knowledge agent, and each
// change is a row in `skill_versions`. The pack on disk is the **default** version: never a row, never deletable.
// The published version is the newest non-deleted published row (by when it was published), else the default.
// Restore makes a new published row from an older version; delete soft-deletes a row and the pack falls back.
//
// Pure rules only (no store, no fs), so the routes, the override layer and the tests share them. Every version that
// is saved or published must pass the pack schemas and the safety scanner (rule 10): a version row never holds a
// child's name, a school paper's wording or anything the content tests would refuse on disk.
import { findBanned, scannableText } from "./safety.ts";
import { SkillItemSchema, SkillManifestSchema } from "./schema.ts";
import type { SkillItem, SkillManifest } from "../types.ts";

export const VERSION_SOURCES = ["edit", "enhance", "import", "knowledge", "restore"] as const;
export type VersionSource = (typeof VERSION_SOURCES)[number];
export type VersionStatus = "draft" | "published";

/** path → text: `skill.json`, `SKILL.md`, `references/<name>.md`, `items/<name>.json`. */
export type PackFiles = Record<string, string>;

export interface SkillVersion {
  id: string;
  packId: string;
  version: string;
  files: PackFiles;
  status: VersionStatus;
  source: VersionSource;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
}

/** A version as a list shows it: without its files. */
export type SkillVersionMeta = Omit<SkillVersion, "files"> & { fileCount: number; bytes: number };

export const PACK_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const FILE_PATH = /^(?:skill\.json|SKILL\.md|references\/[A-Za-z0-9._-]{1,80}\.md|items\/[A-Za-z0-9._-]{1,80}\.json)$/;
export const MAX_FILE_CHARS = 400_000;
export const MAX_PACK_CHARS = 1_600_000;
export const MAX_FILES = 120;

export const isPackPath = (p: string) => FILE_PATH.test(p) && !p.includes("..");

export function metaOf(v: SkillVersion): SkillVersionMeta {
  const { files, ...rest } = v;
  return { ...rest, fileCount: Object.keys(files).length, bytes: Object.values(files).reduce((n, t) => n + t.length, 0) };
}

/** Numeric semver order: 1.10.0 after 1.9.0. */
export function semverCmp(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** The published version of a pack among its rows: the newest non-deleted published row, or null (the default). */
export function publishedOf<T extends Pick<SkillVersion, "packId" | "status" | "deletedAt" | "publishedAt" | "createdAt">>(rows: readonly T[], packId: string): T | null {
  return (
    rows
      .filter((r) => r.packId === packId && r.status === "published" && !r.deletedAt)
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))[0] ?? null
  );
}

/** The pack's open draft, if any: the newest non-deleted draft row. */
export function draftOf<T extends Pick<SkillVersion, "packId" | "status" | "deletedAt" | "createdAt">>(rows: readonly T[], packId: string): T | null {
  return rows.filter((r) => r.packId === packId && r.status === "draft" && !r.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** The next version number: one minor up from the highest of the default and every row, deleted ones too (a number is
 *  never reused). A pack with neither (a first import) starts at 1.0.0. */
export function nextPackVersion(defaultVersion: string | null, rows: readonly Pick<SkillVersion, "version">[]): string {
  const all = [...rows.map((r) => r.version), ...(defaultVersion ? [defaultVersion] : [])].filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  if (!all.length) return "1.0.0";
  const [major, minor] = all.sort(semverCmp)[all.length - 1].split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

/** What a row may be deleted as: the default can't be (it isn't a row); the last version of a new pack needs the
 *  "delete the whole pack" confirmation instead. */
export function canDelete(rows: readonly Pick<SkillVersion, "id" | "deletedAt">[], id: string, hasDefault: boolean): { ok: true } | { ok: false; reason: string } {
  const live = rows.filter((r) => !r.deletedAt);
  if (!live.some((r) => r.id === id)) return { ok: false, reason: "No such version." };
  if (!hasDefault && live.length === 1) return { ok: false, reason: "This is the pack's only version. Delete the whole pack instead (it asks you to confirm)." };
  return { ok: true };
}

// ─── Files ─────────────────────────────────────────────────────────────────

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

/** Applies an editor's changes (path → new text, or null to remove the file) to a version's files. */
export function applyChanges(base: PackFiles, changes: Record<string, string | null>): PackFiles {
  const out: PackFiles = { ...base };
  for (const [path, text] of Object.entries(changes)) {
    if (text === null) delete out[path];
    else out[path] = text;
  }
  return out;
}

/** Sets fields of the manifest (version, status, …), keeping its formatting (two-space JSON, like the packs on disk).
 *  A manifest that doesn't parse is left as it is, for validation to report. */
export function withManifest(files: PackFiles, patch: Partial<Record<"version" | "status", string>>): PackFiles {
  const text = files["skill.json"];
  if (text === undefined) return files;
  try {
    const m = JSON.parse(text) as Record<string, unknown>;
    return { ...files, "skill.json": json({ ...m, ...patch }) };
  } catch {
    return files;
  }
}

/** A reference's title (its `# ` heading, else the file name) and sections (its `## ` headings): the rule every pack
 *  on disk follows, checked by content/skills.test.ts. */
export function referenceOutline(path: string, text: string): { file: string; title: string; sections: string[] } {
  const lines = text.split("\n");
  const title = lines.find((l) => /^# \S/.test(l))?.slice(2).trim() || path.replace(/^references\//, "").replace(/\.md$/, "").replace(/[-_]/g, " ");
  return { file: path, title, sections: lines.filter((l) => /^## \S/.test(l)).map((l) => l.slice(3).trim()) };
}

/** Rewrites the manifest's `references` from the reference files themselves (titles and sections), so a new or
 *  edited reference is always readable by id. Order: the manifest's order first, then new files by name. */
export function syncReferences(files: PackFiles): PackFiles {
  const text = files["skill.json"];
  if (text === undefined) return files;
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return files;
  }
  const refFiles = Object.keys(files).filter((p) => p.startsWith("references/") && p.endsWith(".md"));
  const listed = Array.isArray(m.references) ? (m.references as { file?: string }[]).map((r) => r.file).filter((f): f is string => typeof f === "string") : [];
  const ordered = [...listed.filter((f) => refFiles.includes(f)), ...refFiles.filter((f) => !listed.includes(f)).sort()];
  const references = ordered.map((f) => referenceOutline(f, files[f]));
  if (JSON.stringify(references) === JSON.stringify(m.references)) return files;
  return { ...files, "skill.json": json({ ...m, references }) };
}

/** "P3" → "p3-", "Sec 2" → "s2-": the prefix a pack's id must start with, so packsForChild finds it. */
export function levelPrefix(level: string): string {
  return level.startsWith("Sec") ? `s${level.slice(4).trim()}-` : `${level.toLowerCase()}-`;
}

export interface FileProblem {
  path: string;
  message: string;
  line?: number;
}

/** Front matter `name` and `description` from a SKILL.md, or null. */
export function frontMatter(text: string): { name: string; description: string } | null {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text.replace(/\r\n/g, "\n"));
  if (!m) return null;
  const field = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(m[1])?.[1].trim().replace(/^["']|["']$/g, "") ?? "";
  const name = field("name");
  const description = field("description");
  return name && description ? { name, description } : null;
}

export interface PackCheck {
  manifest: SkillManifest | null;
  items: SkillItem[];
  problems: FileProblem[];
}

/**
 * Everything a version must pass before it is saved or published: allowed paths and sizes, a manifest that passes
 * SkillManifestSchema with this pack's id and a level-matching id prefix, a SKILL.md with name and description front
 * matter, references that exist, and items that pass SkillItemSchema and agree with the manifest (the same rules
 * content/skills.test.ts holds the packs on disk to). `figureExists` says whether a figure path is on disk.
 */
export function checkPack(files: PackFiles, packId: string, figureExists: (path: string) => boolean = () => false): PackCheck {
  const problems: FileProblem[] = [];
  const add = (path: string, message: string, line?: number) => problems.push({ path, message, ...(line ? { line } : {}) });
  const paths = Object.keys(files);
  if (!PACK_ID.test(packId)) add("skill.json", `"${packId}" isn't a pack id (lowercase letters, digits and hyphens)`);
  if (paths.length > MAX_FILES) add("skill.json", `${paths.length} files: at most ${MAX_FILES}`);
  let total = 0;
  for (const p of paths) {
    if (!isPackPath(p)) add(p, "not a pack file: only skill.json, SKILL.md, references/*.md and items/*.json");
    total += files[p].length;
    if (files[p].length > MAX_FILE_CHARS) add(p, `too long (${files[p].length} characters; at most ${MAX_FILE_CHARS})`);
  }
  if (total > MAX_PACK_CHARS) add("skill.json", `the pack's text is ${total} characters; at most ${MAX_PACK_CHARS}`);

  let manifest: SkillManifest | null = null;
  if (files["skill.json"] === undefined) add("skill.json", "missing");
  else {
    let raw: unknown;
    try {
      raw = JSON.parse(files["skill.json"]);
    } catch (e) {
      add("skill.json", `not valid JSON: ${(e as Error).message}`);
    }
    if (raw !== undefined) {
      const parsed = SkillManifestSchema.safeParse(raw);
      if (!parsed.success) for (const i of parsed.error.issues) add("skill.json", `${i.path.join(".") || "manifest"}: ${i.message}`);
      else {
        manifest = parsed.data as SkillManifest;
        if (manifest.id !== packId) add("skill.json", `id is "${manifest.id}" but the pack is "${packId}"`);
        if (!manifest.id.startsWith(levelPrefix(manifest.level))) add("skill.json", `a ${manifest.level} pack's id starts with "${levelPrefix(manifest.level)}"`);
        for (const r of manifest.references) if (files[r.file] === undefined) add("skill.json", `lists ${r.file}, which isn't in the pack`);
      }
    }
  }

  if (files["SKILL.md"] === undefined) add("SKILL.md", "missing");
  else if (!frontMatter(files["SKILL.md"])) add("SKILL.md", "needs front matter with name and description (--- name: … description: … ---)", 1);

  const items: SkillItem[] = [];
  const seen = new Set<string>();
  for (const p of paths.filter((x) => x.startsWith("items/")).sort()) {
    let raw: unknown;
    try {
      raw = JSON.parse(files[p]);
    } catch (e) {
      add(p, `not valid JSON: ${(e as Error).message}`);
      continue;
    }
    if (!Array.isArray(raw)) {
      add(p, "must be a list of items");
      continue;
    }
    raw.forEach((r, i) => {
      const parsed = SkillItemSchema.safeParse(r);
      const label = typeof (r as { id?: unknown })?.id === "string" ? (r as { id: string }).id : `item ${i + 1}`;
      if (!parsed.success) {
        for (const issue of parsed.error.issues.slice(0, 3)) add(p, `${label}: ${issue.path.join(".") || "item"} ${issue.message}`);
        return;
      }
      const item = parsed.data as SkillItem;
      if (seen.has(item.id)) add(p, `${item.id}: id used twice`);
      seen.add(item.id);
      if (item.skill !== packId) add(p, `${item.id}: skill is "${item.skill}", not "${packId}"`);
      if (manifest) {
        const topic = manifest.topics.find((t) => t.id === item.topic);
        if (!topic) add(p, `${item.id}: topic ${item.topic} isn't in skill.json`);
        else if (!topic.subskills.includes(item.subskill)) add(p, `${item.id}: subskill ${item.subskill} isn't one of ${topic.id}'s`);
        if (item.archetype && manifest.archetypes.find((a) => a.id === item.archetype)?.topic !== item.topic) add(p, `${item.id}: archetype ${item.archetype} isn't a pattern of ${item.topic}`);
      }
      if (item.status === "reviewed" && !item.reviewed_by) add(p, `${item.id}: a reviewed item needs reviewed_by`);
      if (item.figure && !figureExists(item.figure)) add(p, `${item.id}: figure ${item.figure} isn't in the pack`);
      items.push(item);
    });
  }
  return { manifest, items, problems };
}

/** The safety scanner over every file (child names, schools, paper codes, exam sources, learner traits; rule 10). */
export function safetyProblems(files: PackFiles): FileProblem[] {
  const out: FileProblem[] = [];
  for (const [path, text] of Object.entries(files)) {
    let scannable = text;
    try {
      scannable = scannableText(path, text);
    } catch {
      // A manifest that doesn't parse is scanned as text (checkPack reports the JSON error).
    }
    for (const hit of findBanned(scannable)) out.push({ path, line: hit.line, message: `${hit.label}: "${hit.match}" (…${hit.context.trim().slice(0, 90)}…)` });
  }
  return out;
}

/** Both checks, as one list: what stops a save or a publish. */
export function versionProblems(files: PackFiles, packId: string, figureExists?: (path: string) => boolean): FileProblem[] {
  return [...checkPack(files, packId, figureExists).problems, ...safetyProblems(files)];
}

/** "Oct 2026": how dates are written inside a pack. A full date in the exam months reads as an exam date to the
 *  safety scanner, and a pack never carries one. */
export function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Items in a version: how many, and how many are reviewed (only reviewed items reach a child). */
export function itemCounts(files: PackFiles): { items: number; reviewed: number } {
  let items = 0;
  let reviewed = 0;
  for (const [p, t] of Object.entries(files)) {
    if (!p.startsWith("items/")) continue;
    try {
      const list = JSON.parse(t) as { status?: string }[];
      if (!Array.isArray(list)) continue;
      items += list.length;
      reviewed += list.filter((i) => i?.status === "reviewed").length;
    } catch {
      continue;
    }
  }
  return { items, reviewed };
}
