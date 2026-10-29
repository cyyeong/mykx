// Kix remembers and adapts (founder, 29 Oct): a hard day yesterday makes today gentler, and a focus dip brings a
// spark from what the kid loves. Both are deterministic choices; Muse Spark only voices the spark line.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as spark from "@/app/api/kix/spark/route";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as doorRoute from "@/app/api/auth/kid/door/route";
import type { StoredSessionRead } from "../auth/store.ts";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore } from "../auth/store-demo.ts";
import { nextStep, type NextStepInput } from "../guardian/next-step.ts";
import { JUNIOR_SETTINGS, screenTimeByDay } from "../guardian/screen-time.ts";
import { loadFrogItems } from "../learn/frog-quest.ts";
import { cleanInterests, pickSpark } from "./interests.ts";
import { sampleTender, tenderToday, toneNote } from "./today.ts";

const NOW = "2026-10-29T09:00:00Z"; // 5 pm in Singapore
const read = (end: string, mood: string, concern = false): StoredSessionRead => ({ sessionStart: end, sessionEnd: end, mood, confidence: "medium", evidence: [], concern });

describe("tender today", () => {
  it("goes gently after a hard last session on an earlier day, and says nothing in the prompt otherwise", () => {
    const t = tenderToday({ reads: [read("2026-10-28T10:00:00Z", "frustrated")], now: NOW, todayMood: null });
    expect(t).toEqual({ mood: "frustrated", day: "2026-10-28", sample: false });
    expect(toneNote(t)).toMatch(/extra gentle/);
    expect(toneNote(t)).toMatch(/Never mention yesterday/);
    expect(toneNote(null)).toBe("");
  });

  it("uses the last earlier reading only, ignores today's and old ones, and counts a worry", () => {
    expect(tenderToday({ reads: [read("2026-10-28T09:00:00Z", "frustrated"), read("2026-10-28T11:00:00Z", "happy")], now: NOW, todayMood: null })).toBeNull();
    expect(tenderToday({ reads: [read("2026-10-29T08:00:00Z", "worried")], now: NOW, todayMood: null })).toBeNull();
    expect(tenderToday({ reads: [read("2026-10-25T10:00:00Z", "tired")], now: NOW, todayMood: null })).toBeNull();
    expect(tenderToday({ reads: [read("2026-10-28T10:00:00Z", "calm", true)], now: NOW, todayMood: null })?.mood).toBe("calm");
  });

  it("lets today's happy words win, and uses the labelled sample only when there's no earlier reading", () => {
    expect(tenderToday({ reads: [read("2026-10-28T10:00:00Z", "worried")], now: NOW, todayMood: "happy" })).toBeNull();
    const sample = sampleTender(NOW);
    expect(sample).toEqual({ mood: "frustrated", day: "2026-10-28", sample: true });
    expect(tenderToday({ reads: [], now: NOW, todayMood: null, sample })).toBe(sample);
    expect(tenderToday({ reads: [read("2026-10-28T10:00:00Z", "calm")], now: NOW, todayMood: null, sample })).toBeNull();
  });
});

describe("sparks from what the kid loves", () => {
  it("keeps known chips only and turns through interests and facts", () => {
    expect(cleanInterests(["Jets", "Jets", "Minecraft", "Anime", "K-pop", "Dance", "Space"])).toEqual(["Jets", "Anime", "K-pop", "Dance"]);
    const a = pickSpark(["K-pop", "Dance", "Anime"], 0);
    const b = pickSpark(["K-pop", "Dance", "Anime"], 1);
    const c = pickSpark(["K-pop", "Dance", "Anime"], 3);
    expect([a?.interest, b?.interest, c?.interest]).toEqual(["K-pop", "Dance", "K-pop"]);
    expect(c?.line).not.toBe(a?.line);
    expect(pickSpark(["Jets"], 0)?.place).toEqual({ href: "/squadron", cta: "Fly your squadron" });
    expect(pickSpark([], 0)).toBeNull();
  });
});

describe("Kix's next step", () => {
  const S = JUNIOR_SETTINGS;
  const input: NextStepInput = {
    nickname: "Jordan",
    now: "2026-10-28T17:20:00+08:00",
    settings: S,
    today: screenTimeByDay([], ["2026-10-28"], S)[0],
    sinceBreakMin: 5,
    focusDip: false,
    sleepy: false,
    mood: null,
    reviewsDue: 0,
    quest: { title: "The frog life cycle", href: "/learn/frog-life-cycle", minutes: 9 },
    arcade: true,
    vibe: true,
  };

  it("starts with a warm-up after a hard day, labelled when it's the sample", () => {
    const real = nextStep({ ...input, tender: { mood: "frustrated", day: "2026-10-27", sample: false } });
    expect(real).toMatchObject({ kind: "review", cta: "Warm up", why: "Yesterday was hard work, so Kix starts with a warm-up." });
    expect(real.line).not.toMatch(/frustrat|sad|mood/i);
    expect(nextStep({ ...input, tender: sampleTender(NOW) }).why).toMatch(/\(Sample day\.\)$/);
  });

  it("sparks an interest when focus dips before a break is due, and makes the break a dance break for dancers", () => {
    const jets = pickSpark(["Jets"], 0);
    const s = nextStep({ ...input, focusDip: true, spark: jets });
    expect(s).toMatchObject({ kind: "spark", href: "/squadron", cta: "Fly your squadron" });
    expect(s.line).toContain(jets!.line);
    expect(nextStep({ ...input, focusDip: true, spark: null }).kind).toBe("learn");
    const dance = nextStep({ ...input, focusDip: true, sinceBreakMin: 9, spark: pickSpark(["Dance"], 0) });
    expect(dance.kind).toBe("break");
    expect(dance.line).toMatch(/^Dance break!/);
  });
});

describe("the spark route", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "");
    vi.stubEnv("KID_SESSION_SECRET", "kix-spark-test-secret-0123456789abcdef");
    resetRateLimits();
    resetDemoStore();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("needs a kid, and answers with a cached fact from the kid's interests without a model", async () => {
    const item = loadFrogItems()[0];
    const jar = new Map<string, string>();
    const call = async (handler: (req: Request) => Promise<Response>, path: string, body: unknown) => {
      const headers = new Headers({ "content-type": "application/json" });
      if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
      const res = await handler(new Request(`http://localhost${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
      for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(";");
        const [name, ...rest] = pair.split("=");
        jar.set(name, rest.join("="));
      }
      return { status: res.status, body: JSON.parse(await res.text()) };
    };
    expect((await call(spark.POST, "/api/kix/spark", { itemId: item.id, turn: 1 })).status).toBe(401);
    await call(doorRoute.POST, "/api/auth/kid/door", { name: "jordan" });
    expect((await call(kidRoute.POST, "/api/auth/kid", { door: true, secret: { kind: "pictures", code: ["idle", "cheer", "pilot", "dreamlight"] } })).status).toBe(200);
    const r = await call(spark.POST, "/api/kix/spark", { itemId: item.id, turn: 1 });
    expect(r.status).toBe(200);
    expect(r.body.spark).toMatchObject({ interest: "Jets", source: "cached", place: { href: "/squadron" } });
    expect(r.body.spark.line).toMatch(/back to the question/);
  });
});
