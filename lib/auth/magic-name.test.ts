// Kids' magic names (founder, 29 Oct): a kid types their magic name on the sign-in page, their door comes, and the
// picture code or password signs them in with a solo session: no grown-up on the device.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as doorRoute from "@/app/api/auth/kid/door/route";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as familyKid from "@/app/api/family/kids/[id]/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as me from "@/app/api/me/route";
import { ABBY_ID, JORDAN_ID, LEONARD_ID } from "./demo-family.ts";
import { resetRateLimits } from "./lockout.ts";
import { resetDemoStore } from "./store-demo.ts";

class Browser {
  cookies = new Map<string, string>();
  async call(handler: (req: Request, ctx: never) => Promise<Response>, path: string, init: { method?: string; body?: unknown; id?: string } = {}) {
    const headers = new Headers({ "content-type": "application/json" });
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const req = new Request(`http://localhost${path}`, { method: init.method ?? (init.body === undefined ? "GET" : "POST"), headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    const res = await handler(req, { params: Promise.resolve({ id: init.id ?? "" }) } as never);
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      if (!value || attrs.some((a) => /max-age=0/i.test(a.trim()))) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return { status: res.status, body: JSON.parse(await res.text()) };
  }
  door(name: string) {
    return this.call(doorRoute.POST, "/api/auth/kid/door", { body: { name } });
  }
  open(secret: unknown) {
    return this.call(kidRoute.POST, "/api/auth/kid", { body: { door: true, secret } });
  }
}

const JORDAN_CODE = ["idle", "cheer", "pilot", "dreamlight"];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "magic-name-test-secret-0123456789abcd");
  resetRateLimits();
  resetDemoStore();
});
afterEach(() => vi.unstubAllEnvs());

describe("the magic-name door", () => {
  it("brings the right door for a magic name, whatever its case, and says no more", async () => {
    const b = new Browser();
    const r = await b.door("  Jordan ");
    expect(r.status).toBe(200);
    expect(r.body.door).toEqual({ nickname: "Jordan", pack: "terrarium", band: "junior", secretKind: "pictures" });
    expect(JSON.stringify(r.body)).not.toMatch(/id|household|hash|scrypt/i);
    expect(b.cookies.has("mykx_door")).toBe(true);
    expect((await b.door("nobody-here")).status).toBe(404);
  });

  it("signs the kid in with a solo session, and the kid's routes work without a grown-up", async () => {
    const b = new Browser();
    await b.door("jordan");
    const opened = await b.open({ kind: "pictures", code: JORDAN_CODE });
    expect(opened.status).toBe(200);
    expect(b.cookies.has("mykx_door")).toBe(false);
    expect(b.cookies.has("mykx_kid")).toBe(true);
    const mine = await b.call(me.GET, "/api/me");
    expect(mine.status).toBe(200);
    expect(mine.body.kid.nickname).toBe("Jordan");
  });

  it("asks for the magic name again without a door ticket, and locks after five wrong tries", async () => {
    const b = new Browser();
    expect((await b.open({ kind: "password", password: "local-demo-only" })).status).toBe(403);
    await b.door("abby");
    for (let i = 0; i < 4; i++) expect((await b.open({ kind: "password", password: "wrong-one" })).status).toBe(401);
    expect((await b.open({ kind: "password", password: "wrong-one" })).status).toBe(423);
    expect((await b.open({ kind: "password", password: "local-demo-only" })).status).toBe(423);
  });

  it("keeps a solo kid signed in after changing their own password", async () => {
    const kid = new Browser();
    await kid.door("abby");
    expect((await kid.open({ kind: "password", password: "local-demo-only" })).status).toBe(200);
    const changed = await kid.call(me.PATCH, "/api/me", { method: "PATCH", body: { secret: { old: { kind: "password", password: "local-demo-only" }, new: { kind: "password", password: "new-stars-7" } } } });
    expect(changed.status).toBe(200);
    expect((await kid.call(me.GET, "/api/me")).status).toBe(200);
  });

  it("ends a solo session when a grown-up resets the kid's password", async () => {
    const kid = new Browser();
    await kid.door("leonard");
    expect((await kid.open({ kind: "password", password: "local-demo-only" })).status).toBe(200);
    expect((await kid.call(me.GET, "/api/me")).status).toBe(200);
    const parent = new Browser();
    await parent.call(parentRoute.POST, "/api/auth/parent", { body: { email: "demo@mykx.ai", password: "x" } });
    const reset = await parent.call(familyKid.PATCH, `/api/family/kids/${LEONARD_ID}`, { method: "PATCH", id: LEONARD_ID, body: { secret: { kind: "password", password: "brand-new-9" } } });
    expect(reset.status).toBe(200);
    expect((await kid.call(me.GET, "/api/me")).status).toBe(401);
  });

  it("lets a grown-up set a unique magic name, and refuses a taken or badly formed one", async () => {
    const parent = new Browser();
    await parent.call(parentRoute.POST, "/api/auth/parent", { body: { email: "demo@mykx.ai", password: "x" } });
    const set = (id: string, username: unknown) => parent.call(familyKid.PATCH, `/api/family/kids/${id}`, { method: "PATCH", id, body: { username } });
    expect((await set(JORDAN_ID, "Starry-Jordan")).status).toBe(200);
    expect((await set(ABBY_ID, "starry-jordan")).status).toBe(409);
    expect((await set(ABBY_ID, "a!")).status).toBe(400);
    const b = new Browser();
    expect((await b.door("starry-jordan")).body.door.nickname).toBe("Jordan");
    expect((await b.door("jordan")).status).toBe(404);
  });
});
