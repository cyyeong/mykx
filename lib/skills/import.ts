// Import a standard agent skill (founder, 29 Oct): a folder with SKILL.md (name and description front matter) and
// its references, as a .zip or a .skill file (a zip), read in memory with fflate. myKx keeps text only: SKILL.md,
// Markdown docs (as references) and item JSON in myKx's item format. Everything else is dropped and listed,
// scripts above all: the app never keeps or runs a script that comes inside a skill (rule 10). A myKx skill.json in
// the archive is used as the starting manifest; otherwise Muse Spark proposes one and the admin edits every field.
// The result is checked like any version (schemas and the safety scanner) and saved as a draft. Pure: no store, no fs.
import { strFromU8, unzipSync, type UnzipFileInfo } from "fflate";
import { z } from "zod";
import type { SkillItem, SkillLevel, SkillManifest, SkillSubject, SkillTier } from "../types.ts";
import { AgentSkillModeSchema, SKILL_LEVELS, SKILL_SUBJECTS, SKILL_TIERS, SkillItemSchema, SkillManifestSchema } from "./schema.ts";
import { frontMatter, levelPrefix, monthYear, syncReferences, type PackFiles } from "./versions.ts";

export const MAX_ZIP_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MAX_ENTRY_BYTES = 1_000_000;
const MAX_TEXT_BYTES = 3_000_000;
/** Code of any kind: never kept, never run. */
const SCRIPT = /\.(?:py|pyc|pyo|ipynb|js|mjs|cjs|ts|tsx|jsx|sh|bash|zsh|fish|ps1|bat|cmd|rb|pl|php|lua|r|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|exe|dll|so|dylib|jar|wasm|bin|app|vbs|applescript)$/i;
const JUNK = /(?:^|\/)(?:__MACOSX\/|\.DS_Store$|Thumbs\.db$|\.git\/)/;

export interface KeptFile {
  /** Where it goes in the pack. */
  path: string;
  /** Where it was in the archive. */
  from: string;
  bytes: number;
}

export interface DroppedFile {
  path: string;
  why: string;
  script: boolean;
}

export interface SkillArchive {
  /** SKILL.md's front matter. */
  name: string;
  description: string;
  /** SKILL.md, references and item files (items not yet normalised), at their pack paths. */
  files: PackFiles;
  kept: KeptFile[];
  dropped: DroppedFile[];
  /** A myKx skill.json found in the archive, if it parses. */
  manifest: unknown | null;
}

const ZIP_MAGIC = [0x50, 0x4b];

/** A safe pack file name: letters, digits, dots, hyphens and underscores. */
const safeName = (s: string) =>
  s
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80) || "file";

