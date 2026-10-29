// Skill versions (founder, 29 Oct): the default can't be deleted, the published version is the newest published row,
// restore makes a new published row, delete falls back, and every saved version passes the schemas and the scanner.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";
import { clearSkillOverrides, diskPackFiles, packFile } from "./overrides.ts";
import { loadPack } from "./runtime.ts";
import { deletePack, deleteVersion, publishDraft, restoreVersion, saveDraft } from "./service.ts";
import { canDelete, checkPack, draftOf, nextPackVersion, publishedOf, safetyProblems, syncReferences, withManifest, type SkillVersion } from "./versions.ts";

const row = (o: Partial<SkillVersion>): SkillVersion => ({ id: crypto.randomUUID(), packId: "p6-maths", version: "1.1.0", files: {}, status: "published", source: "edit", note: null, createdBy: null, createdAt: "2026-10-29T01:00:00Z", publishedAt: "2026-10-29T01:00:00Z", deletedAt: null, ...o });

describe("version rules", () => {
  it("numbers one minor up from the default and every row, deleted ones too; a first import is 1.0.0", () => {
    expect(nextPackVersion("1.0.0", [])).toBe("1.1.0");
    expect(nextPackVersion("1.0.0", [{ version: "1.1.0" }, { version: "1.9.0" }])).toBe("1.10.0");
    expect(nextPackVersion("1.0.0", [row({ version: "1.3.0", deletedAt: "2026-10-29T02:00:00Z" })])).toBe("1.4.0");
    expect(nextPackVersion(null, [])).toBe("1.0.0");
  });

  it("publishes the newest non-deleted published row, else the default (null)", () => {
    const a = row({ version: "1.1.0", publishedAt: "2026-10-29T01:00:00Z" });
    const b = row({ version: "1.2.0", publishedAt: "2026-10-29T03:00:00Z" });
    const restored = row({ version: "1.3.0", publishedAt: "2026-10-29T02:00:00Z" });
    expect(publishedOf([a, b, restored], "p6-maths")?.version).toBe("1.2.0");
    expect(publishedOf([a, { ...b, deletedAt: "2026-10-29T04:00:00Z" }], "p6-maths")?.version).toBe("1.1.0");
    expect(publishedOf([row({ status: "draft", publishedAt: null })], "p6-maths")).toBeNull();
    expect(draftOf([a, row({ status: "draft", publishedAt: null, version: "1.4.0" })], "p6-maths")?.version).toBe("1.4.0");
  });

  it("never deletes the default (it isn't a row), and asks for the whole pack before an imported pack's last version", () => {
    const only = row({ packId: "p5-maths" });
    expect(canDelete([only], "default", true)).toMatchObject({ ok: false });
    expect(canDelete([only], only.id, true)).toEqual({ ok: true });
    expect(canDelete([only], only.id, false)).toMatchObject({ ok: false });
    expect(canDelete([only, row({ packId: "p5-maths", version: "1.2.0" })], only.id, false)).toEqual({ ok: true });
  });

  it("holds every version to the packs' own rules: the default passes, a broken item or a child's name doesn't", () => {
    const disk = diskPackFiles("p6-maths")!;
    expect(checkPack(disk, "p6-maths", () => true).problems).toEqual([]);
    expect(safetyProblems(disk)).toEqual([]);
    const broken = { ...disk, "items/new.json": JSON.stringify([{ id: "x1", skill: "p6-maths", stem: "?" }]) };
    expect(checkPack(broken, "p6-maths", () => true).problems.map((p) => p.path)).toContain("items/new.json");
    expect(checkPack(disk, "p3-maths", () => true).problems.some((p) => /id is "p6-maths"/.test(p.message))).toBe(true);
    const named = { ...disk, "references/notes.md": "# Notes\n\n## One\n\nLeonard always forgets units.\n" };
    expect(safetyProblems(named)).toEqual([expect.objectContaining({ path: "references/notes.md", line: 5 })]);
  });

  it("lists a new reference in the manifest with its sections, and keeps the disk formatting", () => {
    const disk = diskPackFiles("p6-maths")!;
    expect(syncReferences(disk)).toBe(disk); // nothing changed: the same object back
    const next = syncReferences({ ...disk, "references/bars.md": "# Drawing bars\n\n## Same length first\n\nText.\n" });
    const m = JSON.parse(next["skill.json"]);
    expect(m.references.at(-1)).toEqual({ file: "references/bars.md", title: "Drawing bars", sections: ["Same length first"] });
    expect(JSON.parse(withManifest(disk, { version: "1.4.0" })["skill.json"]).version).toBe("1.4.0");
    expect(withManifest(disk, { version: JSON.parse(disk["skill.json"]).version })["skill.json"]).toBe(disk["skill.json"]);
  });
});

