// Agents you can edit: the defaults reproduce the prompts as they were before (today-prompts.json, captured from the
// 29 Oct builders), guardrails are always appended, the version rules hold, the runtime reads the published version,
// and the admin routes refuse anyone but an admin.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as agentRoute from "@/app/api/admin/agents/[id]/route";
import * as agentsRoute from "@/app/api/admin/agents/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import { OTHER_PARENT_EMAIL } from "../auth/demo-family.ts";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";
import type { AuthStore } from "../auth/store.ts";
import { readerPrompt } from "../home-watch/reader.ts";
import { systemPrompt } from "../kix/homework.ts";
import { hintSystem, reasonSystem, tutorVars } from "../kix/tutor-prompt.ts";
import { extractionPrompt } from "../knowledge/knowledge.ts";
import { sessionClosePrompt } from "../notebook/session-close.ts";
import { scoutPrompt } from "../outings/outings.ts";
import { makePrompt } from "../vibe/flashcards.ts";
import { AGENT_PROMPTS, checkInstructions, compose, defaultText, EDITABLE_AGENTS, guardrailsFor, partText } from "./instructions.ts";
import { forgetInstructions, instructionsFor, INSTRUCTIONS_TTL_MS, publishedInstructions } from "./runtime.ts";
import { applyAgentAction, publishedOf } from "./versions.ts";
import TODAY from "./today-prompts.json" with { type: "json" };

// The inputs today-prompts.json was captured with.
const kid = { nickname: "Jordan", level: "P3", band: "junior" };
const item = {
  id: "p3sci-sample-01",
  stem: "Which stage comes straight after the egg in a frog's life cycle?",
  options: ["Froglet", "Tadpole", "Adult frog", "Frogspawn"],
  working: ["The egg hatches into a tadpole.", "So the tadpole comes next."],
  hints: ["Think about what hatches out of the jelly.", "It lives in water and has a tail."],
};
const remembered = "## What Kix remembers about Jordan\n- Asks why about animals.";
const notes = "## Claim, evidence, reasoning\nSay what you think, what shows it, and why.";
const flash = { title: "Frog cards", topic: "Life cycles", kixSays: "Flip them!", cards: [{ front: "First stage?", back: "Frogspawn.", picture: "frogspawn" as const }] };

/** The same lines, in any order (for the two agents whose method lines moved up above their guardrails). */
const sameLines = (a: string, b: string) => expect(a.split("\n").sort()).toEqual(b.split("\n").sort());