/** Reads a .zip or .skill archive. Throws an Error with a plain message an admin can act on. */
export function readSkillArchive(bytes: Uint8Array): SkillArchive {
  if (bytes.length > MAX_ZIP_BYTES) throw new Error(`The file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.`);
  if (bytes[0] !== ZIP_MAGIC[0] || bytes[1] !== ZIP_MAGIC[1]) throw new Error("That isn't a zip archive (a .skill file is a zip of the skill's folder).");
  // First pass: names and sizes only (nothing is decompressed), to find the skill's folder.
  const entries: UnzipFileInfo[] = [];
  try {
    unzipSync(bytes, {
      filter: (f) => {
        entries.push(f);
        return false;
      },
    });
  } catch {
    throw new Error("The archive couldn't be read. Make it again as a plain .zip.");
  }
  if (entries.length > MAX_ENTRIES) throw new Error(`The archive has ${entries.length} files; the limit is ${MAX_ENTRIES}.`);
  const norm = (n: string) => n.replace(/\\/g, "/").replace(/^\.\//, "");
  const files = entries.filter((e) => !e.name.endsWith("/") && !JUNK.test(norm(e.name)));
  const skillMds = files.map((e) => norm(e.name)).filter((n) => /(?:^|\/)SKILL\.md$/.test(n) && !n.includes(".."));
  if (!skillMds.length) throw new Error("No SKILL.md in the archive. A skill needs a SKILL.md with a name and description in its front matter.");
  const top = skillMds.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0];
  const root = top.slice(0, top.length - "SKILL.md".length);

  const dropped: DroppedFile[] = [];
  const wanted = new Map<string, { to: string; json: boolean }>();
  let total = 0;
  for (const e of files) {
    const name = norm(e.name);
    const drop = (why: string, script = false) => dropped.push({ path: name, why, script });
    if (name.startsWith("/") || name.split("/").includes("..")) {
      drop("unsafe path");
      continue;
    }
    if (!name.startsWith(root)) {
      drop("outside the skill's folder");
      continue;
    }
    const rel = name.slice(root.length);
    if (SCRIPT.test(rel) || /^(?:scripts|bin|tools)\//i.test(rel)) {
      drop("a script: scripts are never kept or run", true);
      continue;
    }
    if (e.originalSize > MAX_ENTRY_BYTES) {
      drop("over 1 MB");
      continue;
    }
    let to: string | null = null;
    let json = false;
    if (rel === "SKILL.md") to = "SKILL.md";
    else if (rel === "skill.json") {
      to = "skill.json";
      json = true;
    } else if (/\.md$/i.test(rel)) to = `references/${safeName(rel.replace(/^references\//i, "").replace(/\.md$/i, "").replace(/\//g, "-"))}.md`;
    else if (/\.json$/i.test(rel)) {
      to = `items/${safeName(rel.replace(/^items\//i, "").replace(/\.json$/i, "").replace(/\//g, "-"))}.json`;
      json = true;
    }
    if (!to) {
      drop("not text a pack uses: only SKILL.md, Markdown and item JSON are kept");
      continue;
    }
    if ([...wanted.values()].some((w) => w.to === to)) {
      drop(`a second file named ${to}`);
      continue;
    }
    total += e.originalSize;
    if (total > MAX_TEXT_BYTES) {
      drop("over the 3 MB of text a pack may hold");
      continue;
    }
    wanted.set(name, { to, json });
  }

  let out: Record<string, Uint8Array>;
  try {
    out = unzipSync(bytes, { filter: (f) => wanted.has(norm(f.name)) });
  } catch {
    throw new Error("The archive couldn't be unpacked. Make it again as a plain .zip.");
  }
  const result: PackFiles = {};
  const kept: KeptFile[] = [];
  let manifest: unknown | null = null;
  for (const [rawName, data] of Object.entries(out)) {
    const name = norm(rawName);
    const w = wanted.get(name);
    if (!w) continue;
    let text: string;
    try {
      text = strFromU8(data).replace(/\r\n/g, "\n").replace(/^﻿/, "");
    } catch {
      dropped.push({ path: name, why: "not UTF-8 text", script: false });
      continue;
    }
    if (w.to === "skill.json") {
      try {
        manifest = JSON.parse(text);
      } catch {
        dropped.push({ path: name, why: "skill.json isn't valid JSON", script: false });
      }
      continue;
    }
    if (w.json) {
      try {
        const parsed = JSON.parse(text) as unknown;
        const list = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { items?: unknown })?.items) ? (parsed as { items: unknown[] }).items : null;
        if (!list || !list.length || !list.every((x) => x && typeof x === "object" && typeof (x as { stem?: unknown }).stem === "string")) {
          dropped.push({ path: name, why: "JSON that isn't a list of questions", script: false });
          continue;
        }
        text = `${JSON.stringify(list, null, 2)}\n`;
      } catch {
        dropped.push({ path: name, why: "not valid JSON", script: false });
        continue;
      }
    }
    result[w.to] = text;
    kept.push({ path: w.to, from: name, bytes: data.length });
  }
  const fm = frontMatter(result["SKILL.md"] ?? "");
  if (!fm) throw new Error("SKILL.md needs front matter with a name and a description (--- name: … description: … ---).");
  return { name: fm.name, description: fm.description, files: result, kept: kept.sort((a, b) => a.path.localeCompare(b.path)), dropped, manifest };
}

// ─── The manifest ──────────────────────────────────────────────────────────

/** What Muse proposes from SKILL.md when the archive has no myKx skill.json (structured output; Standard model). */
export const manifestProposalSchema = z.strictObject({
  title: z.string().max(60),
  description: z.string().max(300),
  level: z.enum(SKILL_LEVELS),
  subject: z.enum(SKILL_SUBJECTS),
  tier: z.enum(SKILL_TIERS).nullable(),
  syllabus: z.string().max(100),
  language: z.string().max(12),
  topics: z
    .array(z.strictObject({ title: z.string().max(60), subskills: z.array(z.string().max(40)).max(6) }))
    .min(1)
    .max(15),
  agents: z.strictObject({ tutor: AgentSkillModeSchema, vibe: AgentSkillModeSchema, parent: AgentSkillModeSchema, curator: AgentSkillModeSchema }),
});
export type ManifestProposal = z.infer<typeof manifestProposalSchema>;

