import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as outings from "@/app/api/outings/route";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore } from "../auth/store-demo.ts";

async function call(handler: (r: Request) => Promise<Response>, cookie: string, init: { method?: string; body?: unknown } = {}) {
  const res = await handler(new Request("http://localhost/api/outings", { method: init.method ?? (init.body === undefined ? "GET" : "POST"), headers: { "content-type": "application/json", cookie }, body: init.body === undefined ? undefined : JSON.stringify(init.body) }));
  return { status: res.status, body: await res.json(), setCookie: res.headers.getSetCookie() };
}

let cookie = "";
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "outings-test-secret-0123456789abcdef");
  vi.stubEnv("MODEL_API_KEY", "");
  vi.stubEnv("META_API_KEY", "");
  resetRateLimits();
  resetDemoStore();
  const res = await parentRoute.POST(new Request("http://localhost/api/auth/parent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a@b.c", password: "x" }) }));
  cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
});
afterEach(() => vi.unstubAllEnvs());

describe("the outings route", () => {
  it("shows the demo family's sample with three searches left, and refuses a search without a Muse key", async () => {
    const r = await call(outings.GET, cookie);
    expect(r.body).toMatchObject({ left: 3, live: false, prefs: { homeArea: "Sengkang", radiusKm: 3 }, run: { source: "sample", area: "Sengkang" } });
    expect(r.body.run.ideas.length).toBeGreaterThanOrEqual(4);
    expect((await call(outings.POST, cookie, { body: {} })).status).toBe(503);
  });

  it("adds an idea to the plan and takes it out, and refuses one that isn't there", async () => {
    const id = (await call(outings.GET, cookie)).body.run.ideas[0].id;
    expect((await call(outings.PATCH, cookie, { method: "PATCH", body: { id, planned: true } })).body.planned).toEqual([id]);
    expect((await call(outings.GET, cookie)).body.run.planned).toEqual([id]);
    expect((await call(outings.PATCH, cookie, { method: "PATCH", body: { id, planned: false } })).body.planned).toEqual([]);
    expect((await call(outings.PATCH, cookie, { method: "PATCH", body: { id: "nope-nope", planned: true } })).status).toBe(404);
  });

  it("needs a grown-up", async () => {
    expect((await call(outings.GET, "")).status).toBe(401);
  });
});
