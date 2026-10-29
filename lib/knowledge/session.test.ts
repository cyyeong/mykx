// Knowledge review sessions (founder, 29 Oct): pairing an answer sheet with its question paper, the admin's level,
// subject and tier overrides, the keys each question ends up with, cross-check statuses that block publishing, and
// publishing as a skill version in which a school paper's questions never appear (rule 10).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as knowledgeRoute from "@/app/api/admin/knowledge/route";
import * as publishRoute from "@/app/api/admin/knowledge/publish/route";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";
import { clearSkillOverrides, diskPackFiles } from "../skills/overrides.ts";
import { loadPack, readSection } from "../skills/runtime.ts";
import { checkPack, nextPackVersion, safetyProblems } from "../skills/versions.ts";
import { fallbackCheck } from "./crosscheck.ts";
import type { Extraction, KixItem, KnowledgeSession, KnowledgeUpload } from "./knowledge.ts";
import { refinePack } from "./refine.ts";
import { effectivePaper, keyedQuestions, normNo, pairUploads, publishBlockers, routeOf, sameAnswer } from "./session.ts";

const SCHOOL_STEM = "Mrs Tan had 3 times as many stickers as Mr Lim";
const paper = (o: Partial<Extraction["paper"]> = {}): Extraction["paper"] => ({ level: "P6", subject: "maths", tier: "standard", year: 2025, examType: "SA2", school: "Sample Primary", pages: 4, questionCount: 2, totalMarks: 5, ...o });
const extraction = (kind: Extraction["document"]["kind"], o: Partial<Extraction> = {}): Extraction => ({
  paper: paper(),
  document: { kind, paperNumber: "2" },
  questions:
    kind === "answer-sheet"
      ? [
          { no: "Q1", topic: "number.ratio", pattern: "transfer", marks: 3, keyAnswer: "120", workedAnswer: null },
          { no: "Q2", topic: "measurement.rate", pattern: "speed", marks: 2, keyAnswer: "4 hours", workedAnswer: null },
        ]
      : [
          { no: "1", topic: "number.ratio", pattern: "before-and-after transfer that equalises two amounts", marks: 3, keyAnswer: null, workedAnswer: "120" },
          { no: "2", topic: "measurement.rate", pattern: "time from distance and average speed", marks: 2, keyAnswer: null, workedAnswer: "3 hours" },
        ],
  archetypes: kind === "answer-sheet" ? [] : [{ topic: "number.ratio", pattern: "before-and-after transfer that equalises two amounts", marks: 3, count: 1, difficulty: 3, format: "structured", sourcePages: [1] }],
  traps: [{ topic: "number.ratio", trap: "treats the amount given as the difference" }],
  markingCues: [{ topic: "measurement.rate", cue: "time equals distance divided by speed, with units" }],
  // A model that ignored the rule: a school paper's question as an item. It must never reach a pack.
  items: [{ topic: "number.ratio", type: "short-answer", stem: SCHOOL_STEM, options: null, answer: "120", marks: 3, difficulty: 3 }],
  confidence: "high",
  notes: null,
  ...o,
});
const upload = (o: Partial<KnowledgeUpload> & { extraction: Extraction }): KnowledgeUpload => ({
  id: crypto.randomUUID(),
  uploadedBy: "admin",
  fileName: "paper.pdf",
  bytes: 1000,
  rights: "school-private",
  sourceUrl: null,
  status: "ready",
  pack: "p6-maths",
  packIsNew: false,
  review: {},
  publishedIn: null,
  error: null,
  createdAt: "2026-10-29T01:00:00Z",
  sessionId: "s1",
  state: {},
  ...o,
});

