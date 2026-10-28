// Route-level tests against the in-memory demo store: kid sign-in, lockout, setup, family and admin
// routes, and the production guard. Calls the route handlers directly with Web Requests.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as adminPerson from "@/app/api/admin/people/[id]/route";
import * as adminPeople from "@/app/api/admin/people/route";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as kidsRoute from "@/app/api/auth/kids/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as pinRoute from "@/app/api/auth/pin/route";
import * as resetRoute from "@/app/api/auth/reset/route";
import * as signoutRoute from "@/app/api/auth/signout/route";
import * as familyKid from "@/app/api/family/kids/[id]/route";
import * as family from "@/app/api/family/kids/route";
import * as me from "@/app/api/me/route";
import * as focus from "@/app/api/signals/focus/route";
import { authMode } from "./context.ts";
import { JORDAN_ID, DEMO_HOUSEHOLD_ID, DEMO_PARENT_ID, KAI_ID, LEONARD_ID, OTHER_PARENT_EMAIL, OTHER_PARENT_ID } from "./demo-family.ts";
import { resetRateLimits } from "./lockout.ts";
import { DemoStore, demoStore, resetDemoStore } from "./store-demo.ts";

const JORDAN_CODE = ["idle", "cheer", "pilot", "dreamlight"];
const WRONG_CODE = ["idle", "cheer", "pilot", "hint"];

/** A browser: keeps cookies between calls and remembers every reply body. */
class Browser {
  cookies = new Map<string, string>();
  bodies: string[] = [];

