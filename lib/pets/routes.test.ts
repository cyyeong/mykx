// The Pets routes (founder, 29 Oct): the kid's own pets, care decided by the rules, and the Critter Keeper's replies,
// which never keep a chat unless it holds distress words (then Kix's caring reply and the parent's urgent flag).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as petsRoute from "@/app/api/pets/route";
import * as talkRoute from "@/app/api/pets/talk/route";
import { DEMO_HOUSEHOLD_ID, JORDAN_ID } from "../auth/demo-family.ts";
import { resetRateLimits } from "../auth/lockout.ts";
import { demoStore, resetDemoStore } from "../auth/store-demo.ts";
import { guestMayWrite } from "../guest.ts";

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

let jordan: Browser;
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "pets-test-secret-0123456789abcdefghijkl");
  vi.stubEnv("NEXT_PUBLIC_MYKX_GUEST", "1");
  resetRateLimits();
  resetDemoStore();
  jordan = new Browser();
  await jordan.call(guestRoute.POST, "/api/auth/guest", { as: "kid", kidId: JORDAN_ID });
});
afterEach(() => vi.unstubAllEnvs());

describe("pets", () => {
  it("lists the kid's own pets and needs a kid", async () => {
    const r = await jordan.call(petsRoute.GET, "/api/pets");
    expect(r.body.pets.map((p: { species: string; stage: number }) => [p.species, p.stage]).sort()).toEqual([["frog", 1], ["mealworm", 2]]);
    expect((await new Browser().call(petsRoute.GET, "/api/pets")).status).toBe(401);
  });

  it("cares by the rules: the wrong food is refused with a reason, the right one fed", async () => {
    const wrong = await jordan.call(petsRoute.POST, "/api/pets", { action: "feed", species: "frog", food: "cricket" });
    expect(wrong.body.outcome).toMatchObject({ ok: false, reaction: "no" });
    const right = await jordan.call(petsRoute.POST, "/api/pets", { action: "feed", species: "frog", food: "algae" });
    expect(right.body.outcome).toMatchObject({ ok: true, reaction: "yum" });
    expect(right.body.pet.done.feed).toBe(3);
    expect((await jordan.call(petsRoute.POST, "/api/pets", { action: "clean", species: "butterfly" })).status).toBe(404);
    expect((await jordan.call(petsRoute.POST, "/api/pets", { action: "adopt", species: "butterfly" })).body.pet).toMatchObject({ species: "butterfly", stage: 0, generation: 1 });
    expect((await jordan.call(petsRoute.POST, "/api/pets", { action: "feed", species: "frog", food: "pizza" })).status).toBe(400);
  });

  it("grows the tadpole into a froglet once its last job is done", async () => {
    await jordan.call(petsRoute.POST, "/api/pets", { action: "feed", species: "frog", food: "lettuce" });
    const grew = await jordan.call(petsRoute.POST, "/api/pets", { action: "play", species: "frog" });
    expect(grew.body.outcome.reaction).toBe("grew");
    expect(grew.body.pet.stage).toBe(2);
  });
});

describe("the Critter Keeper", () => {
  it("answers as the pet without a model, keeps nothing, and tops up the love bar", async () => {
    const r = await jordan.call(talkRoute.POST, "/api/pets/talk", { species: "frog", text: "What do you eat?" });
    expect(r.body).toMatchObject({ ok: true, source: "cached" });
    expect(r.body.reply).toMatch(/algae/i);
    const need = await jordan.call(talkRoute.POST, "/api/pets/talk", { species: "frog", text: "What do you need?" });
    expect(need.body.reply).toMatch(/meal|play/);
    expect(await demoStore().guardian.messages(DEMO_HOUSEHOLD_ID, JORDAN_ID, new Date(Date.now() - 60_000).toISOString())).toEqual([]);
  });

  it("answers distress with Kix's caring reply and the helplines, and keeps that message for the parent's flag", async () => {
    vi.stubEnv("NEXT_PUBLIC_MYKX_GUEST", "");
    const r = await jordan.call(talkRoute.POST, "/api/pets/talk", { species: "frog", text: "I want to hurt myself" });
    expect(r.body.care.helplines).toBeTruthy();
    expect(r.body.reply).toBeUndefined();
    const kept = await demoStore().guardian.messages(DEMO_HOUSEHOLD_ID, JORDAN_ID, new Date(Date.now() - 60_000).toISOString());
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ distress: true });
  });

  it("is open to the guest walkthrough", () => {
    expect(guestMayWrite("POST", "/api/pets")).toBe(true);
    expect(guestMayWrite("POST", "/api/pets/talk")).toBe(true);
  });
});