describe("pairing and overrides", () => {
  it("pairs an answer sheet with the question paper it matches, whichever came first", () => {
    const sheet = upload({ extraction: extraction("answer-sheet"), createdAt: "2026-10-29T00:30:00Z" });
    const qp = upload({ extraction: extraction("question-paper"), createdAt: "2026-10-29T01:00:00Z" });
    const other = upload({ extraction: extraction("question-paper", { paper: paper({ school: "Another Primary" }) }) });
    const pairs = pairUploads([sheet, qp, other]);
    expect(pairs.get(sheet.id)).toBe(qp.id);
    expect(pairs.get(qp.id)).toBe(sheet.id);
    expect(pairs.has(other.id)).toBe(false);
  });

  it("leaves an ambiguous match for the admin, and the admin's pair or 'not paired' wins", () => {
    const sheet = upload({ extraction: extraction("answer-sheet", { paper: paper({ school: null, examType: null }) }) });
    const a = upload({ extraction: extraction("question-paper") });
    const b = upload({ extraction: extraction("question-paper") });
    expect(pairUploads([sheet, a, b]).has(sheet.id)).toBe(false);
    expect(pairUploads([{ ...sheet, state: { pairWith: b.id } }, a, b]).get(sheet.id)).toBe(b.id);
    const optOut = upload({ extraction: extraction("answer-sheet"), state: { pairWith: null } });
    expect(pairUploads([optOut, a]).has(optOut.id)).toBe(false);
    // A paper of another subject never pairs.
    const sci = upload({ extraction: extraction("question-paper", { paper: paper({ subject: "science" }) }) });
    expect(pairUploads([upload({ extraction: extraction("answer-sheet") }), sci]).size).toBe(0);
  });

  it("applies the admin's level, subject and tier, marks them changed, and routes to that pack", () => {
    const u = upload({ extraction: extraction("question-paper"), state: { overrides: { level: "P5", tier: "foundation" } } });
    expect(effectivePaper(u)).toEqual({ level: "P5", subject: "maths", tier: "foundation", changed: { level: true, subject: false, tier: true } });
    expect(routeOf(u, ["p6-maths"])).toEqual({ pack: "p5-maths", isNew: true });
    expect(routeOf({ ...u, state: {} }, ["p6-maths"])).toEqual({ pack: "p6-maths", isNew: false });
    expect(effectivePaper({ ...u, state: { overrides: { level: "P6" } } }).changed.level).toBe(false);
  });

  it("gives each question its key: the admin's edit, else the paper's own, else the paired sheet's", () => {
    const qp = upload({ extraction: extraction("question-paper") });
    const sheet = upload({ extraction: extraction("answer-sheet") });
    expect(keyedQuestions(qp, sheet).map((q) => [q.key, q.keyAnswer, q.keyFrom])).toEqual([
      ["q:1", "120", "sheet"],
      ["q:2", "4 hours", "sheet"],
    ]);
    expect(keyedQuestions(qp, null)[0]).toMatchObject({ keyAnswer: null, keyFrom: null });
    const edited = { ...qp, state: { edits: { questions: qp.extraction!.questions.map((q) => (q.no === "2" ? { ...q, keyAnswer: "3 hours" } : q)) } } };
    expect(keyedQuestions(edited, sheet)[1]).toMatchObject({ keyAnswer: "3 hours", keyFrom: "you" });
    expect(normNo("Q13 (a)")).toBe("13a");
    expect(sameAnswer("$9.00", "9")).toBe(true);
    expect(sameAnswer("120 stickers", "120")).toBe(true);
  });
});

describe("cross-check statuses and what blocks publishing", () => {
  it("is waiting without a key, and falls back on Muse's worked answer when the model is unavailable", () => {
    expect(fallbackCheck({ key: "q:1", label: "1", topic: "t", marks: 1, keyAnswer: null })).toMatchObject({ status: "waiting" });
    expect(fallbackCheck({ key: "q:1", label: "1", topic: "t", marks: 1, keyAnswer: "120 stickers", workedAnswer: "120" })).toMatchObject({ status: "ok" });
    expect(fallbackCheck({ key: "q:2", label: "2", topic: "t", marks: 1, keyAnswer: "4 hours", workedAnswer: "3 hours" })).toMatchObject({ status: "mismatch", museAnswer: "3 hours" });
    expect(fallbackCheck({ key: "i:0", label: "1", topic: "t", marks: 1, keyAnswer: "15", stem: "?" })).toMatchObject({ status: "unusual" });
  });

  it("blocks on an unresolved mismatch only; spelling, unusual and waiting are highlighted, not blocking", () => {
    const base = upload({ extraction: extraction("question-paper"), review: { "a:0": "approved" } });
    const checks = [
      { key: "q:1", status: "spelling" as const, museAnswer: null, fix: "perimeter", note: null },
      { key: "q:2", status: "mismatch" as const, museAnswer: "3 hours", fix: null, note: null },
      { key: "q:3", status: "unusual" as const, museAnswer: null, fix: null, note: "5 marks for one step" },
      { key: "q:4", status: "waiting" as const, museAnswer: null, fix: null, note: null },
    ];
    const blocked = publishBlockers([{ ...base, state: { checks } }], []);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toContain("Q2");
    expect(publishBlockers([{ ...base, state: { checks, resolved: { "q:2": "key-right" } } }], [])).toEqual([]);
    const kix: KixItem[] = [{ topic: "t", pattern: "p", type: "short", stem: "s", options: null, answer: "1", working: [], hints: [], marks: 1, difficulty: 1, mark: "approved", check: { key: "n:0", status: "mismatch", museAnswer: "2", fix: null, note: null } }];
    expect(publishBlockers([base], kix)).toHaveLength(1);
    expect(publishBlockers([base], [{ ...kix[0], resolved: "key-right" }])).toEqual([]);
    expect(publishBlockers([upload({ extraction: extraction("question-paper") })], [])).toEqual([expect.stringContaining("Approve")]);
  });
});