export function manifestPrompt(a: SkillArchive): { system: string; user: string } {
  const refs = Object.entries(a.files).filter(([p]) => p.startsWith("references/"));
  return {
    system: [
      "You catalogue teaching skills for myKx, a Singapore learning app (MOE syllabus). From an agent skill's SKILL.md and references, propose its catalogue entry as JSON.",
      "level: the school level it teaches (P1-P6, Sec 1-Sec 4). subject: maths, science, english or chinese (the closest). tier: standard or foundation for PSLE, g1/g2/g3 for a secondary subject level, null if it doesn't say. language: a BCP 47 code (en, zh-Hans, ms, ta).",
      "topics: the syllabus topics it covers, 1 to 15, each with up to 6 short subskills. agents: which myKx agents may load it: tutor (the question player's hints), vibe (flashcards), parent (the evening summary), curator (the knowledge agent); auto, on_demand or off.",
      "Never include a person's name, a school or an exam paper's name.",
    ].join("\n"),
    user: [`Skill name: ${a.name}`, `Description: ${a.description}`, "", "SKILL.md:", (a.files["SKILL.md"] ?? "").slice(0, 6000), "", ...refs.slice(0, 8).map(([p, t]) => `${p}:\n${t.slice(0, 1200)}`)].join("\n"),
  };
}

/** A guess without Muse (no key, or the call failed): level and subject from the name, topics from the references. */
export function fallbackProposal(a: SkillArchive): ManifestProposal {
  const text = `${a.name} ${a.description}`.toLowerCase();
  const p = /\bp(?:rimary)?\s*-?([1-6])\b/.exec(text);
  const s = /\bsec(?:ondary)?\s*-?([1-4])\b/.exec(text);
  const level = (s ? `Sec ${s[1]}` : p ? `P${p[1]}` : "P6") as SkillLevel;
  const subject = (SKILL_SUBJECTS.find((x) => text.includes(x === "maths" ? "math" : x)) ?? "maths") as SkillSubject;
  const titles = Object.entries(a.files)
    .filter(([path]) => path.startsWith("references/"))
    .map(([, t]) => /^# (.+)$/m.exec(t)?.[1]?.trim())
    .filter((x): x is string => Boolean(x))
    .slice(0, 10);
  return {
    title: a.name.slice(0, 60),
    description: a.description.slice(0, 300),
    level,
    subject,
    tier: /foundation/.test(text) ? "foundation" : null,
    syllabus: "MOE syllabus",
    language: subject === "chinese" ? "zh-Hans" : "en",
    topics: (titles.length ? titles : [a.name]).map((title) => ({ title: title.slice(0, 60), subskills: ["core"] })),
    agents: { tutor: "auto", vibe: "on_demand", parent: "on_demand", curator: "auto" },
  };
}

/** The fields an admin edits before "Import as draft". */
export interface ImportFields {
  id: string;
  title: string;
  description: string;
  level: SkillLevel;
  subject: SkillSubject;
  tier: SkillTier | null;
  syllabus: string;
  language: string;
  /** One topic per entry; ids are made from titles when missing. */
  topics: { id?: string; title: string; subskills: string[] }[];
  agents: SkillManifest["agents"];
  sourceKind: "own" | "licensed";
  licence: string;
}

export const importFieldsSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/),
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().min(10).max(400),
  level: z.enum(SKILL_LEVELS),
  subject: z.enum(SKILL_SUBJECTS),
  tier: z.enum(SKILL_TIERS).nullable(),
  syllabus: z.string().trim().min(1).max(100),
  language: z.string().trim().min(2).max(12),
  topics: z
    .array(z.strictObject({ id: z.string().max(60).optional(), title: z.string().trim().min(1).max(60), subskills: z.array(z.string().max(40)).max(8) }))
    .min(1)
    .max(20),
  agents: z.strictObject({ tutor: AgentSkillModeSchema, vibe: AgentSkillModeSchema, parent: AgentSkillModeSchema, curator: AgentSkillModeSchema }),
  sourceKind: z.enum(["own", "licensed"]),
  licence: z.string().trim().min(1).max(200),
});

export const slugId = (s: string, sep = "_") =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, "g"), "")
    .slice(0, 40) || "topic";

/** "English" → "en", "Chinese" → "zh-Hans": a BCP 47 code for the manifest, whatever the proposal said. */
export function languageCode(said: string, subject: string): string {
  const s = said.trim().toLowerCase();
  if (/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/i.test(said.trim()) && s.length <= 12) return said.trim();
  if (s.startsWith("chin") || s.startsWith("mandarin") || subject === "chinese") return "zh-Hans";
  if (s.startsWith("malay")) return "ms";
  if (s.startsWith("tamil")) return "ta";
  return "en";
}

/** The pack id a level and subject suggest ("p5-maths"), with the skill's name added when that id is taken. */
export function suggestPackId(level: string, subject: string, name: string, taken: readonly string[]): string {
  const base = `${levelPrefix(level)}${subject}`;
  if (!taken.includes(base)) return base;
  const named = `${base}-${slugId(name, "-")}`.slice(0, 40).replace(/-+$/, "");
  return taken.includes(named) ? `${named.slice(0, 36)}-${taken.length}` : named;
}