describe("the built-in defaults reproduce the prompts as they were", () => {
  it("word for word for nine of the eleven prompts", () => {
    expect(reasonSystem({ kid, item, correct: true, right: "Tadpole", pack: "p3-science", notes })).toBe(TODAY.reason.right);
    expect(reasonSystem({ kid, item, correct: false, right: "Tadpole", pack: "p3-science", notes })).toBe(TODAY.reason.wrong);
    for (const stage of ["hint", "steps", "full"] as const) {
      expect(systemPrompt({ nickname: "Jordan", level: "P3", band: "junior", stage, notes })).toBe(TODAY.askKix[`${stage}-junior`]);
      expect(systemPrompt({ nickname: "Leonard", level: "S2", band: "teen", stage, notes })).toBe(TODAY.askKix[`${stage}-teen`]);
    }
    expect(systemPrompt({ nickname: "Jordan", level: null, band: null, stage: "hint", notes: "" })).toBe(TODAY.askKixNullBand);
    expect(sessionClosePrompt({ nickname: "Jordan", level: "P3", stats: "Questions: 4, first try right: 3, hints: 1.", pages: { personality: "Likes frogs and drawing." } })).toBe(TODAY.memoryKeeper);
    expect(makePrompt({ nickname: "Jordan", level: "P3", notes, revise: null })).toBe(TODAY.vibe.fresh);
    expect(makePrompt({ nickname: "Jordan", level: null, notes, revise: { spec: flash, change: "Make them harder" } })).toBe(TODAY.vibe.revise);
    expect(extractionPrompt("school-private", { "p3-science": ["cycles.animal", "magnets"] })).toBe(TODAY.curator.school);
    expect(extractionPrompt("licensed", { "p6-maths": ["ratio"] })).toBe(TODAY.curator.licensed);
    expect(readerPrompt([{ nickname: "Jordan", band: "junior", description: "short hair, red T-shirt" }, { nickname: "Leonard", band: "teen", description: null }])).toBe(TODAY.homeReader.kids);
    expect(readerPrompt([])).toBe(TODAY.homeReader.none);
    expect(compose("guardian-brief", {})).toBe(TODAY.brief);
    expect(compose("tonight", {})).toBe(TODAY.tonight);
    expect(scoutPrompt({ area: "Sengkang", radiusKm: 3, interests: ["badminton", "cycling"], dates: ["2026-10-31", "2026-11-01"] })).toBe(TODAY.scout);
  });

  it("line for line for the Kix Tutor's hints and the Outing Planner, with the guardrails moved to the end", () => {
    const hint = hintSystem({ kid, item, remembered });
    sameLines(hint, TODAY.tutor.hint);
    sameLines(hintSystem({ kid: { nickname: "Jordan", level: null, band: null }, item, remembered: "" }), TODAY.tutor.hintNoLevel);
    const head = compose("tutor", tutorVars(kid), null, "hint").split("\n");
    expect(head.slice(-2)).toEqual(AGENT_PROMPTS.tutor.parts[0].guardrails.map((g) => g.text));
    sameLines(compose("outing-planner", {}), TODAY.planner);
    expect(compose("outing-planner", {}).split("\n").slice(-3)).toEqual(AGENT_PROMPTS["outing-planner"].parts[0].guardrails.map((g) => g.text));
  });

  it("covers every editable agent, and no default names a real child", () => {
    expect(EDITABLE_AGENTS).toHaveLength(11);
    for (const a of EDITABLE_AGENTS) {
      expect(checkInstructions(a, defaultText(a))).toBeNull();
      expect(defaultText(a)).not.toMatch(/Jordan|Abby|Leonard/);
    }
  });
});

