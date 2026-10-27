// POST /api/attempts against the in-memory demo store: auth, marking and the
// ledger through the real route handler (synthetic data only).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as attemptsRoute from "./route.ts";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import { ARI_ID, DEMO_HOUSEHOLD_ID } from "@/lib/auth/demo-family";
import { resetRateLimits } from "@/lib/auth/lockout";
import { demoStore, resetDemoStore } from "@/lib/auth/store-demo";

const ARI_CODE = ["idle", "cheer", "pilot", "dreamlight"];

class Browser {
  cookies = new Map<string, string>();

  async post(handler: (req: Request) => Promise<Response>, path: string, body: unknown) {
    const headers = new Headers({ "content-type": "application/json" });
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await handler(new Request(`http://localhost${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      if (!value || attrs.some((a) => /max-age=0/i.test(a.trim()))) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }
}

let browser: Browser;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "attempts-test-secret-0123456789abcd");
  resetRateLimits();
  resetDemoStore();
  browser = new Browser();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function signInAri() {
  const parent = await browser.post(parentRoute.POST, "/api/auth/parent", { email: "anyone@example.com", password: "anything" });
  expect(parent.status).toBe(200);
  const kid = await browser.post(kidRoute.POST, "/api/auth/kid", { kidId: ARI_ID, secret: { kind: "pictures", code: ARI_CODE } });
  expect(kid.status).toBe(200);
}

describe("POST /api/attempts", () => {
  it("refuses without a kid session", async () => {
    const res = await browser.post(attemptsRoute.POST, "/api/attempts", { itemId: "p3sci-demo-01", response: 2, key: crypto.randomUUID() });
    expect(res).toMatchObject({ status: 401, body: { ok: false, reason: "no-kid" } });
  });

  it("marks a correct answer and pays the ledger", async () => {
    await signInAri();
    const res = await browser.post(attemptsRoute.POST, "/api/attempts", {
      itemId: "p3sci-demo-01",
      response: 2,
      explanation: "Eggs hatch into tadpoles",
      key: crypto.randomUUID(),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, correct: true, marks: 2, firstTry: true });
    const awards = res.body.awards as { rule: string; amount: number }[];
    expect(awards).toEqual([{ rule: "first_attempt", amount: 2 }]);
    expect(res.body.mastery).toContain("limited evidence");
  });

  it("404s unknown items and 400s bad bodies", async () => {
    await signInAri();
    expect((await browser.post(attemptsRoute.POST, "/api/attempts", { itemId: "nope", response: 1, key: crypto.randomUUID() })).status).toBe(404);
    expect((await browser.post(attemptsRoute.POST, "/api/attempts", { itemId: "p3sci-demo-01", response: 2 })).status).toBe(400);
  });

  it("writes attempts the quest map can read", async () => {
    await signInAri();
    await browser.post(attemptsRoute.POST, "/api/attempts", { itemId: "p3sci-demo-01", response: 2, explanation: "Why", key: crypto.randomUUID() });
    const store = demoStore();
    expect(await store.learn.attempts(DEMO_HOUSEHOLD_ID, ARI_ID)).toHaveLength(1);
  });
});