describe("saving, publishing, restoring and deleting (demo store)", () => {
  let store: DemoStore;
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    store = resetDemoStore();
    clearSkillOverrides();
  });
  afterEach(() => {
    clearSkillOverrides();
    vi.unstubAllEnvs();
  });

  it("serves a published edit, falls back when it's deleted, and restores the default as a new version", async () => {
    const disk = diskPackFiles("p6-maths")!;
    // Versions follow the pack on disk (its default), whatever it is: the first saved draft is one minor up.
    const base = JSON.parse(disk["skill.json"]).version as string;
    const first = nextPackVersion(base, []);
    const second = nextPackVersion(base, [{ version: first }]);
    const edited = `${disk["SKILL.md"].replace("# P6 Maths (PSLE)", "# P6 Maths (PSLE), edited")}`;
    const saved = await saveDraft(store, { packId: "p6-maths", base: "default", changes: { "SKILL.md": edited }, note: null, source: "edit", by: "admin" });
    expect(saved).toMatchObject({ ok: true, value: { version: first, status: "draft" } });
    // A draft isn't served.
    expect(loadPack("p6-maths")?.core).not.toContain("edited");
    // Saving again updates the same draft.
    const again = await saveDraft(store, { packId: "p6-maths", base: "default", changes: { "SKILL.md": `${edited}\nMore.\n` }, note: null, source: "edit", by: "admin" });
    expect(again.ok && saved.ok && again.value.id === saved.value.id).toBe(true);
    if (!saved.ok) return;
    const pub = await publishDraft(store, { packId: "p6-maths", id: saved.value.id });
    expect(pub).toMatchObject({ ok: true, value: { status: "published" } });
    expect(loadPack("p6-maths")?.version).toBe(first);
    expect(loadPack("p6-maths")?.core).toContain("edited");
    expect(JSON.parse(packFile("p6-maths", "skill.json")!).version).toBe(first);

    const restored = await restoreVersion(store, { packId: "p6-maths", from: "default", by: "admin" });
    expect(restored).toMatchObject({ ok: true, value: { version: second, source: "restore", status: "published" } });
    expect(loadPack("p6-maths")?.core).not.toContain("edited");
    if (!restored.ok) return;
    expect(await deleteVersion(store, { packId: "p6-maths", id: restored.value.id })).toMatchObject({ ok: true });
    expect(loadPack("p6-maths")?.core).toContain("edited"); // falls back to the first edit
    expect(await deleteVersion(store, { packId: "p6-maths", id: saved.value.id })).toMatchObject({ ok: true });
    expect(loadPack("p6-maths")?.version).toBe(base); // and then to the default
    expect(await deletePack(store, { packId: "p6-maths" })).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses to save or publish what fails the schemas or the safety scanner, with the reasons", async () => {
    const bad = await saveDraft(store, { packId: "p6-maths", base: "default", changes: { "skill.json": "{ not json", "references/x.md": "# X\n\n## Y\n\nAbby's notes.\n" }, note: null, source: "edit", by: "admin" });
    expect(bad).toMatchObject({ ok: false, status: 422 });
    if (bad.ok) return;
    expect(bad.problems?.map((p) => p.path).sort()).toEqual(["references/x.md", "skill.json"]);
    expect((await store.skillVersions.list("p6-maths")).length).toBe(0);
    expect(await saveDraft(store, { packId: "p9-nothing", base: "default", changes: {}, note: null, source: "edit", by: "admin" })).toMatchObject({ ok: false, status: 404 });
  });
});