/** The admin's fields as a starting point: from the archive's own skill.json when it has one, else from Muse. */
export function fieldsFrom(a: SkillArchive, proposal: ManifestProposal, taken: readonly string[]): ImportFields {
  const own = SkillManifestSchema.safeParse(a.manifest);
  if (own.success) {
    const m = own.data;
    return { id: m.id, title: m.title, description: m.description, level: m.level, subject: m.subject, tier: m.tier ?? null, syllabus: m.syllabus, language: m.language, topics: m.topics.map((t) => ({ id: t.id, title: t.title, subskills: t.subskills })), agents: m.agents, sourceKind: "own", licence: m.licence };
  }
  return {
    id: suggestPackId(proposal.level, proposal.subject, a.name, taken),
    title: proposal.title || a.name,
    description: (proposal.description || a.description).slice(0, 400).padEnd(10, "."),
    level: proposal.level,
    subject: proposal.subject,
    tier: proposal.tier,
    syllabus: proposal.syllabus || "MOE syllabus",
    language: languageCode(proposal.language, proposal.subject),
    topics: proposal.topics.map((t) => ({ title: t.title, subskills: t.subskills })),
    agents: proposal.agents,
    sourceKind: "own",
    licence: "As supplied with the imported skill",
  };
}

/** The imported pack's files: SKILL.md and references as they came, items in myKx's format (as drafts, for the admin
 *  to review), and a manifest from the admin's fields. Returns what it left out of the item files, with why. */
export function buildImportedPack(a: SkillArchive, f: ImportFields, version: string, archiveName: string, dateIso: string): { files: PackFiles; skippedItems: string[] } {
  const own = SkillManifestSchema.safeParse(a.manifest);
  const topics = f.topics.map((t) => ({
    id: t.id && /^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(t.id) ? t.id : slugId(t.title),
    title: t.title,
    weight: Math.floor((1 / f.topics.length) * 1000) / 1000,
    subskills: [...new Set((t.subskills.length ? t.subskills : ["core"]).map((s) => slugId(s)))],
  }));
  // Topic ids must be unique.
  topics.forEach((t, i) => {
    if (topics.findIndex((x) => x.id === t.id) !== i) t.id = `${t.id}_${i + 1}`;
  });
  const manifest: SkillManifest = {
    id: f.id,
    version,
    status: "draft",
    title: f.title,
    description: f.description,
    subject: f.subject,
    level: f.level,
    ...(f.tier ? { tier: f.tier } : {}),
    syllabus: f.syllabus,
    language: f.language,
    agents: f.agents,
    topics,
    archetypes: own.success ? own.data.archetypes.filter((x) => topics.some((t) => t.id === x.topic)) : [],
    references: [],
    tools: ["read_reference", "find_items", "check_answer"],
    sources: [{ kind: f.sourceKind, note: `Imported from ${archiveName.slice(0, 80)} in ${monthYear(dateIso)}; scripts and other files were dropped, never kept or run.` }],
    licence: f.licence,
    excluded: a.dropped.map((d) => d.path).slice(0, 60),
    legacy_scripts: { note: "kept privately; never executed", files: [] },
  };
  const files: PackFiles = { "SKILL.md": a.files["SKILL.md"] };
  for (const [p, t] of Object.entries(a.files)) if (p.startsWith("references/")) files[p] = t;
  const skippedItems: string[] = [];
  const known = new Map(topics.map((t) => [t.id, t]));
  for (const [p, t] of Object.entries(a.files)) {
    if (!p.startsWith("items/")) continue;
    const kept: SkillItem[] = [];
    (JSON.parse(t) as Record<string, unknown>[]).forEach((raw, i) => {
      const topic = known.get(String(raw.topic ?? "")) ?? topics[0];
      const candidate = {
        ...raw,
        id: typeof raw.id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(raw.id) ? raw.id : `${f.id}-im-${i + 1}`,
        skill: f.id,
        topic: topic.id,
        subskill: typeof raw.subskill === "string" && topic.subskills.includes(raw.subskill) ? raw.subskill : topic.subskills[0],
        status: "draft",
        version_added: version,
        source: { kind: f.sourceKind, ref: `import ${archiveName.slice(0, 60)}` },
      } as Record<string, unknown>;
      delete candidate.reviewed_by;
      delete candidate.figure;
      delete candidate.archetype;
      const parsed = SkillItemSchema.safeParse(candidate);
      if (parsed.success) kept.push(parsed.data as SkillItem);
      else skippedItems.push(`${p} #${i + 1}: ${parsed.error.issues[0]?.message ?? "not a myKx item"}`);
    });
    if (kept.length) files[p] = `${JSON.stringify(kept, null, 2)}\n`;
  }
  files["skill.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
  return { files: syncReferences(files), skippedItems };
}
