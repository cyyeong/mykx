// Skill packs: every manifest and item validates, items agree with their manifest,
// the twelve demo items are in place, and nothing under content/ carries a child's
// details, a school's name or paper codes, or a learner profile (AGENTS.md rule 10).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FORBIDDEN_FILE_RE, findBanned, scannableText } from "../lib/skills/safety.ts";
import { SkillItemListSchema, SkillManifestSchema } from "../lib/skills/schema.ts";
import type { SkillItem, SkillManifest } from "../lib/types.ts";

const CONTENT = join(import.meta.dirname, ".");
const SKILLS = join(CONTENT, "skills");
const EXPECTED_PACKS = ["p3-chinese", "p3-english", "p3-maths", "p3-science", "p6-maths", "p6-science", "s2-maths", "s2-science"];
const TEXT = /\.(md|json|svg|txt|csv|ts)$/i;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const packs = readdirSync(SKILLS).filter((d) => statSync(join(SKILLS, d)).isDirectory());

function loadPack(id: string) {
  const dir = join(SKILLS, id);
  const manifest = SkillManifestSchema.parse(JSON.parse(readFileSync(join(dir, "skill.json"), "utf8"))) as SkillManifest;
  const itemDir = join(dir, "items");
  const files = existsSync(itemDir) ? readdirSync(itemDir).filter((f) => f.endsWith(".json")) : [];
  const items: SkillItem[] = files.flatMap((f) => {
    const parsed = SkillItemListSchema.safeParse(JSON.parse(readFileSync(join(itemDir, f), "utf8")));
    if (!parsed.success) throw new Error(`${id}/items/${f}: ${parsed.error.message}`);
    return parsed.data as SkillItem[];
  });
  return { dir, manifest, items };
}

describe("skill packs", () => {
  it("has the MVP packs: the seven imported ones and Sec 2 Maths", () => {
    expect(packs.sort()).toEqual(EXPECTED_PACKS);
  });

  describe.each(EXPECTED_PACKS)("%s", (id) => {
    const { dir, manifest, items } = loadPack(id);

    it("has a valid manifest whose id matches its folder", () => {
      expect(manifest.id).toBe(id);
      expect(existsSync(join(dir, "SKILL.md"))).toBe(true);
      const skillMd = readFileSync(join(dir, "SKILL.md"), "utf8");
      expect(skillMd).toMatch(new RegExp(`^---\\nname: ${id}\\ndescription: .+\\n---\\n`));
    });

    it("lists references that exist, with the sections they really have", () => {
      for (const ref of manifest.references) {
        const text = readFileSync(join(dir, ref.file), "utf8");
        const sections = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
        expect(ref.sections, ref.file).toEqual(sections);
      }
    });

    it("has items that agree with the manifest", () => {
      const topics = new Map(manifest.topics.map((t) => [t.id, t]));
      const archetypes = new Map(manifest.archetypes.map((a) => [a.id, a]));
      for (const item of items) {
        expect(item.skill, item.id).toBe(id);
        const topic = topics.get(item.topic);
        expect(topic, `${item.id}: topic ${item.topic}`).toBeDefined();
        expect(topic?.subskills, `${item.id}: subskill ${item.subskill}`).toContain(item.subskill);
        if (item.archetype) {
          expect(archetypes.get(item.archetype)?.topic, `${item.id}: archetype ${item.archetype}`).toBe(item.topic);
        }
        if (item.figure) expect(existsSync(join(dir, item.figure)), `${item.id}: ${item.figure}`).toBe(true);
        if (item.status === "reviewed") expect(item.reviewed_by, item.id).toBeTruthy();
      }
    });
  });

  it("has unique item ids across all packs", () => {
    const ids = EXPECTED_PACKS.flatMap((id) => loadPack(id).items.map((i) => i.id));
    expect(ids.length).toBe(new Set(ids).size);
  });
});

describe("demo items", () => {
  const demo = EXPECTED_PACKS.flatMap((id) => loadPack(id).items).filter((i) => i.demo);

  it("are the twelve planned items: 5 P3 life cycles, 4 P6 before-and-after ratio, 3 Sec 2 electrical", () => {
    expect(demo).toHaveLength(12);
    expect(demo.filter((i) => i.skill === "p3-science" && i.topic === "cycles.animal")).toHaveLength(5);
    expect(demo.filter((i) => i.skill === "p6-maths" && i.topic === "number.ratio" && i.subskill.startsWith("ba_"))).toHaveLength(4);
    expect(demo.filter((i) => i.skill === "s2-science" && i.topic === "physics.electrical")).toHaveLength(3);
  });

  it.each(demo.map((i) => [i.id, i] as const))("%s is founder-reviewed, with two hints, worked answer and distractor notes", (_id, item) => {
    expect(item.status).toBe("reviewed");
    expect(item.reviewed_by).toBeTruthy();
    expect(item.hints).toHaveLength(2);
    expect(item.working?.length).toBeGreaterThan(0);
    if (item.type === "mcq") {
      const wrong = (item.options ?? []).map((_, k) => String(k + 1)).filter((k) => k !== String(item.answer));
      expect(Object.keys(item.distractors ?? {}).sort()).toEqual(wrong);
    }
  });

  it("spread their correct answers across option positions", () => {
    const positions = new Set(demo.filter((i) => i.type === "mcq").map((i) => i.answer));
    expect(positions.size).toBe(4);
  });
});

describe("content/ is child-agnostic and holds no school-paper material", () => {
  const files = walk(CONTENT);

  it("contains no learner profiles, trackers, scripts, fonts or PDFs", () => {
    const bad = files.map((f) => relative(CONTENT, f)).filter((f) => FORBIDDEN_FILE_RE.test(basename(f)) && !f.endsWith(".test.ts"));
    expect(bad).toEqual([]);
  });

  it("contains no real child names, traits, school names, paper codes, exam dates or past-paper sources", () => {
    const hits: string[] = [];
    for (const file of files.filter((f) => TEXT.test(f))) {
      const rel = relative(CONTENT, file);
      for (const hit of findBanned(scannableText(rel, readFileSync(file, "utf8")))) {
        hits.push(`${rel}:${hit.line} ${hit.label} "${hit.match}"`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("names its private exclusions without shipping them", () => {
    for (const id of EXPECTED_PACKS) {
      const { dir, manifest } = loadPack(id);
      expect(manifest.legacy_scripts.note).toBe("kept privately; never executed");
      for (const f of [...manifest.excluded, ...manifest.legacy_scripts.files]) {
        expect(existsSync(join(dir, f)), `${id}: ${f} must not be in the pack`).toBe(false);
        expect(existsSync(join(dir, "references", basename(f))), `${id}: ${basename(f)}`).toBe(false);
        // The lists are skipped by the school-paper scan (they name private files on purpose), but never a child.
        const personal = findBanned(f.replace(/[_./-]/g, " ")).filter((h) => /child name|diagnosis|learner/.test(h.label));
        expect(personal, `${id}: ${f}`).toEqual([]);
      }
    }
  });

  it("keeps the packs light (under 3 MB together)", () => {
    const bytes = walk(SKILLS).reduce((s, f) => s + statSync(f).size, 0);
    expect(bytes).toBeLessThan(3 * 1024 * 1024);
  });
});
// The scanner's own cases (which must quote the banned words) live in lib/skills/safety.test.ts,
// so that this folder stays clean.
