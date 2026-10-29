// The routes a question player calls refuse an item from another level's pack (founder, 29 Oct: "every data point
// and interaction is scoped to their subjects"): attempts, Kix Tutor, Kix on the reason and the interest spark.
// Through the real route handlers against the in-memory demo store (synthetic data only, no model key).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as attemptsRoute from "@/app/api/attempts/route";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as reasonRoute from "@/app/api/kix/reason/route";
import * as sparkRoute from "@/app/api/kix/spark/route";
import * as tutorRoute from "@/app/api/kix/tutor/route";
import { ABBY_ID, DEMO_SECRETS, JORDAN_ID, LEONARD_ID } from "../auth/demo-family.ts";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore } from "../auth/store-demo.ts";
import { subjectFor } from "./subjects.ts";

type Handler = (req: Request) => Promise<Response>;

class Browser {
  cookies = new Map<string, string>();
  async post(handler: Handler, path: string, body: unknown) {
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
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { text };
    }
    return { status: res.status, body: json, headers: res.headers };
  }
}

async function signIn(kidId: keyof typeof DEMO_SECRETS): Promise<Browser> {
  const b = new Browser();
  expect((await b.post(parentRoute.POST, "/api/auth/parent", { email: "anyone@example.com", password: "anything" })).status).toBe(200);
  expect((await b.post(kidRoute.POST, "/api/auth/kid", { kidId, secret: DEMO_SECRETS[kidId] })).status).toBe(200);
  return b;
}

const P3_ITEM = "p3sci-demo-03";
const p6Mcq = () => subjectFor("P6", "p6-maths")!.items.find((i) => i.type === "mcq")!;
const s2Mcq = () => subjectFor("Sec 2", "s2-science")!.items.find((i) => i.type === "mcq")!;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("META_API_KEY", "");
  vi.stubEnv("MODEL_API_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "scoping-test-secret-0123456789abcdef");
  resetRateLimits();
  resetDemoStore();
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/attempts is scoped to the kid's level", () => {
  it("refuses Abby (P6) a P3 item and Jordan (P3) a P6 item, and marks each kid's own", async () => {
    const abby = await signIn(ABBY_ID);
    expect((await abby.post(attemptsRoute.POST, "/api/attempts", { itemId: P3_ITEM, response: 1, key: crypto.randomUUID() })).status).toBe(403);
    const own = p6Mcq();
    const r = await abby.post(attemptsRoute.POST, "/api/attempts", { itemId: own.id, response: own.answer, key: crypto.randomUUID() });
    expect(r).toMatchObject({ status: 200, body: { ok: true, correct: true, kind: "marked" } });

    const jordan = await signIn(JORDAN_ID);
    expect((await jordan.post(attemptsRoute.POST, "/api/attempts", { itemId: own.id, response: own.answer, key: crypto.randomUUID() })).status).toBe(403);
    expect((await jordan.post(attemptsRoute.POST, "/api/attempts", { itemId: "nope", response: 1, key: crypto.randomUUID() })).status).toBe(404);
  });

  it("takes Leonard's written answer as practice and 400s an empty one", async () => {
    const leonard = await signIn(LEONARD_ID);
    const open = subjectFor("Sec 2", "s2-science")!.items.find((i) => i.type === "open")!;
    expect((await leonard.post(attemptsRoute.POST, "/api/attempts", { itemId: open.id, response: "", key: crypto.randomUUID() })).status).toBe(400);
    const r = await leonard.post(attemptsRoute.POST, "/api/attempts", { itemId: open.id, response: "It measures the potential difference across R2.", key: crypto.randomUUID() });
    expect(r).toMatchObject({ status: 200, body: { ok: true, correct: null, kind: "written" } });
  });
});

describe("Kix's routes refuse another level's item", () => {
  it("Kix Tutor: 403 for Leonard on a P3 item; his own Sec 2 item answers from his pack", async () => {
    const leonard = await signIn(LEONARD_ID);
    expect((await leonard.post(tutorRoute.POST, "/api/kix/tutor", { itemId: P3_ITEM, hint: 1 })).status).toBe(403);
    const own = await leonard.post(tutorRoute.POST, "/api/kix/tutor", { itemId: s2Mcq().id, hint: 1 });
    expect(own.status).toBe(200);
    expect(own.headers.get("x-kix-skill")).toMatch(/^s2-science@/);
  });

  it("Kix on the reason: 403 for Abby on a P3 item; fine on her own", async () => {
    const abby = await signIn(ABBY_ID);
    expect((await abby.post(reasonRoute.POST, "/api/kix/reason", { itemId: P3_ITEM, choice: 1, reason: "because frogs lay eggs", correct: false })).status).toBe(403);
    const own = p6Mcq();
    expect((await abby.post(reasonRoute.POST, "/api/kix/reason", { itemId: own.id, choice: 1, reason: "because the ratio stays the same", correct: false })).status).toBe(200);
  });

  it("The interest spark: 403 for Leonard on a P3 item; 404 for an unknown one", async () => {
    const leonard = await signIn(LEONARD_ID);
    expect((await leonard.post(sparkRoute.POST, "/api/kix/spark", { itemId: P3_ITEM, turn: 0 })).status).toBe(403);
    expect((await leonard.post(sparkRoute.POST, "/api/kix/spark", { itemId: "nope", turn: 0 })).status).toBe(404);
    expect((await leonard.post(sparkRoute.POST, "/api/kix/spark", { itemId: s2Mcq().id, turn: 0 })).status).toBe(200);
  });

  it("Jordan keeps the frog quest: his P3 items still work", async () => {
    const jordan = await signIn(JORDAN_ID);
    expect((await jordan.post(tutorRoute.POST, "/api/kix/tutor", { itemId: P3_ITEM, hint: 1 })).status).toBe(200);
    expect((await jordan.post(attemptsRoute.POST, "/api/attempts", { itemId: "p3sci-demo-01", response: 2, explanation: "Eggs hatch into tadpoles", key: crypto.randomUUID() })).body).toMatchObject({ ok: true, correct: true });
  });
});
