// The override layer: every pack reader sees a published version (or an imported pack) once the cache holds it, and
// the disk default otherwise; the cache refreshes at most once a minute unless forced, and a failing store never
// breaks a reader.
import { afterEach, describe, expect, it } from "vitest";
import type { AuthStore } from "../auth/store.ts";
import { packCards } from "../admin/hood.ts";
import { packNotes, teachingNotes } from "../kix/homework.ts";
import { packsOnDisk } from "../knowledge/packs.ts";
import { listPrintPacks, loadPrintBank } from "../print/bank.ts";
import { allPackIds, clearSkillOverrides, diskPackFiles, packFile, refreshSkillOverrides, setSkillOverrides, skillOverride } from "./overrides.ts";
import { loadPack, packsForChild, readSection } from "./runtime.ts";
import type { PackFiles, SkillVersion } from "./versions.ts";

const manifest = (o: Record<string, unknown> = {}) => ({
  id: "p5-maths",
  version: "1.0.0",
  status: "published",
  title: "P5 Fractions",
  description: "Primary 5 fractions of a set, with the model method.",
  subject: "maths",
  level: "P5",
  syllabus: "MOE syllabus",
  language: "en",
  agents: { tutor: "auto", vibe: "on_demand", parent: "on_demand", curator: "auto" },
  topics: [{ id: "fractions_of_a_set", title: "Fractions of a set", weight: 1, subskills: ["core"] }],
  archetypes: [],
  references: [{ file: "references/model-method.md", title: "The model method", sections: ["One fraction of a set"] }],
  tools: ["read_reference", "find_items", "check_answer"],
  sources: [{ kind: "own", note: "Imported" }],
  licence: "Test",
  excluded: [],
  legacy_scripts: { note: "kept privately; never executed", files: [] },
  ...o,
});
const item = { id: "p5m-1", skill: "p5-maths", topic: "fractions_of_a_set", subskill: "core", difficulty: 1, marks: 1, type: "short", stem: "What is 3/4 of 20?", answer: "15", source: { kind: "own", ref: "test" }, status: "reviewed", reviewed_by: "admin", version_added: "1.0.0" };
const imported: PackFiles = {
  "skill.json": JSON.stringify(manifest(), null, 2),
  "SKILL.md": "---\nname: p5-maths\ndescription: Fractions of a set.\n---\n# P5 Fractions\n\nDraw the bar first.\n",
  "references/model-method.md": "# The model method\n\n## One fraction of a set\n\nCut the bar into as many units as the denominator.\n",
  "items/set.json": JSON.stringify([item]),
};

afterEach(() => clearSkillOverrides());

describe("the override layer", () => {
  it("makes an imported pack visible to every reader", () => {
    expect(allPackIds()).not.toContain("p5-maths");
    setSkillOverrides([{ packId: "p5-maths", version: "1.0.0", versionId: "v1", files: imported }]);
    expect(allPackIds()).toContain("p5-maths");
    expect(packsForChild("P5")).toEqual(["p5-maths"]);
    expect(loadPack("p5-maths")).toMatchObject({ title: "P5 Fractions", items: [expect.objectContaining({ id: "p5m-1" })] });
    expect(readSection("p5-maths/model-method#1")?.text).toContain("as many units as the denominator");
    expect(teachingNotes("P5")).toContain("Draw the bar first.");
    expect(packNotes("p5-maths")).toContain("as many units");
    expect(listPrintPacks().map((p) => p.id)).toContain("p5-maths");
    expect(loadPrintBank("p5-maths")?.items).toHaveLength(1);
    expect(packCards().find((c) => c.id === "p5-maths")).toMatchObject({ source: "version", imported: true, level: "P5" });
    expect(packsOnDisk().find((p) => p.id === "p5-maths")).toMatchObject({ builtIn: false, level: "P5" });
  });

  it("serves a built-in pack's published version instead of the disk default, and the default again once cleared", () => {
    const disk = diskPackFiles("p3-science")!;
    const edited = { ...disk, "SKILL.md": disk["SKILL.md"].replace(/\n# /, "\n# Edited: ") };
    expect(loadPack("p3-science")?.core).not.toContain("Edited:");
    setSkillOverrides([{ packId: "p3-science", version: "1.1.0", versionId: "v2", files: edited }]);
    expect(loadPack("p3-science")?.core).toContain("Edited:");
    expect(packFile("p3-science", "SKILL.md")).toContain("Edited:");
    expect(packCards().find((c) => c.id === "p3-science")).toMatchObject({ source: "version", imported: false });
    clearSkillOverrides();
    expect(loadPack("p3-science")?.core).not.toContain("Edited:");
  });

  it("refreshes from the store at most once a minute unless forced, and survives a failing store", async () => {
    let calls = 0;
    const v: SkillVersion = { id: "v3", packId: "p5-maths", version: "1.0.0", files: imported, status: "published", source: "import", note: null, createdBy: null, createdAt: "2026-10-29T00:00:00Z", publishedAt: "2026-10-29T00:00:00Z", deletedAt: null };
    const store = { skillVersions: { published: async () => (calls++, [v]) } } as unknown as AuthStore;
    await refreshSkillOverrides(store, { now: 1_000_000 });
    await refreshSkillOverrides(store, { now: 1_030_000 });
    expect(calls).toBe(1);
    expect(skillOverride("p5-maths")?.versionId).toBe("v3");
    await refreshSkillOverrides(store, { now: 1_030_000, force: true });
    expect(calls).toBe(2);
    await refreshSkillOverrides(store, { now: 1_100_000 });
    expect(calls).toBe(3);
    const broken = { skillVersions: { published: async () => Promise.reject(new Error("db down")) } } as unknown as AuthStore;
    await expect(refreshSkillOverrides(broken, { force: true, now: 1_200_000 })).resolves.toBeUndefined();
    expect(skillOverride("p5-maths")?.versionId).toBe("v3"); // keeps what it had
    await refreshSkillOverrides(null);
  });
});