describe("publishing refines the skill", () => {
  const kix: KixItem[] = [
    { topic: "number.ratio", pattern: "transfer", type: "short", stem: "Siti has 3 times as many cards as Ravi. After Siti gives Ravi 30 cards, they have the same number. How many cards did Siti have at first?", options: null, answer: "90", working: ["2 units = 60", "1 unit = 30", "3 units = 90"], hints: ["What stays the same?"], marks: 3, difficulty: 3, mark: "approved", check: { key: "n:0", status: "ok", museAnswer: null, fix: null, note: null } },
    { topic: "number.ratio", pattern: "transfer", type: "short", stem: "Not approved", options: null, answer: "1", working: [], hints: [], marks: 1, difficulty: 1 },
  ];

  it("adds approved patterns, traps, cues and Kix's questions; never a school paper's questions", () => {
    const qp = upload({ extraction: extraction("question-paper"), review: { "a:0": "approved", "t:0": "approved", "i:0": "approved" }, state: { edits: { items: extraction("question-paper").items } } });
    const sheet = upload({ extraction: extraction("answer-sheet"), review: { "c:0": "approved" } });
    const r = refinePack({ packId: "p6-maths", base: diskPackFiles("p6-maths"), version: "1.1.0", uploads: [qp, sheet], kixItems: kix, by: "admin-id", atIso: "2026-10-29T02:00:00Z" });
    expect(r.problems).toEqual([]);
    expect(r.added).toMatchObject({ archetypes: 1, traps: 1, cues: 1, items: 0, kix: 1 });
    const all = Object.values(r.files).join("\n");
    expect(all).not.toContain(SCHOOL_STEM);
    expect(all).not.toContain("Sample Primary");
    const items = JSON.parse(r.files["items/knowledge-1.1.0.json"]);
    expect(items).toEqual([expect.objectContaining({ source: { kind: "generated", ref: expect.any(String) }, status: "reviewed", reviewed_by: "admin-id" })]);
    const m = JSON.parse(r.files["skill.json"]);
    expect(m.version).toBe("1.1.0");
    expect(m.archetypes.find((a: { id: string }) => a.id === "KN-1")).toMatchObject({ topic: "number.ratio", marks: 3, seen: 1 });
    expect(m.references.find((x: { file: string }) => x.file === "references/exam-patterns.md").sections).toEqual(["Question patterns", "Traps", "Marking cues", "Sources"]);
    expect(checkPack(r.files, "p6-maths", () => true).problems).toEqual([]);
    expect(safetyProblems(r.files)).toEqual([]);
  });

  it("keeps our own material's questions as items, and adds a topic the pack didn't have to its scope", () => {
    const own = upload({ rights: "own", extraction: extraction("both", { items: [{ topic: "Speed of two journeys", type: "mcq", stem: "Which is the fastest?", options: ["10 km/h", "20 km/h", "30 km/h"], answer: "3", marks: 1, difficulty: 1 }] }), review: { "i:0": "approved" } });
    const r = refinePack({ packId: "p6-maths", base: diskPackFiles("p6-maths"), version: "1.2.0", uploads: [own], kixItems: [], by: "admin-id", atIso: "2026-10-29T02:00:00Z" });
    const items = JSON.parse(r.files["items/knowledge-1.2.0.json"]);
    expect(items[0]).toMatchObject({ stem: "Which is the fastest?", type: "mcq", answer: 3, source: { kind: "own" } });
    expect(r.added.topics).toEqual(["Speed of two journeys"]);
    expect(checkPack(r.files, "p6-maths", () => true).problems).toEqual([]);
  });

  it("starts a new pack for a level and subject nobody covers yet", () => {
    const u = upload({ extraction: extraction("question-paper"), review: { "a:0": "approved" }, state: { overrides: { level: "P5" } } });
    const r = refinePack({ packId: "p5-maths", base: null, version: "1.0.0", uploads: [u], kixItems: [], by: "admin-id", atIso: "2026-10-29T02:00:00Z" });
    expect(checkPack(r.files, "p5-maths").problems).toEqual([]);
    expect(JSON.parse(r.files["skill.json"])).toMatchObject({ level: "P5", subject: "maths", tier: "standard" });
  });
});

