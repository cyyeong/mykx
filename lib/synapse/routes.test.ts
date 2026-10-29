// The kid's flag route (docs/prd/SYNAPSE.md §4): a Learn question from the kid's own level, upset words take the
// caring path first, the guest walkthrough keeps nothing, and a kid sees only their own outcomes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as reportRoute from "@/app/api/synapse/report/route";
import { ABBY_ID } from "../auth/demo-family.ts";
import { resetRateLimits } from "../auth/lockout.ts";
import { demoStore, resetDemoStore } from "../auth/store-demo.ts";

class Browser {
  jar = new Map<string, string>();
  async call(handler: (req: Request) => Promise<Response>, path: string, body?: unknown) {
    const headers = new Headers({ "content-type": "application/json" });
    if (this.jar.size) headers.set("cookie", [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await handler(new Request(`http://localhost${path}`, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const [k, ...v] = pair.split("=");
      this.jar.set(k, v.join("="));
    }
    return { status: res.status, body: JSON.parse(await res.text()) };
  }
}

let abby: Browser;
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("MODEL_API_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "synapse-test-secret-0123456789abcdefghijkl");
  resetRateLimits();
  resetDemoStore();
  abby = new Browser();
  await abby.call(parentRoute.POST, "/api/auth/parent", { email: "a@b.c", password: "x" });
  await abby.call(kidRoute.POST, "/api/auth/kid", { kidId: ABBY_ID, secret: { kind: "password", password: "local-demo-only" } });
});
afterEach(() => vi.unstubAllEnvs());

describe("flagging", () => {
  it("takes a report on the kid's own question and shows it as checking", async () => {
    const r = await abby.call(reportRoute.POST, "/api/synapse/report", { surface: "learn", kind: "typo", note: "a word looks wrong", itemId: "p6math-demo-01" });
    expect(r.status).toBe(200);
    expect(r.body.report).toMatchObject({ state: "checking", itemId: "p6math-demo-01" });
    const mine = await abby.call(reportRoute.GET, "/api/synapse/report");
    expect(mine.body.reports).toHaveLength(1);
    expect(JSON.stringify(mine.body)).not.toMatch(/householdId|profileId|review|model/);
    const stored = await demoStore().synapse.reports();
    expect(stored[0].case.item?.id).toBe("p6math-demo-01");
  });

  it("refuses another level's question and a reply without its signed turn", async () => {
    expect((await abby.call(reportRoute.POST, "/api/synapse/report", { surface: "learn", kind: "typo", note: null, itemId: "p3sci-lc-001" })).status).toBeGreaterThanOrEqual(403);
    expect((await abby.call(reportRoute.POST, "/api/synapse/report", { surface: "ask-kix", kind: "other", note: null, shown: "x" })).status).toBe(400);
  });

  it("takes upset words to Kix's caring reply, not to a reviewer", async () => {
    const r = await abby.call(reportRoute.POST, "/api/synapse/report", { surface: "learn", kind: "other", note: "I want to die, this is too hard", itemId: "p6math-demo-01" });
    expect(r.body.care.helplines.length).toBeGreaterThan(0);
    expect(r.body.report).toBeNull();
    expect(await demoStore().synapse.reports()).toHaveLength(0);
  });

  it("needs a kid", async () => {
    expect((await new Browser().call(reportRoute.POST, "/api/synapse/report", { surface: "learn", kind: "typo", itemId: "p6math-demo-01" })).status).toBe(401);
  });
});
