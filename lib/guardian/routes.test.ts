// The guardian's routes against the in-memory demo store: heartbeats, the safety path on the child's words
// (Talk to Kix and question reasons), and the grown-up's summary with flags.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as attempts from "@/app/api/attempts/route";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as beat from "@/app/api/guardian/beat/route";
import * as seen from "@/app/api/guardian/seen/route";
import * as summary from "@/app/api/guardian/summary/route";
import * as words from "@/app/api/guardian/words/route";
import * as homework from "@/app/api/kix/homework/route";
import * as tutor from "@/app/api/kix/tutor/route";
import * as vibe from "@/app/api/vibe/route";
import * as sharedRoute from "@/app/api/family/shared/route";
import { JORDAN_ID, DEMO_HOUSEHOLD_ID } from "../auth/demo-family.ts";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";

class Browser {
  cookies = new Map<string, string>();
  async call(handler: (req: Request) => Promise<Response>, path: string, body?: unknown) {
    const headers = new Headers({ "content-type": "application/json" });
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const method = body === undefined ? "GET" : body === null ? "DELETE" : "POST";
    const res = await handler(new Request(`http://localhost${path}`, { method, headers, body: body === undefined || body === null ? undefined : JSON.stringify(body) }));
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [name, ...rest] = pair.split("=");
      if (!rest.join("=") || attrs.some((a) => /max-age=0/i.test(a.trim()))) this.cookies.delete(name);
      else this.cookies.set(name, rest.join("="));
    }
    return { status: res.status, body: await res.json() };
  }
}

let b: Browser;
let store: DemoStore;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "routes-test-secret-0123456789abcdefgh");
  resetRateLimits();
  store = resetDemoStore();
  b = new Browser();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const asAri = async () => {
  await b.call(parentRoute.POST, "/api/auth/parent", { email: "demo@mykx.ai", password: "x" });
  await b.call(kidRoute.POST, "/api/auth/kid", { kidId: JORDAN_ID, secret: { kind: "pictures", code: ["idle", "cheer", "pilot", "dreamlight"] } });
};

