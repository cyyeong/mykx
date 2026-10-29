// The guest site (founder, 29 Oct; lib/guest.ts): one-tap sign-in, sample AI, read-only admin, and nothing that can
// reach real data or keep a child's words.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as homework from "@/app/api/kix/homework/route";
import * as vibe from "@/app/api/vibe/route";
import { proxy } from "@/proxy";
import { authMode } from "./auth/context.ts";
import { ABBY_ID, DEMO_HOUSEHOLD_ID, JORDAN_ID, KAI_ID } from "./auth/demo-family.ts";
import { resetRateLimits } from "./auth/lockout.ts";
import { resetDemoStore } from "./auth/store-demo.ts";
import { guestMayWrite, isGuest } from "./guest.ts";
import { explanationSchema } from "./kix/homework.ts";
import { guestLesson, guestQuestions } from "./kix/guest-samples.ts";
import { hasMetaApiKey } from "./meta/client.ts";

class Browser {
  jar = new Map<string, string>();
  async post(handler: (req: Request) => Promise<Response>, path: string, body: unknown) {
    const headers = new Headers({ "content-type": "application/json" });
    if (this.jar.size) headers.set("cookie", [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await handler(new Request(`http://localhost${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const [k, ...v] = pair.split("=");
      this.jar.set(k, v.join("="));
    }
    return { status: res.status, body: JSON.parse(await res.text()) };
  }
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "guest-test-secret-0123456789abcdefghij");
  vi.stubEnv("NEXT_PUBLIC_MYKX_GUEST", "1");
  resetRateLimits();
  resetDemoStore();
});
afterEach(() => vi.unstubAllEnvs());

describe("the guest site's walls", () => {
  it("uses the in-memory sample family and no model, even if real keys were set by mistake", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://real.example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sk");
    vi.stubEnv("MODEL_API_KEY", "a-real-looking-key");
    expect(isGuest()).toBe(true);
    expect(authMode()).toBe("demo");
    expect(hasMetaApiKey()).toBe(false);
  });

  it("allows reads and the walkthrough's writes only", () => {
    expect(guestMayWrite("GET", "/api/admin/people")).toBe(true);
    for (const [m, p] of [["POST", "/api/auth/guest"], ["POST", "/api/attempts"], ["POST", "/api/games/round"], ["POST", "/api/kix/homework"], ["DELETE", "/api/auth/kid"]]) expect(guestMayWrite(m, p)).toBe(true);
    for (const [m, p] of [["POST", "/api/messages"], ["PATCH", "/api/family/kids/x"], ["POST", "/api/admin/skills/p3-maths"], ["PATCH", "/api/me"], ["POST", "/api/auth/pin"], ["POST", "/api/auth/kid"], ["PUT", "/api/notebook"], ["DELETE", "/api/admin/agents/tutor"]]) expect(guestMayWrite(m, p)).toBe(false);
  });

  it("the proxy refuses a guest's change and passes everything on the real site", async () => {
    const refused = proxy(new NextRequest("http://localhost/api/family/kids/abc", { method: "PATCH" }));
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ reason: "guest" });
    expect(proxy(new NextRequest("http://localhost/api/admin/people")).status).toBe(200);
    vi.stubEnv("NEXT_PUBLIC_MYKX_GUEST", "");
    expect(proxy(new NextRequest("http://localhost/api/family/kids/abc", { method: "PATCH" })).status).toBe(200);
  });
});

describe("one-tap guest sign-in", () => {
  it("doesn't exist on the real site", async () => {
    vi.stubEnv("NEXT_PUBLIC_MYKX_GUEST", "");
    expect((await new Browser().post(guestRoute.POST, "/api/auth/guest", { as: "parent" })).status).toBe(404);
  });

  it("opens the grown-up, or a kid by magic name or door, and nobody outside the sample family", async () => {
    const parent = new Browser();
    expect((await parent.post(guestRoute.POST, "/api/auth/guest", { as: "parent" })).body).toMatchObject({ ok: true, next: "/parent" });
    const byName = new Browser();
    expect((await byName.post(guestRoute.POST, "/api/auth/guest", { as: "kid", name: "Abby" })).body).toMatchObject({ ok: true, kid: { nickname: "Abby" } });
    expect(byName.jar.has("mykx_kid")).toBe(true);
    expect((await new Browser().post(guestRoute.POST, "/api/auth/guest", { as: "kid", kidId: JORDAN_ID })).body.kid.nickname).toBe("Jordan");
    expect((await new Browser().post(guestRoute.POST, "/api/auth/guest", { as: "kid", kidId: KAI_ID })).status).toBe(404);
    expect((await new Browser().post(guestRoute.POST, "/api/auth/guest", { as: "kid", name: "kai" })).status).toBe(404);
  });
});

describe("sample AI and nothing kept", () => {
  it("Ask Kix answers each level's sample questions with valid lessons, guide first", async () => {
    for (const level of ["P3", "P6", "Sec 2"]) {
      for (const q of guestQuestions(level)) {
        for (const stage of ["hint", "steps", "full"] as const) {
          const e = explanationSchema.parse(guestLesson(level, q, stage));
          expect(e.finalAnswer === null).toBe(stage !== "full");
        }
      }
    }
    const abby = new Browser();
    await abby.post(guestRoute.POST, "/api/auth/guest", { as: "kid", kidId: ABBY_ID });
    const q = guestQuestions("P6")[0];
    const r = await abby.post(homework.POST, "/api/kix/homework", { stage: "hint", text: q });
    expect(r.body).toMatchObject({ ok: true, sample: true, explanation: { question: q, finalAnswer: null } });
  });

  it("never keeps a child's typed words, and the Vibe Zone makes but never saves", async () => {
    const { demoStore } = await import("./auth/store-demo.ts");
    const kid = new Browser();
    await kid.post(guestRoute.POST, "/api/auth/guest", { as: "kid", kidId: JORDAN_ID });
    await kid.post(homework.POST, "/api/kix/homework", { stage: "hint", text: guestQuestions("P3")[0] });
    expect(await demoStore().guardian.messages(DEMO_HOUSEHOLD_ID, JORDAN_ID, new Date(Date.now() - 60_000).toISOString())).toEqual([]);
    const made = await kid.post(vibe.POST, "/api/vibe", { action: "make", request: "frog life cycle" });
    expect(made.status).toBe(200);
    expect((await kid.post(vibe.POST, "/api/vibe", { action: "save", id: null, spec: made.body.spec })).status).toBe(403);
  });
});
