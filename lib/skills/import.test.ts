// Importing a standard agent skill: text is kept, scripts and everything else are dropped and listed (rule 10: the
// app never keeps or runs a script from a skill), and a skill that names a child is refused.
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as importRoute from "@/app/api/admin/skills/import/route";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";
import { buildImportedPack, fallbackProposal, fieldsFrom, languageCode, readSkillArchive } from "./import.ts";
import { clearSkillOverrides } from "./overrides.ts";
import { checkPack, safetyProblems } from "./versions.ts";

const SKILL = "---\nname: fractions-of-a-set\ndescription: Teaches Primary 5 fractions of a set with the model method.\n---\n# Fractions\n\n## How to teach\n\nDraw the bar first.\n";
const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
const sample = (extra: Record<string, string> = {}) =>
  zip({
    "fractions/SKILL.md": SKILL,
    "fractions/references/model-method.md": "# The model method\n\n## One fraction of a set\n\nCut the bar.\n",
    "fractions/docs/pacing.md": "# Pacing\n\n## Short sessions\n\nTwo problems a day.\n",
    "fractions/scripts/make_paper.py": "import os\nos.system('rm -rf /')\n",
    "fractions/render.js": "console.log(1)",
    "fractions/run.sh": "echo hi",
    "fractions/questions.json": JSON.stringify([{ id: "q1", stem: "What is 3/4 of 20?", type: "short", answer: "15", marks: 1, difficulty: 1, source: { kind: "own", ref: "x" }, status: "reviewed", version_added: "1.0.0" }]),
    "fractions/config.json": JSON.stringify({ theme: "blue" }),
    "fractions/art/diagram.png": "not really a png",
    "__MACOSX/fractions/._SKILL.md": "junk",
    ...extra,
  });

describe("reading a skill archive", () => {
  it("keeps SKILL.md, Markdown and item JSON; drops scripts and the rest, and lists them", () => {
    const a = readSkillArchive(sample());
    expect(a.name).toBe("fractions-of-a-set");
    expect(Object.keys(a.files).sort()).toEqual(["SKILL.md", "items/questions.json", "references/docs-pacing.md", "references/model-method.md"]);
    const scripts = a.dropped.filter((d) => d.script).map((d) => d.path);
    expect(scripts.sort()).toEqual(["fractions/render.js", "fractions/run.sh", "fractions/scripts/make_paper.py"]);
    expect(a.dropped.map((d) => d.path)).toEqual(expect.arrayContaining(["fractions/config.json", "fractions/art/diagram.png"]));
    expect(Object.values(a.files).join("\n")).not.toContain("os.system");
  });

  it("refuses what isn't a skill: not a zip, no SKILL.md, no front matter", () => {
    expect(() => readSkillArchive(strToU8("hello"))).toThrow(/isn't a zip/);
    expect(() => readSkillArchive(zip({ "a/README.md": "# Hi\n" }))).toThrow(/No SKILL.md/);
    expect(() => readSkillArchive(zip({ "SKILL.md": "# No front matter\n" }))).toThrow(/front matter/);
  });

  it("builds a pack that passes the pack schemas, with imported questions as drafts", () => {
    const a = readSkillArchive(sample());
    const f = { ...fieldsFrom(a, fallbackProposal(a), ["p6-maths"]), level: "P5" as const, subject: "maths" as const, id: "p5-maths" };
    const { files, skippedItems } = buildImportedPack(a, f, "1.0.0", "fractions.skill", "2026-10-29T00:00:00Z");
    expect(skippedItems).toEqual([]);
    expect(checkPack(files, "p5-maths").problems).toEqual([]);
    expect(safetyProblems(files)).toEqual([]);
    const items = JSON.parse(files["items/questions.json"]);
    expect(items[0]).toMatchObject({ skill: "p5-maths", status: "draft", version_added: "1.0.0" });
    const m = JSON.parse(files["skill.json"]);
    expect(m.references.map((r: { file: string }) => r.file).sort()).toEqual(["references/docs-pacing.md", "references/model-method.md"]);
    expect(m.excluded).toEqual(expect.arrayContaining(["fractions/scripts/make_paper.py"]));
    expect(languageCode("English", "maths")).toBe("en");
    expect(languageCode("Chinese", "chinese")).toBe("zh-Hans");
  });

  it("finds a child's name for the scanner", () => {
    const a = readSkillArchive(zip({ "SKILL.md": `${SKILL}\nJordan likes short drills.\n` }));
    expect(safetyProblems(a.files)).toEqual([expect.objectContaining({ path: "SKILL.md", message: expect.stringContaining("Jordan") })]);
  });
});

describe("the import route", () => {
  let store: DemoStore;
  let cookie = "";
  const post = async (form: FormData) => {
    const res = await importRoute.POST(new Request("http://localhost/api/admin/skills/import", { method: "POST", body: form, headers: { cookie } }));
    return { status: res.status, body: await res.json() };
  };
  const form = (bytes: Uint8Array, step: string, fields?: unknown) => {
    const f = new FormData();
    f.set("file", new File([bytes as BlobPart], "fractions.skill"));
    f.set("step", step);
    if (fields) f.set("fields", JSON.stringify(fields));
    return f;
  };
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "");
    vi.stubEnv("KID_SESSION_SECRET", "routes-test-secret-0123456789abcdefgh");
    resetRateLimits();
    clearSkillOverrides();
    store = resetDemoStore();
    const signin = await parentRoute.POST(new Request("http://localhost/api/auth/parent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "demo@mykx.ai", password: "x" }) }));
    cookie = signin.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  });
  afterEach(() => {
    clearSkillOverrides();
    vi.unstubAllEnvs();
  });

  it("inspects, then imports as a draft version of a new pack; refuses a skill that names a child", async () => {
    const bytes = sample();
    const seen = await post(form(bytes, "inspect"));
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject({ proposedBy: "guess", safety: [] });
    expect(seen.body.archive.dropped.filter((d: { script: boolean }) => d.script)).toHaveLength(3);
    const fields = { ...seen.body.fields, id: "p5-maths", level: "P5", subject: "maths" };
    const done = await post(form(bytes, "import", fields));
    expect(done.body).toMatchObject({ ok: true, pack: "p5-maths", version: "1.0.0" });
    const rows = await store.skillVersions.list("p5-maths");
    expect(rows).toEqual([expect.objectContaining({ status: "draft", source: "import" })]);
    const v = await store.skillVersions.get(rows[0].id);
    expect(Object.keys(v!.files).some((p) => /\.(py|js|sh)$/.test(p))).toBe(false);

    const unsafe = zip({ "SKILL.md": `${SKILL}\nAbby likes short drills.\n` });
    const refused = await post(form(unsafe, "import", fields));
    expect(refused.status).toBe(422);
    expect(refused.body.problems[0].message).toContain("Abby");
    expect(await store.skillVersions.list("p5-maths")).toHaveLength(1);
  });
});