  async call(handler: (req: Request, ctx: never) => Promise<Response>, path: string, init: { method?: string; body?: unknown; id?: string } = {}) {
    const headers = new Headers({ "content-type": "application/json" });
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const req = new Request(`http://localhost${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const res = await handler(req, { params: Promise.resolve({ id: init.id ?? "" }) } as never);
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      if (!value || attrs.some((a) => /max-age=0/i.test(a.trim()))) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    this.bodies.push(text);
    return { status: res.status, body: JSON.parse(text), headers: res.headers };
  }

  signIn(email = "anyone@example.com", password = "anything") {
    return this.call(parentRoute.POST, "/api/auth/parent", { body: { email, password } });
  }

  kidSignIn(kidId: string, secret: unknown, setup?: boolean) {
    return this.call(kidRoute.POST, "/api/auth/kid", { body: { kidId, secret, ...(setup ? { setup } : {}) } });
  }

  kidSignOut() {
    return this.call(kidRoute.DELETE, "/api/auth/kid", { method: "DELETE" });
  }

  pinSetup(pin: string) {
    return this.call(pinRoute.POST, "/api/auth/pin", { body: { action: "setup", pin } });
  }

  pinVerify(pin: string) {
    return this.call(pinRoute.POST, "/api/auth/pin", { body: { action: "verify", pin } });
  }
}

let browser: Browser;
let store: DemoStore;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "routes-test-secret-0123456789abcdefgh");
  resetRateLimits();
  store = resetDemoStore();
  browser = new Browser();
});

afterEach(() => {
  // Every reply this test saw: no hash, no secret, ever.
  for (const body of browser.bodies) {
    expect(body).not.toMatch(/scrypt\$|secretHash|secret_hash|hackmuse/);
  }
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("grown-up sign-in (demo mode)", () => {
  it("any email and password opens the demo parent, who is an admin", async () => {
    const res = await browser.signIn();
    expect(res).toMatchObject({ status: 200, body: { ok: true, role: "admin", next: "/admin/people" } });
    expect(browser.cookies.has("mykx_demo_parent")).toBe(true);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  });

  it("an empty password is invalid; a non-admin parent lands on /parent", async () => {
    expect((await browser.signIn("a@b.c", "")).status).toBe(400);
    expect((await browser.signIn(OTHER_PARENT_EMAIL)).body).toMatchObject({ role: "parent", next: "/parent" });
  });

  it("lists the household's doors with the grown-up's name", async () => {
    expect((await browser.call(kidsRoute.GET, "/api/auth/kids")).body).toEqual({ ok: true, signedIn: false, grownUp: null, kids: [] });
    await browser.signIn();
    const { body } = await browser.call(kidsRoute.GET, "/api/auth/kids");
    expect(body.grownUp).toBe("Demo Parent");
    expect(body.kids.map((d: { nickname: string; band: string; secretKind: string; needsSetup: boolean; locked: boolean }) => [d.nickname, d.band, d.secretKind, d.needsSetup, d.locked])).toEqual([
      ["Jordan", "junior", "pictures", false, false],
      ["Abby", "teen", "password", false, false],
      ["Leonard", "teen", "password", false, false],
    ]);
  });

  it("the reset route always says ok", async () => {
    expect((await browser.call(resetRoute.POST, "/api/auth/reset", { body: { email: "nobody@example.com" } })).body).toEqual({ ok: true });
  });
});

describe("kid sign-in", () => {
  it("needs a grown-up signed in on the device", async () => {
    expect(await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE })).toMatchObject({ status: 403, body: { ok: false, reason: "no-parent" } });
  });

  it("can't open another household's kid", async () => {
    await browser.signIn();
    expect(await browser.kidSignIn(KAI_ID, { kind: "pictures", code: ["hint", "toon-pop", "pilot", "idle"] })).toMatchObject({ status: 403, body: { reason: "not-found" } });
  });

  it("opens Jordan's door with her picture code and Leonard's with her password", async () => {
    await browser.signIn();
    const res = await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    expect(res).toMatchObject({ status: 200, body: { ok: true, kid: { id: JORDAN_ID, nickname: "Jordan", band: "junior", pack: "terrarium" }, next: "/home" } });
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("mykx_kid="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=43200/i);
    expect(cookie).toMatch(/Path=\//i);
    expect((await browser.call(me.GET, "/api/me")).body).toMatchObject({ ok: true, kid: { id: JORDAN_ID, nickname: "Jordan", secretKind: "pictures" } });

    expect((await browser.kidSignIn(LEONARD_ID, { kind: "password", password: "hackmuse" })).status).toBe(200);
    expect((await browser.call(me.GET, "/api/me")).body.kid.nickname).toBe("Leonard");
  });

  it("rejects a disabled kid and a picture code on a password door", async () => {
    await browser.signIn();
    expect((await browser.kidSignIn(LEONARD_ID, { kind: "pictures", code: JORDAN_CODE })).body.reason).toBe("wrong-kind");
    store.profiles.set(LEONARD_ID, { ...store.profiles.get(LEONARD_ID)!, disabledAt: new Date().toISOString() });
    expect(await browser.kidSignIn(LEONARD_ID, { kind: "password", password: "hackmuse" })).toMatchObject({ status: 403, body: { reason: "disabled" } });
  });

  it("locks after 5 wrong tries, unlocks after a minute, and a success resets the count", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T08:00:00Z"));
    await browser.signIn();
    const left = [];
    for (let i = 0; i < 4; i++) {
      const res = await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: WRONG_CODE });
      expect(res.status).toBe(401);
      left.push(res.body.triesLeft);
    }
    expect(left).toEqual([4, 3, 2, 1]);
    expect(await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: WRONG_CODE })).toMatchObject({ status: 423, body: { ok: false, reason: "locked", retryAfterSec: 60 } });
    expect(store.auditLog.filter((a) => a.action === "kid.lockout")).toMatchObject([{ actorRole: "system", target: JORDAN_ID, householdId: DEMO_HOUSEHOLD_ID }]);

    // Locked: even the right code waits, and the door shows it.
    vi.setSystemTime(new Date("2026-10-27T08:00:30Z"));
    expect(await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE })).toMatchObject({ status: 423, body: { retryAfterSec: 30 } });
    expect((await browser.call(kidsRoute.GET, "/api/auth/kids")).body.kids[0]).toMatchObject({ id: JORDAN_ID, locked: true });

    // A minute on: open again. Two wrong, then right, then the count starts over.
    vi.setSystemTime(new Date("2026-10-27T08:01:01Z"));
    expect((await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: WRONG_CODE })).body.triesLeft).toBe(4);
    expect((await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: WRONG_CODE })).body.triesLeft).toBe(3);
    expect((await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE })).status).toBe(200);
    expect(store.profiles.get(JORDAN_ID)!.failedAttempts).toBe(0);
    expect((await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: WRONG_CODE })).body.triesLeft).toBe(4);
  });

  it("ends with the grown-up: sign-out clears it, and another grown-up can't use it", async () => {
    await browser.signIn();
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    const kidCookie = browser.cookies.get("mykx_kid")!;

    const other = new Browser();
    await other.signIn(OTHER_PARENT_EMAIL);
    other.cookies.set("mykx_kid", kidCookie);
    expect(await other.call(me.GET, "/api/me")).toMatchObject({ status: 401, body: { reason: "no-kid" } });

    expect((await browser.call(signoutRoute.POST, "/api/auth/signout", { body: {} })).body).toEqual({ ok: true });
    expect(browser.cookies.has("mykx_kid")).toBe(false);
    expect(browser.cookies.has("mykx_demo_parent")).toBe(false);
    browser.cookies.set("mykx_kid", kidCookie);
    expect((await browser.call(me.GET, "/api/me")).status).toBe(401);
  });

  it("sign out everywhere ends the grown-up's other sessions too", async () => {
    await browser.signIn();
    const second = new Browser();
    await second.signIn();
    await browser.call(signoutRoute.POST, "/api/auth/signout", { body: { everywhere: true } });
    expect((await second.call(kidsRoute.GET, "/api/auth/kids")).body.signedIn).toBe(false);
  });
});

describe("picture code setup at the door", () => {
  it("a new pictures kid needs setup; setup sets the code once and signs in", async () => {
    await browser.signIn();
    const added = await browser.call(family.POST, "/api/family/kids", { body: { nickname: "Juno", level: "P3", pack: "dreamlight" } });
    expect(added).toMatchObject({ status: 201, body: { kid: { nickname: "Juno", band: "junior", secretKind: "pictures", needsSetup: true, secretSetAt: null, secretEvent: null } } });
    const id = added.body.kid.id;
    const code = { kind: "pictures", code: ["pilot", "pilot", "hint", "cheer"] };

    expect(await browser.kidSignIn(id, code)).toMatchObject({ status: 409, body: { reason: "needs-setup" } });
    expect(await browser.kidSignIn(id, code, true)).toMatchObject({ status: 200, body: { kid: { id, nickname: "Juno" } } });
    expect(await browser.kidSignIn(id, code, true)).toMatchObject({ status: 409, body: { reason: "already-set" } });
    expect((await browser.kidSignIn(id, code)).status).toBe(200);
    // Grown-up reads wait until the kid signs out (fix 8); the unlock would also do.
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(403);
    await browser.kidSignOut();
    const kid = (await browser.call(family.GET, "/api/family/kids")).body.kids.find((k: { id: string }) => k.id === id);
    expect(kid).toMatchObject({ needsSetup: false, secretEvent: "set" });
  });
});

describe("Your family", () => {
  it("needs a grown-up", async () => {
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(401);
  });

  it("lists kids with the household name and the fields the board shows", async () => {
    await browser.signIn();
    const { body } = await browser.call(family.GET, "/api/family/kids");
    expect(body.household).toEqual({ id: DEMO_HOUSEHOLD_ID, name: "Demo family" });
    expect(Object.keys(body.kids[0]).sort()).toEqual(
      ["band", "cameraEnabled", "dailyLimitMin", "disabled", "id", "lastSignInAt", "level", "locked", "needsSetup", "nickname", "pack", "secretEvent", "secretKind", "secretSetAt", "synthetic", "voiceEnabled"].sort(),
    );
  });

  it("adds a teen with a password (8+), refuses duplicates and a missing password", async () => {
    await browser.signIn();
    const add = (body: object) => browser.call(family.POST, "/api/family/kids", { body });
    expect((await add({ nickname: "Rin", level: "Sec 2", pack: "anime-sky" })).status).toBe(400);
    expect((await add({ nickname: "Rin", level: "Sec 2", pack: "anime-sky", secret: { kind: "password", password: "short12" } })).status).toBe(400);
    const ok = await add({ nickname: "  Rin  ", level: "Sec 2", pack: "anime-sky", secret: { kind: "password", password: "comets99" } });
    expect(ok).toMatchObject({ status: 201, body: { kid: { nickname: "Rin", band: "teen", secretKind: "password", needsSetup: false, secretEvent: "set" } } });
    expect((await add({ nickname: "rin", level: "P6", pack: "toon-pop", secret: { kind: "password", password: "comets99" } })).body.reason).toBe("taken");
    expect(store.auditLog.map((a) => a.action)).toContain("kid.add");
  });

  it("resets codes, changes settings and removes a kid with a confirm step", async () => {
    await browser.signIn();
    const reset = await browser.call(familyKid.PATCH, `/api/family/kids/${JORDAN_ID}`, { method: "PATCH", id: JORDAN_ID, body: { secret: { kind: "pictures" }, dailyLimitMin: 20 } });
    expect(reset.body.kid).toMatchObject({ needsSetup: true, secretEvent: "reset", dailyLimitMin: 20 });
    expect((await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE })).body.reason).toBe("needs-setup");

    const temp = await browser.call(familyKid.PATCH, `/api/family/kids/${LEONARD_ID}`, { method: "PATCH", id: LEONARD_ID, body: { secret: { kind: "password", password: "temporary1" } } });
    expect(temp.body.kid).toMatchObject({ needsSetup: false, secretEvent: "reset" });
    expect((await browser.kidSignIn(LEONARD_ID, { kind: "password", password: "hackmuse" })).status).toBe(401);
    expect((await browser.kidSignIn(LEONARD_ID, { kind: "password", password: "temporary1" })).status).toBe(200);

    // The gate fires before the household check; after sign-out the 404 shows through.
    expect((await browser.call(familyKid.PATCH, `/api/family/kids/${KAI_ID}`, { method: "PATCH", id: KAI_ID, body: { voiceEnabled: false } })).status).toBe(403);
    await browser.kidSignOut();
    expect((await browser.call(familyKid.PATCH, `/api/family/kids/${KAI_ID}`, { method: "PATCH", id: KAI_ID, body: { voiceEnabled: false } })).status).toBe(404);
    expect((await browser.call(familyKid.DELETE, `/api/family/kids/${LEONARD_ID}`, { method: "DELETE", id: LEONARD_ID, body: { confirm: "mei" } })).body.reason).toBe("confirm");
    expect((await browser.call(familyKid.DELETE, `/api/family/kids/${LEONARD_ID}`, { method: "DELETE", id: LEONARD_ID, body: { confirm: "Leonard" } })).body).toEqual({ ok: true });
    expect(store.profiles.has(LEONARD_ID)).toBe(false);
    expect(store.auditLog.map((a) => a.action)).toEqual(expect.arrayContaining(["kid.secret-reset", "kid.remove"]));
  });
});

describe("Me", () => {
  it("changes nickname and code (old one first)", async () => {
    await browser.signIn();
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    expect((await browser.call(me.PATCH, "/api/me", { method: "PATCH", body: { nickname: "x".repeat(21) } })).status).toBe(400);
    expect((await browser.call(me.PATCH, "/api/me", { method: "PATCH", body: { nickname: "  Jordan the Bold " } })).body.kid.nickname).toBe("Jordan the Bold");

    const newCode = { kind: "pictures", code: ["toon-pop", "pilot", "pilot", "cheer"] };
    const wrong = await browser.call(me.PATCH, "/api/me", { method: "PATCH", body: { secret: { old: { kind: "pictures", code: WRONG_CODE }, new: newCode } } });
    expect(wrong).toMatchObject({ status: 401, body: { reason: "wrong", triesLeft: 4 } });
    expect((await browser.call(me.PATCH, "/api/me", { method: "PATCH", body: { secret: { old: { kind: "pictures", code: JORDAN_CODE }, new: newCode } } })).status).toBe(200);
    expect(store.profiles.get(JORDAN_ID)).toMatchObject({ secretEvent: "changed", failedAttempts: 0 });
    expect((await browser.kidSignIn(JORDAN_ID, newCode)).status).toBe(200);
  });

  it("is 401 without a kid session", async () => {
    await browser.signIn();
    expect((await browser.call(me.GET, "/api/me")).status).toBe(401);
  });
});

describe("focus camera (AGENTS.md rule 12)", () => {
  const base = Math.floor(Date.now() / 60_000) * 60_000 - 40 * 60_000;
  const at = (i: number) => new Date(base + i * 60_000).toISOString();
  const calm = (i: number) => ({ minute: at(i), awaySeconds: 3, eyesClosedEvents: 0, yawns: 0, facePresentRatio: 1 });
  const drifting = (i: number) => ({ minute: at(i), awaySeconds: 35, eyesClosedEvents: 1, yawns: 1, facePresentRatio: 1 });
  const post = (body: unknown) => browser.call(focus.POST, "/api/signals/focus", { body });
  const cameraOn = (on: boolean) => browser.call(familyKid.PATCH, `/api/family/kids/${JORDAN_ID}`, { method: "PATCH", id: JORDAN_ID, body: { cameraEnabled: on } });

  it("is off by default; the grown-up switches it per kid", async () => {
    await browser.signIn();
    expect((await browser.call(family.GET, "/api/family/kids")).body.kids.every((k: { cameraEnabled: boolean }) => k.cameraEnabled === false)).toBe(true);
    expect((await cameraOn(true)).body.kid).toMatchObject({ id: JORDAN_ID, cameraEnabled: true, voiceEnabled: true });
    expect(store.auditLog.at(-1)).toMatchObject({ action: "kid.update", detail: { fields: ["camera_enabled"] } });
    expect((await cameraOn(false)).body.kid.cameraEnabled).toBe(false);
  });

  it("takes counts only from a signed-in kid whose camera is on", async () => {
    expect((await post({ minutes: [calm(0)] })).status).toBe(401);
    await browser.signIn();
    expect((await post({ minutes: [calm(0)] })).body.reason).toBe("no-kid");
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    expect((await post({ minutes: [calm(0)] })).body).toMatchObject({ ok: false, reason: "not-allowed" });
    expect(store.focusMinuteRows.size).toBe(0);
  });

  it("refuses anything that isn't counts: images, frames, landmarks, odd minutes, stale batches", async () => {
    await browser.signIn();
    await cameraOn(true);
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    for (const body of [
      { minutes: [calm(0)], image: "data:image/jpeg;base64,/9j/4AAQ" },
      { minutes: [{ ...calm(0), frame: "AAAA" }] },
      { minutes: [{ ...calm(0), landmarks: [[0.1, 0.2, 0.3]] }] },
      { minutes: [{ ...calm(0), minute: new Date(base + 1234).toISOString() }] },
      { minutes: [{ ...calm(0), awaySeconds: 61 }] },
      { minutes: [{ ...calm(0), minute: new Date(base - 7 * 3_600_000).toISOString() }] },
      { minutes: [] },
      { minutes: Array.from({ length: 11 }, (_, i) => calm(i)) },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(store.focusMinuteRows.size).toBe(0);
  });

  it("stores the minutes, returns the kid's usual, and checks a dip itself before keeping its own words", async () => {
    await browser.signIn();
    await cameraOn(true);
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    const first = await post({ minutes: Array.from({ length: 10 }, (_, i) => calm(i)) });
    expect(first.body).toMatchObject({ ok: true, saved: 10, noted: false, baseline: { fromDefault: false, minutes: 10, score: 98 } });

    // A reading the counts don't support is dropped.
    const unsupported = { level: "watch", evidence: "Jordan is lazy.", confidence: "high", from: at(10), to: at(13) };
    expect((await post({ minutes: [calm(10), calm(11), calm(12)], signal: unsupported })).body.noted).toBe(false);

    // A real dip is kept, in the server's words, not the browser's.
    const reading = { level: "watch", evidence: "Jordan is lazy.", confidence: "high", from: at(13), to: at(16) };
    const res = await post({ minutes: [drifting(13), drifting(14), drifting(15)], signal: reading });
    expect(res.body).toMatchObject({ ok: true, saved: 3, noted: true });
    // The notes are the grown-up's: the kid signed in on the device can't read them.
    expect((await browser.call(focus.GET, "/api/signals/focus")).status).toBe(403);
    const grownUp = new Browser();
    await grownUp.signIn();
    const notes = (await grownUp.call(focus.GET, "/api/signals/focus")).body.notes;
    const mine = notes.find((n: { synthetic: boolean }) => !n.synthetic);
    expect(mine).toMatchObject({ kidId: JORDAN_ID, from: at(13), to: at(16), synthetic: false });
    expect(mine.evidence).toMatch(/^In 3 minutes: looked away 1 min 45 s/);
    expect(mine.evidence).not.toContain("lazy");
    expect(store.focusMinuteRows.size).toBe(16);
    // Resending the same minutes doesn't double them, and the same dip isn't noted twice.
    expect((await post({ minutes: [drifting(13), drifting(14), drifting(15)], signal: reading })).body.noted).toBe(false);
    expect(store.focusMinuteRows.size).toBe(16);
    // Nothing but counts was kept for a minute.
    expect(Object.keys([...store.focusMinuteRows.values()][0].minute).sort()).toEqual(["awaySeconds", "eyesClosedEvents", "facePresentRatio", "minute", "yawns"]);
  });

  it("stops the camera when the grown-up switches it off mid-session", async () => {
    await browser.signIn();
    expect((await browser.pinSetup("4821")).status).toBe(200);
    await cameraOn(true);
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    expect((await post({ minutes: [calm(0)] })).status).toBe(200);
    // The switch-off needs the PIN unlock while Jordan is signed in.
    expect((await cameraOn(false)).status).toBe(403);
    expect((await browser.pinVerify("4821")).status).toBe(200);
    await cameraOn(false);
    expect((await post({ minutes: [calm(1)] })).status).toBe(403);
  });

  it("shows notes to the kid's own grown-up only (with Jordan's labelled sample), who can remove one", async () => {
    await browser.signIn();
    const notes = (await browser.call(focus.GET, "/api/signals/focus")).body.notes;
    expect(notes).toEqual([expect.objectContaining({ kidId: JORDAN_ID, synthetic: true, confidence: "medium" })]);
    const sampleId = notes[0].id;

    const other = new Browser();
    await other.signIn(OTHER_PARENT_EMAIL);
    expect((await other.call(focus.GET, "/api/signals/focus")).body.notes).toEqual([]);
    expect((await other.call(focus.DELETE, "/api/signals/focus", { method: "DELETE", body: { id: sampleId } })).status).toBe(404);

    expect((await browser.call(focus.DELETE, "/api/signals/focus", { method: "DELETE", body: { id: sampleId } })).body).toEqual({ ok: true });
    expect((await browser.call(focus.GET, "/api/signals/focus")).body.notes).toEqual([]);
    expect(store.auditLog.at(-1)).toMatchObject({ action: "signal.remove", target: JORDAN_ID, detail: { kind: "focus-watch" } });
    expect((await new Browser().call(focus.GET, "/api/signals/focus")).status).toBe(401);
  });
});

describe("admin People", () => {
  it("is 403 for a parent who isn't an admin, and for nobody", async () => {
    expect((await browser.call(adminPeople.GET, "/api/admin/people")).status).toBe(403);
    await browser.signIn(OTHER_PARENT_EMAIL);
    expect(await browser.call(adminPeople.GET, "/api/admin/people?q=demo")).toMatchObject({ status: 403, body: { ok: false } });
    expect((await browser.call(adminPerson.POST, `/api/admin/people/${JORDAN_ID}`, { id: JORDAN_ID, body: { action: "lock" } })).status).toBe(403);
    expect(store.profiles.get(JORDAN_ID)!.lockedUntil).toBeNull();
  });

  it("searches accounts: role, status, last sign-in; parents' emails; nothing else", async () => {
    await browser.signIn();
    const { body } = await browser.call(adminPeople.GET, "/api/admin/people?q=kai");
    expect(body.households).toHaveLength(1);
    expect(body.households[0].name).toBe("Other demo family");
    const people = body.households[0].people;
    expect(people.map((p: { role: string; nickname: string; status: string }) => [p.role, p.nickname, p.status])).toEqual([
      ["parent", "Other Parent", "active"],
      ["child", "Kai", "active"],
    ]);
    expect(people[0].email).toBe(OTHER_PARENT_EMAIL);
    expect(people[1].email).toBeNull();
    expect(Object.keys(people[1]).sort()).toEqual(["band", "email", "id", "isAdmin", "lastSignInAt", "level", "nickname", "role", "status", "synthetic"]);
  });

  it("locks, unlocks, resets a kid's code and disables a parent, each with an audit row", async () => {
    await browser.signIn();
    const act = (id: string, action: string) => browser.call(adminPerson.POST, `/api/admin/people/${id}`, { id, body: { action } });
    expect((await act(KAI_ID, "lock")).body.person).toMatchObject({ status: "locked" });

    const other = new Browser();
    await other.signIn(OTHER_PARENT_EMAIL);
    expect(await other.kidSignIn(KAI_ID, { kind: "pictures", code: ["hint", "toon-pop", "pilot", "idle"] })).toMatchObject({ status: 423, body: { retryAfterSec: null } });
    expect((await act(KAI_ID, "unlock")).body.person.status).toBe("active");
    expect((await other.kidSignIn(KAI_ID, { kind: "pictures", code: ["hint", "toon-pop", "pilot", "idle"] })).status).toBe(200);

    await act(KAI_ID, "reset-kid-secret");
    expect((await other.call(kidsRoute.GET, "/api/auth/kids")).body.kids[0]).toMatchObject({ id: KAI_ID, needsSetup: true });
    expect((await act(KAI_ID, "grant-admin")).body.reason).toBe("not-allowed");

    const parentId = OTHER_PARENT_ID;
    expect((await act(parentId, "disable")).body.person.status).toBe("disabled");
    expect((await other.call(kidsRoute.GET, "/api/auth/kids")).body.signedIn).toBe(false);
    expect((await other.signIn(OTHER_PARENT_EMAIL)).status).toBe(401); // banned at the auth provider
    expect((await act(parentId, "enable")).body.person.status).toBe("active");

    expect((await act(DEMO_PARENT_ID, "disable")).body.reason).toBe("self");
    expect((await act(DEMO_PARENT_ID, "revoke-admin")).body.reason).toBe("self");
    expect(store.auditLog.filter((a) => a.actorRole === "admin").map((a) => a.action)).toEqual([
      "admin.lock",
      "admin.unlock",
      "admin.reset-kid-secret",
      "admin.disable",
      "admin.enable",
    ]);
  });
});

describe("grown-up sign-in destinations (fix 6)", () => {
  it("honours a safe ?next= and falls back on an off-list one", async () => {
    const safe = await browser.call(parentRoute.POST, "/api/auth/parent", { body: { email: "a@b.c", password: "x", next: "/family" } });
    expect(safe.body).toMatchObject({ ok: true, next: "/family" });
    const evil = await browser.call(parentRoute.POST, "/api/auth/parent", { body: { email: "a@b.c", password: "x", next: "https://evil.example" } });
    expect(evil.body).toMatchObject({ ok: true, next: "/admin/people" });
    const kid = await browser.call(parentRoute.POST, "/api/auth/parent", { body: { email: "a@b.c", password: "x", next: "/home" } });
    expect(kid.body).toMatchObject({ ok: true, next: "/admin/people" });
  });
});

describe("parent PIN (fix 8)", () => {
  const pin = (action: string, pin: string) => browser.call(pinRoute.POST, "/api/auth/pin", { body: { action, pin } });

  it("starts unset; setup needs four digits; the grown-up can change it on a kid-free device", async () => {
    await browser.signIn();
    expect((await browser.call(pinRoute.GET, "/api/auth/pin")).body).toMatchObject({ ok: true, set: false, kidActive: false, shared: false, unlocked: false });
    expect((await pin("setup", "12")).status).toBe(400);
    expect(await pin("setup", "4821")).toMatchObject({ status: 200, body: { ok: true, set: true } });
    expect((await pin("setup", "0000")).status).toBe(200);
    expect(store.auditLog.at(-1)).toMatchObject({ action: "parent.pin-change" });
  });

  it("Switch profile doesn't open grown-up pages: the PIN stays until the grown-up's password", async () => {
    await browser.signIn();
    await pin("setup", "4821");
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(403);
    await browser.kidSignOut();
    expect(browser.cookies.has("mykx_kidshere")).toBe(true);
    expect((await browser.call(pinRoute.GET, "/api/auth/pin")).body).toMatchObject({ kidActive: false, shared: true, unlocked: false });
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(403);
    expect((await browser.call(focus.GET, "/api/signals/focus")).status).toBe(403);
    expect((await browser.call(adminPeople.GET, "/api/admin/people")).status).toBe(403);
    // ...and can't set a new PIN to get in.
    expect((await pin("setup", "0000")).status).toBe(403);
    expect((await pin("verify", "4821")).status).toBe(200);
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(200);

    // Forgot it: the grown-up signs in again with their password, and the device is theirs.
    const fresh = new Browser();
    fresh.cookies = new Map([...browser.cookies].filter(([k]) => k !== "mykx_pinunlock"));
    await fresh.signIn();
    expect(fresh.cookies.has("mykx_kidshere")).toBe(false);
    expect((await fresh.call(family.GET, "/api/family/kids")).status).toBe(200);
    expect((await fresh.call(pinRoute.POST, "/api/auth/pin", { body: { action: "setup", pin: "7316" } })).status).toBe(200);
  });

  it("without a PIN, a kid-free moment opens the pages so the grown-up can set one", async () => {
    await browser.signIn();
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(403);
    await browser.kidSignOut();
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(200);
    expect((await pin("setup", "4821")).status).toBe(200);
    expect((await browser.call(family.GET, "/api/family/kids")).status).toBe(403);
  });

  it("pauses after 5 wrong PINs without locking the grown-up or the kid out", async () => {
    await browser.signIn();
    await pin("setup", "4821");
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    for (let i = 0; i < 5; i++) expect((await pin("verify", "0000")).status).toBe(401);
    expect((await pin("verify", "4821")).status).toBe(423);
    expect((await browser.call(me.GET, "/api/me")).status).toBe(200);
    expect((await browser.call(kidsRoute.GET, "/api/auth/kids")).body).toMatchObject({ signedIn: true });
    vi.useFakeTimers({ now: Date.now() + 5 * 60_000 + 1000 });
    expect((await pin("verify", "4821")).status).toBe(200);
  });

  it("setup refuses while a kid is signed in; verify mints the unlock", async () => {
    await browser.signIn();
    await pin("setup", "4821");
    await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE });
    expect((await browser.call(pinRoute.GET, "/api/auth/pin")).body).toMatchObject({ ok: true, set: true, kidActive: true, unlocked: false });
    expect((await pin("setup", "0000")).status).toBe(403);
    expect((await pin("verify", "0000")).status).toBe(401);
    expect(await pin("verify", "4821")).toMatchObject({ status: 200, body: { ok: true, unlocked: true } });
    expect(browser.cookies.has("mykx_pinunlock")).toBe(true);
    expect((await browser.call(pinRoute.GET, "/api/auth/pin")).body).toMatchObject({ unlocked: true });
  });

  it("needs a grown-up session throughout", async () => {
    expect((await browser.call(pinRoute.GET, "/api/auth/pin")).status).toBe(401);
    expect((await pin("verify", "4821")).status).toBe(401);
  });
});

describe("demo mode never runs in production", () => {
  it("authMode is off in production without Supabase, and the demo store refuses to start", async () => {
    expect(authMode({ NODE_ENV: "development" })).toBe("demo");
    expect(authMode({ NODE_ENV: "production" })).toBe("off");
    expect(authMode({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })).toBe("off"); // half set up
    expect(authMode({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk", SUPABASE_SECRET_KEY: "sk" })).toBe("supabase");
    vi.stubEnv("NODE_ENV", "production");
    expect(authMode()).toBe("off");
    expect(() => new DemoStore()).toThrow(/production/);
    expect(() => demoStore()).toThrow(/production/);
  });

  it("routes answer 503 not-configured in a production build without Supabase", async () => {
    await browser.signIn(); // a demo cookie from dev must not help either
    vi.stubEnv("NODE_ENV", "production");
    for (const res of [
      await browser.signIn(),
      await browser.kidSignIn(JORDAN_ID, { kind: "pictures", code: JORDAN_CODE }),
      await browser.call(kidsRoute.GET, "/api/auth/kids"),
      await browser.call(adminPeople.GET, "/api/admin/people"),
    ]) {
      expect(res).toMatchObject({ status: 503, body: { ok: false, reason: "not-configured" } });
    }
  });
});
