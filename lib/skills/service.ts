// Server only: the skill-version actions behind Admin → Skills (save a draft, publish, restore, delete, a whole new
// published version from the knowledge agent), with the rules from lib/skills/versions.ts. Every version is checked
// (schemas and the safety scanner) before it is written, and the override cache is refreshed after anything that
// changes what Kix reads. The routes check the admin flag and the PIN first, and audit every action.
import { randomUUID } from "node:crypto";
import type { AuthStore } from "../auth/store.ts";
import { SkillTablesMissingError } from "../auth/store.ts";
import { diskPackFiles, figureOnDisk, hasDiskPack, refreshSkillOverrides } from "./overrides.ts";
import { applyChanges, canDelete, draftOf, nextPackVersion, publishedOf, syncReferences, versionProblems, withManifest, type FileProblem, type PackFiles, type SkillVersion, type SkillVersionMeta, type VersionSource } from "./versions.ts";

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; reason: string; note?: string; problems?: FileProblem[] };

const refuse = (status: number, reason: string, note?: string, problems?: FileProblem[]): Outcome<never> => ({ ok: false, status, reason, ...(note ? { note } : {}), ...(problems ? { problems } : {}) });

export const MIGRATION_NOTE = "Skill versions need the SQL in supabase/migrations/20261030_skill_versions.sql. Run it in Supabase's SQL editor, then try again.";

/** Turns a missing-table error into a 503 the admin can act on; anything else is rethrown. */
export async function guarded<T>(fn: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SkillTablesMissingError) return refuse(503, "not-configured", MIGRATION_NOTE);
    throw e;
  }
}

export interface PackVersions {
  packId: string;
  hasDefault: boolean;
  defaultVersion: string | null;
  rows: SkillVersionMeta[];
  published: SkillVersionMeta | null;
  draft: SkillVersionMeta | null;
}

export async function packVersions(store: AuthStore, packId: string): Promise<PackVersions> {
  const rows = await store.skillVersions.list(packId);
  const disk = diskPackFiles(packId);
  let defaultVersion: string | null = null;
  try {
    defaultVersion = disk ? ((JSON.parse(disk["skill.json"]) as { version?: string }).version ?? null) : null;
  } catch {
    defaultVersion = null;
  }
  return { packId, hasDefault: Boolean(disk), defaultVersion, rows, published: publishedOf(rows, packId), draft: draftOf(rows, packId) };
}

/** A version's files: "default" (the pack on disk) or a row's id. */
export async function versionFiles(store: AuthStore, packId: string, ref: string): Promise<PackFiles | null> {
  if (ref === "default") return diskPackFiles(packId);
  const v = await store.skillVersions.get(ref);
  return v && v.packId === packId && !v.deletedAt ? v.files : null;
}

/** What Kix reads now: the published version, else the default. */
export async function currentFiles(store: AuthStore, packId: string): Promise<{ ref: string; version: string | null; files: PackFiles } | null> {
  const pv = await packVersions(store, packId);
  if (pv.published) {
    const files = await versionFiles(store, packId, pv.published.id);
    if (files) return { ref: pv.published.id, version: pv.published.version, files };
  }
  const disk = diskPackFiles(packId);
  return disk ? { ref: "default", version: pv.defaultVersion, files: disk } : null;
}

const check = (packId: string, files: PackFiles) => versionProblems(files, packId, (p) => figureOnDisk(packId, p));

