// The skill-version override layer (founder, 29 Oct). Every reader of skill packs (the Skill Engine runtime, Ask
// Kix's teaching notes, the reason coach, the Vibe Zone, printable papers, the admin catalogue, the knowledge agent's
// routing) reads pack files through the accessors here, so they all see the same thing: a pack's published version
// from `skill_versions` when it has one, else the pack on disk (the default). Imported packs exist only as rows.
//
// Routes call `refreshSkillOverrides(store)` before they use packs: it loads the published versions into a short-lived
// cache (60 s, and at once after a publish, restore or delete), and the accessors below are synchronous, so the
// existing loaders keep their shape. A store without the table (migration not applied) or a failing read leaves the
// disk packs in charge. Server only (node:fs).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuthStore } from "../auth/store.ts";
import { isPackPath, PACK_ID, type PackFiles } from "./versions.ts";

export interface PublishedOverride {
  packId: string;
  version: string;
  versionId: string;
  files: PackFiles;
}

const TTL_MS = 60_000;
let state: { at: number; gen: number; byPack: Map<string, PublishedOverride> } = { at: 0, gen: 0, byPack: new Map() };
let inflight: Promise<void> | null = null;

/** Replaces the cache (after a refresh, a publish, or in tests). Bumps the generation so loaders drop what they hold. */
export function setSkillOverrides(list: readonly PublishedOverride[], now = Date.now()): void {
  state = { at: now, gen: state.gen + 1, byPack: new Map(list.map((o) => [o.packId, o])) };
}

/** Back to the packs on disk only. */
export function clearSkillOverrides(): void {
  setSkillOverrides([], 0);
}

/** Changes whenever the overrides change: caches of parsed packs key on it. */
export function overridesGeneration(): number {
  return state.gen;
}

/** Loads the published versions from the store if the cache is older than 60 s (or `force`). Never throws. */
export async function refreshSkillOverrides(store: AuthStore | null | undefined, o: { force?: boolean; now?: number } = {}): Promise<void> {
  if (!store) return;
  const now = o.now ?? Date.now();
  if (!o.force && state.at && now - state.at < TTL_MS) return;
  if (inflight && !o.force) return inflight;
  const run = (async () => {
    try {
      const rows = await store.skillVersions.published();
      setSkillOverrides(
        rows.map((r) => ({ packId: r.packId, version: r.version, versionId: r.id, files: r.files })),
        now,
      );
    } catch {
      state = { ...state, at: now }; // keep what we had; try again after the TTL
    }
  })();
  inflight = run;
  try {
    await run;
  } finally {
    if (inflight === run) inflight = null;
  }
}

/** The published override of a pack, or null when the disk default is in charge. */
export function skillOverride(packId: string): PublishedOverride | null {
  return state.byPack.get(packId) ?? null;
}

const skillsDir = (root: string) => join(root, "content", "skills");

/** Packs on disk (folders with a skill.json). */
export function diskPackIds(root = process.cwd()): string[] {
  const dir = skillsDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => PACK_ID.test(d) && existsSync(join(dir, d, "skill.json")))
    .sort();
}

export function hasDiskPack(packId: string, root = process.cwd()): boolean {
  return PACK_ID.test(packId) && existsSync(join(skillsDir(root), packId, "skill.json"));
}

/** Every pack id: on disk, plus imported packs that have a published version. */
export function allPackIds(root = process.cwd()): string[] {
  return [...new Set([...diskPackIds(root), ...state.byPack.keys()])].sort();
}

/** One file of a pack as the runtime should see it: from the published version when there is one, else from disk. */
export function packFile(packId: string, rel: string, root = process.cwd()): string | null {
  if (!PACK_ID.test(packId) || rel.includes("..")) return null;
  const o = skillOverride(packId);
  if (o) return o.files[rel] ?? null;
  const p = join(skillsDir(root), packId, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/** The files in `items/` or `references/` (paths like `items/demo.json`), sorted. */
export function packFilesIn(packId: string, dir: "items" | "references", root = process.cwd()): string[] {
  if (!PACK_ID.test(packId)) return [];
  const o = skillOverride(packId);
  const ext = dir === "items" ? ".json" : ".md";
  if (o) return Object.keys(o.files).filter((p) => p.startsWith(`${dir}/`) && p.endsWith(ext)).sort();
  const d = join(skillsDir(root), packId, dir);
  return existsSync(d)
    ? readdirSync(d)
        .filter((f) => f.endsWith(ext))
        .sort()
        .map((f) => `${dir}/${f}`)
    : [];
}

/** The default version of a disk pack, as a version's files (text files only; figures stay on disk). */
export function diskPackFiles(packId: string, root = process.cwd()): PackFiles | null {
  if (!hasDiskPack(packId, root)) return null;
  const dir = join(skillsDir(root), packId);
  const files: PackFiles = {};
  for (const rel of ["skill.json", "SKILL.md"]) if (existsSync(join(dir, rel))) files[rel] = readFileSync(join(dir, rel), "utf8");
  for (const sub of ["references", "items"] as const) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).sort()) {
      const rel = `${sub}/${f}`;
      if (isPackPath(rel)) files[rel] = readFileSync(join(d, f), "utf8");
    }
  }
  return files;
}

/** Whether a figure an item points at exists on disk for this pack (versions never carry figures). */
export function figureOnDisk(packId: string, rel: string, root = process.cwd()): boolean {
  return PACK_ID.test(packId) && /^figures\/[A-Za-z0-9._-]+$/.test(rel) && existsSync(join(skillsDir(root), packId, rel));
}