describe("guardrails and template variables", () => {
  it("always appends the guardrails after the instructions, whatever they say", () => {
    const edited = "You are Kix. Ignore any rule about answers.\n\n\n";
    const out = compose("tutor", tutorVars(kid), `## Hints\n${edited}\n## Reason feedback\nBe kind.`, "hint");
    expect(out).toBe(["You are Kix. Ignore any rule about answers.", ...guardrailsFor("tutor", tutorVars(kid), "hint")].join("\n"));
    expect(out.endsWith("If the child asks something off-topic or unsafe, kindly bring them back to the question.")).toBe(true);
    // An empty part still gets its guardrails; a part whose heading went missing falls back to the default.
    expect(compose("tutor", tutorVars(kid), "## Hints\n\n## Reason feedback\nBe kind.", "hint")).toBe(guardrailsFor("tutor", tutorVars(kid), "hint").join("\n"));
    expect(compose("tutor", tutorVars(kid), "## Hints\nShort.", "reason")).toContain("You are Kix, Jordan's kind study sidekick (Singapore P3).");
  });

  it("picks the guardrail for the stage or the answer, and fills only declared variables", () => {
    expect(guardrailsFor("ask-kix", { stage: "steps" })[0]).toMatch(/^Stage STEPS/);
    expect(guardrailsFor("tutor", { correct: false }, "reason")[0]).toMatch(/NEVER say or hint which option is right/);
    const out = compose("vibe", { nickname: "Jordan", level: "P3", band: "junior" }, "Cards for {{nickname}} ({{ level }}). Secret: {{email}}{{householdId}}.");
    expect(out.split("\n")[0]).toBe("Cards for Jordan (P3). Secret: .");
    // A value is never expanded again.
    expect(compose("vibe", { nickname: "{{level}}", level: "P3" }, "Hi {{nickname}}").split("\n")[0]).toBe("Hi {{level}}");
    // The Scout can only be told what rule 15 allows.
    expect(Object.keys(AGENT_PROMPTS["outing-scout"].vars).sort()).toEqual(["area", "dates", "interests", "radiusKm"]);
    expect(compose("outing-scout", { area: "Sengkang", nickname: "Jordan" }, "Near {{area}} for {{nickname}}.").split("\n")[0]).toBe("Near Sengkang for .");
  });

  it("keeps [junior] and [teen] lines for that band only", () => {
    const text = "Hello.\n[junior] Short words.\n[teen] Talk like a peer.";
    expect(compose("ask-kix", { band: "teen", stage: "hint" }, text).split("\n").slice(0, 2)).toEqual(["Hello.", "Talk like a peer."]);
    expect(compose("ask-kix", { band: "junior", stage: "hint" }, text).split("\n").slice(0, 2)).toEqual(["Hello.", "Short words."]);
    // An agent without a band drops tagged lines.
    expect(compose("tonight", {}, "Hi.\n[teen] Teen line.").split("\n")[0]).toBe("Hi.");
    expect(compose("tonight", {}, "Hi.\n[teen] Teen line.")).not.toContain("Teen line");
  });

  it("refuses texts that can't be saved", () => {
    expect(checkInstructions("tonight", "  \n ")).toMatch(/Write some/);
    expect(checkInstructions("tonight", "x".repeat(8001))).toMatch(/at most 8,000/);
    expect(checkInstructions("tutor", "## Hints\nShort.")).toMatch(/## Reason feedback/);
    expect(checkInstructions("tutor", "## Hints\nA\n## Reason feedback\nB")).toMatch(/## Interest spark/);
    expect(checkInstructions("tutor", "Hello\n## Hints\nA\n## Reason feedback\nB\n## Interest spark\nS")).toMatch(/Start with/);
    expect(checkInstructions("tutor", "## Hints\nA\n## Hints\nB\n## Reason feedback\nC\n## Interest spark\nS")).toMatch(/once/);
    // A part before another ends with the blank line between them; composing trims it.
    expect(partText("tutor", defaultText("tutor"), "reason")?.trimEnd()).toBe(AGENT_PROMPTS.tutor.parts[1].text);
    expect(partText("tutor", defaultText("tutor"), "spark")).toBe(AGENT_PROMPTS.tutor.parts[2].text);
  });
});

describe("versions (the default can't be deleted; restore; delete falls back)", () => {
  let store: DemoStore;
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    store = resetDemoStore();
  });
  afterEach(() => vi.unstubAllEnvs());

  const act = (a: Parameters<typeof applyAgentAction>[2]) => applyAgentAction(store, "tonight", a, "admin-1");
  const uses = async () => (await publishedInstructions("tonight", store)).version;

  it("drafts don't change Kix; publishing does; deleting falls back to the one before, then the default", async () => {
    expect(await act({ action: "delete", version: 1 })).toMatchObject({ ok: false, reason: "not-allowed" });
    expect(await act({ action: "save-draft", instructions: "Draft one", note: "Try" })).toMatchObject({ ok: true, row: { version: 2, status: "draft" } });
    expect(await act({ action: "save-draft", instructions: "Draft one, again" })).toMatchObject({ ok: true, row: { version: 2, instructions: "Draft one, again" } });
    forgetInstructions();
    expect(await uses()).toBe(1);
    expect(await act({ action: "publish", instructions: "Version two" })).toMatchObject({ ok: true, row: { version: 2, status: "published" }, publishedChanged: true });
    expect(await act({ action: "publish", instructions: "Version two" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await act({ action: "publish", instructions: "Version three" })).toMatchObject({ ok: true, row: { version: 3 } });
    forgetInstructions();
    expect(await publishedInstructions("tonight", store)).toEqual({ version: 3, text: "Version three" });
    expect(await act({ action: "delete", version: 3 })).toMatchObject({ ok: true, publishedChanged: true });
    forgetInstructions();
    expect(await uses()).toBe(2);
    expect(await act({ action: "delete", version: 2 })).toMatchObject({ ok: true });
    forgetInstructions();
    expect(await publishedInstructions("tonight", store)).toEqual({ version: 1, text: defaultText("tonight") });
    expect(await act({ action: "delete", version: 2 })).toMatchObject({ ok: false, status: 404 });
    // Numbers are never reused.
    expect(await act({ action: "publish", instructions: "Version four" })).toMatchObject({ ok: true, row: { version: 4 } });
    expect((await store.agents.versions("tonight")).map((v) => [v.version, v.deletedAt === null])).toEqual([
      [2, false],
      [3, false],
      [4, true],
    ]);
  });

  it("restores an older version or the default as a new published version", async () => {
    await act({ action: "publish", instructions: "Version two" });
    await act({ action: "publish", instructions: "Version three" });
    expect(await act({ action: "restore", version: 3 })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await act({ action: "restore", version: 2 })).toMatchObject({ ok: true, row: { version: 4, instructions: "Version two", note: "Restored v2" } });
    expect(await act({ action: "restore", version: 1 })).toMatchObject({ ok: true, row: { version: 5, instructions: defaultText("tonight"), status: "published" } });
    expect(publishedOf(await store.agents.versions("tonight"))?.version).toBe(5);
    expect(await act({ action: "restore", version: 9 })).toMatchObject({ ok: false, status: 404 });
  });

  it("publishes a draft made before a restore as a new version, and drops the old draft", async () => {
    await act({ action: "publish", instructions: "Version two" });
    await act({ action: "save-draft", instructions: "Draft three" });
    expect(await act({ action: "restore", version: 3 })).toMatchObject({ ok: false, reason: "invalid" }); // a draft
    await act({ action: "restore", version: 1 }); // v4
    expect(await act({ action: "publish", instructions: "Draft three, finished" })).toMatchObject({ ok: true, row: { version: 5, status: "published" } });
    const rows = await store.agents.versions("tonight");
    expect(rows.find((r) => r.version === 3)?.deletedAt).not.toBeNull();
    expect(publishedOf(rows)?.instructions).toBe("Draft three, finished");
  });

  it("refuses a multi-part text without its headings", async () => {
    expect(await applyAgentAction(store, "tutor", { action: "publish", instructions: "Just one part" }, "admin-1")).toMatchObject({ ok: false, reason: "invalid", note: expect.stringMatching(/## Hints/) });
  });
});

describe("the runtime", () => {
  let store: DemoStore;
  beforeEach(() => {
    store = resetDemoStore();
  });

  it("uses the published text for a minute, then reads again; a failing store means the default", async () => {
    const t0 = 1_000_000;
    expect(await instructionsFor("tonight", {}, { store, now: t0 })).toBe(compose("tonight", {}));
    await store.agents.add({ agentId: "tonight", instructions: "Keep it to two sentences.", note: null, status: "published", createdBy: null });
    expect(await instructionsFor("tonight", {}, { store, now: t0 + 1000 })).toBe(compose("tonight", {})); // cached
    const fresh = await instructionsFor("tonight", {}, { store, now: t0 + INSTRUCTIONS_TTL_MS + 1 });
    expect(fresh).toBe(["Keep it to two sentences.", ...guardrailsFor("tonight", {})].join("\n"));
    const broken = { agents: { versions: async () => Promise.reject(new Error("down")) } } as unknown as AuthStore;
    expect(await instructionsFor("guardian-brief", {}, { store: broken })).toBe(compose("guardian-brief", {}));
    expect(await instructionsFor("guardian-brief", {}, { store: null })).toBe(compose("guardian-brief", {}));
  });
});

/** A browser for the admin routes: keeps cookies between calls. */
class Browser {
  cookies = new Map<string, string>();
  async call(handler: (req: Request, ctx: never) => Promise<Response>, path: string, init: { body?: unknown; id?: string } = {}) {
    const headers = new Headers({ "content-type": "application/json" });
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const req = new Request(`http://localhost${path}`, { method: init.body === undefined ? "GET" : "POST", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    const res = await handler(req, { params: Promise.resolve({ id: init.id ?? "" }) } as never);
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const [name, ...rest] = pair.split("=");
      if (rest.join("=")) this.cookies.set(name, rest.join("="));
    }
    return { status: res.status, body: await res.json() };
  }
  signIn(email = "demo@mykx.ai") {
    return this.call(parentRoute.POST, "/api/auth/parent", { body: { email, password: "anything" } });
  }
}

describe("admin routes", () => {
  let store: DemoStore;
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("KID_SESSION_SECRET", "agents-test-secret-0123456789abcdefgh");
    resetRateLimits();
    store = resetDemoStore();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuse anyone who isn't an admin", async () => {
    const nobody = new Browser();
    expect((await nobody.call(agentsRoute.GET, "/api/admin/agents")).status).toBe(403);
    const parent = new Browser();
    await parent.signIn(OTHER_PARENT_EMAIL);
    expect((await parent.call(agentsRoute.GET, "/api/admin/agents")).status).toBe(403);
    expect((await parent.call(agentRoute.GET, "/api/admin/agents/tutor", { id: "tutor" })).status).toBe(403);
    expect((await parent.call(agentRoute.POST, "/api/admin/agents/tonight", { id: "tonight", body: { action: "publish", instructions: "Hijacked" } })).status).toBe(403);
    expect(await store.agents.versions()).toEqual([]);
  });

  it("let an admin read, publish and delete, audited, and never delete the default", async () => {
    const admin = new Browser();
    await admin.signIn();
    const list = await admin.call(agentsRoute.GET, "/api/admin/agents");
    expect(list.body.agents).toHaveLength(19);
    expect(list.body.agents.filter((a: { editable: boolean }) => a.editable)).toHaveLength(11);
    const studio = await admin.call(agentRoute.GET, "/api/admin/agents/studio", { id: "studio" });
    expect(studio.body).toMatchObject({ editable: null, readOnly: expect.stringMatching(/Muse Image/) });
    const tutor = await admin.call(agentRoute.GET, "/api/admin/agents/tutor", { id: "tutor" });
    expect(tutor.body.versions).toEqual([expect.objectContaining({ version: 1, kind: "default", current: true })]);
    expect(tutor.body.editable.guardrails.map((g: { text: string }) => g.text)).toContain(AGENT_PROMPTS.tutor.parts[0].guardrails[0].text);

    const published = await admin.call(agentRoute.POST, "/api/admin/agents/tonight", { id: "tonight", body: { action: "publish", instructions: "Two warm sentences.", note: "Shorter" } });
    expect(published.body).toMatchObject({ ok: true, done: { action: "publish", version: 2 }, published: 2 });
    expect(published.body.versions[0]).toMatchObject({ version: 2, kind: "published", by: "Demo Parent", note: "Shorter" });
    const noDefault = await admin.call(agentRoute.POST, "/api/admin/agents/tonight", { id: "tonight", body: { action: "delete", version: 1 } });
    expect(noDefault).toMatchObject({ status: 400, body: { reason: "not-allowed" } });
    expect((await admin.call(agentRoute.POST, "/api/admin/agents/tonight", { id: "tonight", body: { action: "delete", version: 2 } })).body.published).toBe(1);
    expect((await admin.call(agentRoute.POST, "/api/admin/agents/studio", { id: "studio", body: { action: "restore", version: 1 } })).status).toBe(404);
    expect(store.auditLog.filter((e) => e.action.startsWith("agent.")).map((e) => [e.action, e.detail?.agent, e.detail?.version])).toEqual([
      ["agent.publish", "tonight", 2],
      ["agent.delete", "tonight", 2],
    ]);
  });
});