describe("guardian routes", () => {
  it("a heartbeat needs the kid, is stored once per 30 s slot, and answers with Kix's next step", async () => {
    // An afternoon in Singapore: after 20:30 a junior's quiet hours begin and Kix says "rest", so the clock is pinned.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T07:00:00Z"));
    expect((await b.call(beat.POST, "/api/guardian/beat", { kind: "learn", idle: false })).status).toBe(401);
    await asAri();
    const r = await b.call(beat.POST, "/api/guardian/beat", { kind: "learn", idle: false });
    expect(r.status).toBe(200);
    expect(r.body.next.kind).toBe("learn");
    expect(r.body.left).toBe(30);
    await b.call(beat.POST, "/api/guardian/beat", { kind: "learn", idle: false });
    expect(await store.guardian.beats(DEMO_HOUSEHOLD_ID, JORDAN_ID, "2000-01-01T00:00:00Z")).toHaveLength(1);
    expect((await b.call(beat.POST, "/api/guardian/beat", { kind: "nap", idle: false })).status).toBe(400);
  });

  it("distress words in Talk to Kix get the caring reply and helplines, and an urgent flag for the grown-up", async () => {
    await asAri();
    const r = await b.call(words.POST, "/api/guardian/words", { text: "I feel like giving up on everything" });
    expect(r.body.care.helplines.map((h: { number: string }) => h.number)).toEqual(["1800 274 4788", "1767"]);
    expect(r.body.reply).toMatch(/trust/);
    // While the kid is signed in, the summary sits behind the parent PIN; the kid hands back first.
    expect((await b.call(summary.GET, "/api/guardian/summary")).status).toBe(403);
    await b.call(kidRoute.DELETE, "/api/auth/kid", null);
    const s = await b.call(summary.GET, "/api/guardian/summary");
    const urgent = s.body.view.flags[0];
    expect(urgent).toMatchObject({ level: "urgent", kind: "distress", quote: "I feel like giving up on everything", helplines: true, seen: false });
    await b.call(seen.POST, "/api/guardian/seen", { flagId: urgent.id });
    expect((await b.call(summary.GET, "/api/guardian/summary")).body.view.flags[0].seen).toBe(true);
  });

  it("everyday words get a reply to the feeling, never the caring card", async () => {
    await asAri();
    const r = await b.call(words.POST, "/api/guardian/words", { text: "I'm so sleepy" });
    expect(r.body.care).toBeNull();
    expect(r.body.reply).toMatch(/break/);
  });

  it("a question's reason runs through the same safety check", async () => {
    await asAri();
    const r = await b.call(attempts.POST, "/api/attempts", {
      itemId: "p3sci-demo-01",
      response: 1,
      explanation: "nobody cares about me",
      hintsUsed: 0,
      revealed: false,
      durationMs: 2_000,
      key: crypto.randomUUID(),
    });
    expect(r.status).toBe(200);
    expect(r.body.care.reply).toMatch(/Tinkle Friend/);
    const said = await store.guardian.messages(DEMO_HOUSEHOLD_ID, JORDAN_ID, "2000-01-01T00:00:00Z");
    expect(said).toMatchObject([{ source: "reason", distress: true }]);
    expect((await store.learn.attempts(DEMO_HOUSEHOLD_ID, JORDAN_ID))[0].durationMs).toBe(2_000);
  });

  it("Ask Kix answers with the labelled sample when no model key is set, and keeps the answer back until 'full'", async () => {
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "");
    await asAri();
    const hint = await b.call(homework.POST, "/api/kix/homework", { stage: "hint", text: "Put the stages of a frog's life cycle in order." });
    expect(hint.status).toBe(200);
    expect(hint.body).toMatchObject({ sample: true, care: null, explanation: { stage: "hint", finalAnswer: null } });
    const full = await b.call(homework.POST, "/api/kix/homework", { stage: "full", question: hint.body.explanation.question });
    expect(full.body.explanation.finalAnswer).toMatch(/tadpole/);
    expect((await b.call(homework.POST, "/api/kix/homework", { stage: "hint" })).status).toBe(400);
  });

  it("Ask Kix takes the caring path for distress words and never calls the model", async () => {
    await asAri();
    const r = await b.call(homework.POST, "/api/kix/homework", { stage: "hint", text: "I want to die, this homework is impossible" });
    expect(r.body).toMatchObject({ explanation: null, care: { helplines: [{ number: "1800 274 4788" }, { number: "1767" }] } });
  });

  it("Kix Tutor answers with the item's own hint when no model key is set, names the skill, and cares for distress", async () => {
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "");
    await asAri();
    const headers = new Headers({ "content-type": "application/json", cookie: [...b.cookies].map(([k, v]) => `${k}=${v}`).join("; ") });
    const res = await tutor.POST(new Request("http://localhost/api/kix/tutor", { method: "POST", headers, body: JSON.stringify({ itemId: "p3sci-demo-03", hint: 1 }) }));
    expect(res.headers.get("x-kix-skill")).toBe("p3-science@1.0.0");
    expect(res.headers.get("x-kix-source")).toBe("cached");
    expect((await res.text()).length).toBeGreaterThan(10);
    const care = await b.call(tutor.POST, "/api/kix/tutor", { itemId: "p3sci-demo-03", hint: 2, ask: "nobody cares about me" });
    expect(care.body.care.helplines).toHaveLength(2);
  });

  it("Vibe Zone: makes a set (sample without a key), pays +5 once per creation, and shares one version with the grown-up", async () => {
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "");
    await asAri();
    const made = await b.call(vibe.POST, "/api/vibe", { action: "make", request: "I keep forgetting the frog life cycle" });
    expect(made.body).toMatchObject({ sample: true, spec: { title: "Frog life cycle flashcards" } });
    const first = await b.call(vibe.POST, "/api/vibe", { action: "save", id: null, spec: made.body.spec });
    expect(first.body.awards).toEqual([{ rule: "creation_saved", amount: 5 }]);
    const again = await b.call(vibe.POST, "/api/vibe", { action: "save", id: first.body.creation.id, spec: made.body.spec });
    expect(again.body).toMatchObject({ awards: [], creation: { currentVersion: 2 } });
    const shared = await b.call(vibe.POST, "/api/vibe", { action: "share", id: first.body.creation.id, share: true });
    expect(shared.body.creation.sharedVersion).toBe(2);
    await b.call(kidRoute.DELETE, "/api/auth/kid", null);
    const forParent = await b.call(sharedRoute.GET, "/api/family/shared");
    expect(forParent.body.shared).toMatchObject([{ kid: "Jordan", version: 2, title: "Frog life cycle flashcards" }]);
    await store.creations.revoke(DEMO_HOUSEHOLD_ID, first.body.creation.id);
    expect((await b.call(sharedRoute.GET, "/api/family/shared")).body.shared).toEqual([]);
  });

  it("the summary is for grown-ups only", async () => {
    expect((await b.call(summary.GET, "/api/guardian/summary")).status).toBe(401);
  });
});