describe("the publish route", () => {
  let store: DemoStore;
  let cookie = "";
  const call = async (handler: (r: Request) => Promise<Response>, method: string, body: unknown) => {
    const res = await handler(new Request("http://localhost/api/admin/knowledge", { method, body: JSON.stringify(body), headers: { cookie, "content-type": "application/json" } }));
    return { status: res.status, body: await res.json() };
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

  it("refuses while a mismatch is unresolved, then publishes a skill version Kix reads", async () => {
    const session: KnowledgeSession = { id: crypto.randomUUID(), title: "Test", createdBy: "admin", createdAt: "2026-10-29T00:00:00Z", kixItems: { "p6-maths": kix() }, published: [] };
    await store.knowledge.saveSession(session);
    const qp = upload({ sessionId: session.id, extraction: extraction("question-paper"), review: { "a:0": "approved", "t:0": "approved" }, state: { checks: [{ key: "q:2", status: "mismatch", museAnswer: "3 hours", fix: null, note: null }] } });
    await store.knowledge.saveUpload(qp);
    const blocked = await call(publishRoute.POST, "POST", { pack: "p6-maths", sessionId: session.id });
    expect(blocked.status).toBe(409);
    expect(blocked.body.blockers[0]).toContain("Q2");

    const resolved = await call(knowledgeRoute.PATCH, "PATCH", { op: "resolve", id: qp.id, key: "q:2", how: "use-muse" });
    expect(resolved.body.upload.state.edits.questions[1].keyAnswer).toBe("3 hours");
    const school = await call(knowledgeRoute.PATCH, "PATCH", { op: "edit", id: qp.id, kind: "items", entries: [] });
    expect(school.status).toBe(400); // a school paper keeps no questions, even by an edit

    const pub = await call(publishRoute.POST, "POST", { pack: "p6-maths", sessionId: session.id });
    // The first published version is one minor up from the pack on disk, whatever its version.
    const next = nextPackVersion(JSON.parse(diskPackFiles("p6-maths")!["skill.json"]).version, []);
    expect(pub.body).toMatchObject({ ok: true, update: { pack: "p6-maths", version: next, status: "published" } });
    const v = await store.skillVersions.get(pub.body.update.versionId);
    expect(v).toMatchObject({ status: "published", source: "knowledge" });
    expect(Object.values(v!.files).join("\n")).not.toContain(SCHOOL_STEM);
    expect(loadPack("p6-maths")?.version).toBe(next);
    const id = loadPack("p6-maths")!.sections.find((s) => s.file === "references/exam-patterns.md")!.id;
    expect(readSection(id)?.text).toContain("before-and-after transfer");
    expect((await store.knowledge.updates("p6-maths")).map((u) => u.version)).toEqual([next]); // the history stays readable
    expect((await store.knowledge.session(session.id))?.kixItems["p6-maths"].every((k) => k.mark !== "approved")).toBe(true);
    expect(store.auditLog.find((a) => a.action === "knowledge.publish")).toMatchObject({ target: pub.body.update.versionId, detail: expect.objectContaining({ pack: "p6-maths" }) });
  });
});

function kix(): KixItem[] {
  return [{ topic: "number.ratio", pattern: "transfer", type: "mcq", stem: "Ali has 2 times as many marbles as Ben. Ali gives Ben 10 marbles and they have the same. How many did Ali have?", options: ["20", "30", "40", "10"], answer: "3", working: ["1 unit = 20"], hints: ["Draw two bars."], marks: 2, difficulty: 2, mark: "approved", check: { key: "n:0", status: "ok", museAnswer: null, fix: null, note: null } }];
}
