import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as knowledge from "@/app/api/admin/knowledge/route";
import * as publish from "@/app/api/admin/knowledge/publish/route";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";
import { buildUpdate, nextVersion, settle, updateNotes, type Extraction, type KnowledgeUpload } from "./knowledge.ts";

const EXTRACTION: Extraction = {
  paper: { level: "P3", subject: "science", year: 2025, examType: "EOY", school: "Sample School", pages: 12, questionCount: 30, totalMarks: 100 },
  archetypes: [
    { topic: "cycles.animal", pattern: "order the stages of an animal's life cycle from pictures", marks: 2, count: 2, difficulty: 2, format: "mcq", sourcePages: [3] },
    { topic: "magnets.properties", pattern: "predict which way a magnet moves from its poles", marks: 2, count: 1, difficulty: 2, format: "mcq", sourcePages: [5] },
  ],
  traps: [{ topic: "cycles.animal", trap: "treats the froglet as an adult because it has legs" }],
  markingCues: [{ topic: "cycles.animal", cue: "names the stage and one feature that shows it" }],
  items: [{ topic: "cycles.animal", type: "mcq", stem: "A copied school question", options: ["a", "b"], answer: "a", marks: 1, difficulty: 1 }],
  confidence: "high",
  notes: null,
};

const upload = (over: Partial<KnowledgeUpload> = {}): KnowledgeUpload => ({
  id: crypto.randomUUID(),
  uploadedBy: "admin",
  fileName: "paper.pdf",
  bytes: 1000,
  rights: "school-private",
  sourceUrl: null,
  status: "ready",
  pack: "p3-science",
  packIsNew: false,
  extraction: settle(EXTRACTION, "school-private", ["p3-science"]).extraction,
  review: {},
  publishedIn: null,
  error: null,
  createdAt: "2026-10-28T10:00:00Z",
  ...over,
});

describe("the knowledge agent's rules", () => {
  it("keeps no questions from a school paper, whatever the model returned, and routes it deterministically", () => {
    const s = settle(EXTRACTION, "school-private", ["p3-science"]);
    expect(s.extraction.items).toEqual([]);
    expect(s).toMatchObject({ pack: "p3-science", packIsNew: false });
    expect(settle(EXTRACTION, "own", ["p3-science"]).extraction.items).toHaveLength(1);
    expect(settle({ ...EXTRACTION, paper: { ...EXTRACTION.paper, level: "P6", subject: "english" } }, "own", ["p3-science"])).toMatchObject({ pack: "p6-english", packIsNew: true });
  });

  it("bumps the minor version from the pack's own, or starts a new pack at 0.1.0", () => {
    expect(nextVersion("1.0.0", [])).toBe("1.1.0");
    expect(nextVersion("1.0.0", [{ version: "1.1.0" } as never])).toBe("1.2.0");
    expect(nextVersion(null, [])).toBe("0.1.0");
  });

  it("publishes only approved entries, merging the same pattern across papers", () => {
    const a = upload({ review: { "a:0": "approved", "a:1": "rejected", "t:0": "approved" } });
    const b = upload({ review: { "a:0": "approved", "c:0": "approved" } });
    const u = buildUpdate("p3-science", [a, b], "1.1.0", "admin", "2026-10-28T11:00:00Z", "u1")!;
    expect(u.archetypes).toEqual([{ topic: "cycles.animal", pattern: "order the stages of an animal's life cycle from pictures", marks: 2, count: 4, difficulty: 2, format: "mcq" }]);
    expect(u.traps).toHaveLength(1);
    expect(u.markingCues).toHaveLength(1);
    expect(u.items).toEqual([]);
    expect(buildUpdate("p3-science", [upload()], "1.1.0", "admin", "x", "u2")).toBeNull();
    expect(updateNotes([u])).toContain("p3-science v1.1.0: latest exam patterns");
  });
});

describe("knowledge routes", () => {
  let store: DemoStore;
  const call = async (handler: (r: Request) => Promise<Response>, init: RequestInit & { cookie?: string }) => {
    const res = await handler(new Request("http://localhost/api/admin/knowledge", { ...init, headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.body && typeof init.body === "string" ? { "content-type": "application/json" } : {}) } }));
    return { status: res.status, body: await res.json(), cookies: res.headers.getSetCookie() };
  };
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "");
    vi.stubEnv("KID_SESSION_SECRET", "routes-test-secret-0123456789abcdefgh");
    resetRateLimits();
    store = resetDemoStore();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("needs an admin; records a failed read without a model key; publishes approved knowledge as v1.1.0", async () => {
    expect((await call(knowledge.GET, { method: "GET" })).status).toBe(403);
    const signin = await parentRoute.POST(new Request("http://localhost/api/auth/parent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "parent@demo.mykx", password: "x" }) }));
    const cookie = signin.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

    const form = new FormData();
    form.set("file", new File([new TextEncoder().encode("%PDF-1.4 sample")], "paper.pdf", { type: "application/pdf" }));
    form.set("rights", "school-private");
    const up = await call(knowledge.POST, { method: "POST", body: form, cookie });
    expect(up.body.upload).toMatchObject({ status: "failed", fileName: "paper.pdf" });
    const notPdf = new FormData();
    notPdf.set("file", new File(["hello"], "notes.pdf"));
    notPdf.set("rights", "own");
    expect((await call(knowledge.POST, { method: "POST", body: notPdf, cookie })).status).toBe(415);

    const ready = upload();
    await store.knowledge.saveUpload(ready);
    expect((await call(knowledge.PATCH, { method: "PATCH", body: JSON.stringify({ id: ready.id, review: { "a:0": "approved" } }), cookie })).status).toBe(200);
    const pub = await call(publish.POST, { method: "POST", body: JSON.stringify({ pack: "p3-science" }), cookie });
    expect(pub.body.update).toMatchObject({ pack: "p3-science", version: "1.1.0" });
    expect((await store.knowledge.uploads()).find((u) => u.id === ready.id)?.publishedIn).toBe("1.1.0");
    expect((await call(publish.POST, { method: "POST", body: JSON.stringify({ pack: "p3-science" }), cookie })).status).toBe(409);
  });
});
