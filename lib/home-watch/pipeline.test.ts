// Frames → Home Reader → statuses → alert rules → SAM-outlined frames kept 24 h → the parent's Home now and check.
// Muse Spark and SAM are faked here; scripts/home-reader-cache.ts runs the real ones on the synthetic frames.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as home from "@/app/api/home/route";
import * as alertsRoute from "@/app/api/home/alerts/route";
import * as cameras from "@/app/api/home/cameras/route";
import * as devices from "@/app/api/home/devices/route";
import * as family from "@/app/api/home/family/route";
import * as frames from "@/app/api/home/frames/route";
import * as pair from "@/app/api/home/pair/route";
import * as prefs from "@/app/api/home/prefs/route";
import sharp from "sharp";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore } from "../auth/store-demo.ts";
import type { RoomReading } from "./home-watch.ts";

const fake = vi.hoisted(() => ({ activity: "reading or homework" as string, hazard: "none" as string }));
vi.mock("./read.ts", async (orig) => {
  const real = await orig<typeof import("./read.ts")>();
  return {
    ...real,
    readTick: async (fs: { cameraKey: string }[]) => {
      const readings = new Map<string, RoomReading>();
      for (const f of fs) readings.set(f.cameraKey, { people: [{ who: "child", likely: "Abby", confidence: 0.8, cue: "frowning" }, { who: "child", likely: "Jordan", confidence: 0.8, cue: "frowning" }], activity: fake.activity, note: "", cue: "frowning", hazard: fake.hazard, concern: "watch", reason: "Possibly two children pulling one TV remote.", confidence: 0.7, source: "live" });
      return { readings, source: "live", error: null };
    },
  };
});
vi.mock("./outline.ts", async (orig) => ({ ...(await orig<typeof import("./outline.ts")>()), outlineChildren: async () => ({ webp: Buffer.from("RIFFxxxxWEBP"), outlined: 2 }) }));

type Handler = (req: Request) => Promise<Response>;
class Client {
  cookies = new Map<string, string>();
  token: string | null = null;
  async call(handler: Handler, path: string, init: { method?: string; body?: unknown; form?: FormData } = {}) {
    const headers = new Headers();
    if (!init.form) headers.set("content-type", "application/json");
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    const res = await handler(new Request(`http://localhost${path}`, { method: init.method ?? (init.body === undefined && !init.form ? "GET" : "POST"), headers, body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)) }));
    for (const line of res.headers.getSetCookie()) {
      const [kv] = line.split(";");
      const [name, ...rest] = kv.split("=");
      if (rest.join("=")) this.cookies.set(name, rest.join("="));
    }
    return { status: res.status, body: JSON.parse(await res.text()) };
  }
}
const JPEG = new Uint8Array(await sharp({ create: { width: 64, height: 36, channels: 3, background: "#8090a0" } }).jpeg().toBuffer());
const upload = (n: number) => {
  const form = new FormData();
  form.set("meta", JSON.stringify({ frames: Array.from({ length: n }, (_, i) => ({ camera: "living", at: new Date(Date.now() + i * 1000).toISOString(), burst: i })) }));
  for (let i = 0; i < n; i++) form.set(`frame${i}`, new File([JPEG], `f${i}.jpg`, { type: "image/jpeg" }));
  return form;
};

let parent: Client;
let sim: Client;
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "pipeline-test-secret-0123456789abcdef");
  resetRateLimits();
  resetDemoStore();
  fake.activity = "reading or homework";
  fake.hazard = "none";
  parent = new Client();
  sim = new Client();
  await parent.call(parentRoute.POST, "/api/auth/parent", { body: { email: "a@b.c", password: "x" } });
  const made = await parent.call(devices.POST, "/api/home/devices", { body: { name: "Home simulator", kind: "simulator" } });
  sim.token = (await sim.call(pair.POST, "/api/home/pair", { body: { code: made.body.code, name: "sim" } })).body.token;
  await sim.call(cameras.PUT, "/api/home/cameras", { method: "PUT", body: { cameras: [{ key: "living", room: "Living room" }] } });
  await parent.call(prefs.PATCH, "/api/home/prefs", { method: "PATCH", body: { camDays: [1, 2, 3, 4, 5, 6, 7], camFrom: "00:00", camTo: "23:59" } });
});
afterEach(() => vi.unstubAllEnvs());

describe("the Home watch pipeline", () => {
  it("a calm room becomes a status and no alert", async () => {
    const res = await sim.call(frames.POST, "/api/home/frames", { form: upload(1) });
    expect(res.body).toMatchObject({ accepted: 1, read: "live", statuses: [{ camera: "living", activity: "reading or homework" }], alerts: [] });
    const view = await parent.call(home.GET, "/api/home");
    expect(view.body.rooms[0].latest.reading.activity).toBe("reading or homework");
    expect(view.body.alerts).toEqual([]);
  });

  it("a conflict burst is urgent, keeps outlined frames for the parent, and a 'not right' softens the next one", async () => {
    fake.activity = "physical conflict";
    const res = await sim.call(frames.POST, "/api/home/frames", { form: upload(3) });
    expect(res.body.alerts).toEqual([{ camera: "living", level: "urgent", kind: "conflict" }]);
    const view = await parent.call(home.GET, "/api/home");
    const alert = view.body.alerts[0];
    expect(alert).toMatchObject({ level: "urgent", kind: "conflict", verdict: null });
    expect(alert.frames).toHaveLength(3);
    expect(alert.frames[0]).toMatch(/^data:image\/webp;base64,/);
    expect(Date.parse(alert.framesExpireAt) - Date.now()).toBeGreaterThan(23 * 3_600_000);
    expect((await parent.call(alertsRoute.PATCH, "/api/home/alerts", { method: "PATCH", body: { id: alert.id, verdict: "not-right" } })).body.alert.verdict).toBe("not-right");
  });

  it("only the simulator may ask for the family's kids", async () => {
    const res = await sim.call(family.GET, "/api/home/family");
    expect(res.body.kids.map((k: { nickname: string }) => k.nickname).sort()).toEqual(["Abby", "Jordan", "Leonard"]);
  });
});