/** Marks items reviewed by this admin (the editor's "mark reviewed"). */
export function markReviewed(files: PackFiles, ids: readonly string[], by: string): PackFiles {
  if (!ids.length) return files;
  const want = new Set(ids);
  const out = { ...files };
  for (const [p, t] of Object.entries(files)) {
    if (!p.startsWith("items/")) continue;
    try {
      const list = JSON.parse(t) as { id?: string; status?: string; reviewed_by?: string }[];
      if (!Array.isArray(list) || !list.some((i) => i.id && want.has(i.id))) continue;
      out[p] = `${JSON.stringify(
        list.map((i) => (i.id && want.has(i.id) && i.status === "draft" ? { ...i, status: "reviewed", reviewed_by: by } : i)),
        null,
        2,
      )}\n`;
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Saves the admin's changes as the pack's draft: on top of `base` (the default, or a version), into the open draft
 * if there is one (Save draft again updates it), else a new draft with the next version number. Refused with the
 * reasons when the result doesn't pass the schemas or the safety scanner.
 */
export async function saveDraft(store: AuthStore, o: { packId: string; base: string; changes: Record<string, string | null>; markReviewedIds?: string[]; note: string | null; source: VersionSource; by: string; now?: string }): Promise<Outcome<SkillVersion>> {
  return guarded(async () => {
    const pv = await packVersions(store, o.packId);
    if (!pv.hasDefault && !pv.rows.some((r) => !r.deletedAt)) return refuse(404, "not-found", "No such pack.");
    const baseFiles = await versionFiles(store, o.packId, o.base);
    if (!baseFiles) return refuse(404, "not-found", "That version isn't there any more.");
    const version = pv.draft?.version ?? nextPackVersion(pv.defaultVersion, pv.rows);
    const files = withManifest(syncReferences(markReviewed(applyChanges(baseFiles, o.changes), o.markReviewedIds ?? [], o.by)), { version });
    const problems = check(o.packId, files);
    if (problems.length) return refuse(422, "invalid", "Fix these before saving.", problems);
    const now = o.now ?? new Date().toISOString();
    if (pv.draft) {
      const updated = await store.skillVersions.update(pv.draft.id, { files, note: o.note ?? pv.draft.note });
      if (updated) return { ok: true, value: updated };
    }
    const v: SkillVersion = { id: randomUUID(), packId: o.packId, version, files, status: "draft", source: o.source, note: o.note, createdBy: o.by, createdAt: now, publishedAt: null, deletedAt: null };
    await store.skillVersions.save(v);
    return { ok: true, value: v };
  });
}

/** A whole new version in one step (an import's first draft, or the knowledge agent's refinement). */
export async function createVersion(store: AuthStore, o: { packId: string; files: PackFiles; status: "draft" | "published"; source: VersionSource; note: string | null; by: string; version?: string; now?: string }): Promise<Outcome<SkillVersion>> {
  return guarded(async () => {
    const pv = await packVersions(store, o.packId);
    const version = o.version ?? nextPackVersion(pv.defaultVersion, pv.rows);
    const files = withManifest(syncReferences(o.files), o.status === "published" ? { version, status: "published" } : { version });
    const problems = check(o.packId, files);
    if (problems.length) return refuse(422, "invalid", o.status === "published" ? "Publishing was refused." : "Fix these first.", problems);
    const now = o.now ?? new Date().toISOString();
    const v: SkillVersion = { id: randomUUID(), packId: o.packId, version, files, status: o.status, source: o.source, note: o.note, createdBy: o.by, createdAt: now, publishedAt: o.status === "published" ? now : null, deletedAt: null };
    await store.skillVersions.save(v);
    if (o.status === "published") await refreshSkillOverrides(store, { force: true });
    return { ok: true, value: v };
  });
}

/** Publishes a draft: it must pass every check again; Kix reads it from the next request on. */
export async function publishDraft(store: AuthStore, o: { packId: string; id: string; now?: string }): Promise<Outcome<SkillVersion>> {
  return guarded(async () => {
    const v = await store.skillVersions.get(o.id);
    if (!v || v.packId !== o.packId || v.deletedAt) return refuse(404, "not-found", "That version isn't there any more.");
    if (v.status === "published") return refuse(409, "not-allowed", "It's already published. Restore it to make it the one Kix reads.");
    const files = withManifest(v.files, { status: "published" });
    const problems = check(o.packId, files);
    if (problems.length) return refuse(422, "invalid", "Publishing was refused.", problems);
    const updated = await store.skillVersions.update(v.id, { files, status: "published", publishedAt: o.now ?? new Date().toISOString() });
    await refreshSkillOverrides(store, { force: true });
    return updated ? { ok: true, value: updated } : refuse(404, "not-found");
  });
}

/** Restore: a new published version with an older version's files (or the default's). */
export async function restoreVersion(store: AuthStore, o: { packId: string; from: string; by: string; now?: string }): Promise<Outcome<SkillVersion>> {
  return guarded(async () => {
    const files = await versionFiles(store, o.packId, o.from);
    if (!files) return refuse(404, "not-found", "That version isn't there any more.");
    const pv = await packVersions(store, o.packId);
    const label = o.from === "default" ? `the default v${pv.defaultVersion ?? "1.0.0"}` : `v${pv.rows.find((r) => r.id === o.from)?.version ?? "?"}`;
    return createVersion(store, { packId: o.packId, files, status: "published", source: "restore", note: `Restored ${label}`, by: o.by, now: o.now });
  });
}

/** Deletes one version (never the default). Deleting the published one falls back to the one before, or the default. */
export async function deleteVersion(store: AuthStore, o: { packId: string; id: string; now?: string }): Promise<Outcome<{ deleted: number }>> {
  return guarded(async () => {
    const pv = await packVersions(store, o.packId);
    const allowed = canDelete(
      pv.rows.filter((r) => r.packId === o.packId),
      o.id,
      pv.hasDefault,
    );
    if (!allowed.ok) return refuse(409, "not-allowed", allowed.reason);
    const deleted = await store.skillVersions.remove([o.id], o.now ?? new Date().toISOString());
    await refreshSkillOverrides(store, { force: true });
    return { ok: true, value: { deleted } };
  });
}

/** Deletes an imported pack entirely (all its versions). Built-in packs can't be: their default stays. */
export async function deletePack(store: AuthStore, o: { packId: string; now?: string }): Promise<Outcome<{ deleted: number }>> {
  return guarded(async () => {
    if (hasDiskPack(o.packId)) return refuse(409, "not-allowed", "A built-in pack can't be deleted: its default version always stays.");
    const pv = await packVersions(store, o.packId);
    const live = pv.rows.filter((r) => !r.deletedAt).map((r) => r.id);
    if (!live.length) return refuse(404, "not-found", "No such pack.");
    const deleted = await store.skillVersions.remove(live, o.now ?? new Date().toISOString());
    await refreshSkillOverrides(store, { force: true });
    return { ok: true, value: { deleted } };
  });
}

/** Reads a JSON body up to `max` characters (skill files are bigger than lib/auth/http.ts readBody's 16 KB). */
export async function readLargeJson(request: Request, max = 2_500_000): Promise<unknown | null> {
  try {
    const text = await request.text();
    if (text.length > max) return null;
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

/** A refusal as the admin screens read it: `{ ok: false, reason, note?, problems? }`. */
export function outcomeResponse<T>(o: Outcome<T>, body: (v: T) => object): Response {
  if (o.ok) return Response.json({ ok: true, ...body(o.value) });
  return Response.json({ ok: false, reason: o.reason, ...(o.note ? { note: o.note } : {}), ...(o.problems ? { problems: o.problems.slice(0, 60) } : {}) }, { status: o.status });
}
