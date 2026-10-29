// Guardian M1 end to end on the demo store: pairing, cameras, frames, places, sharing, points and the teen pause.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as kidRoute from "@/app/api/auth/kid/route";
import * as parentRoute from "@/app/api/auth/parent/route";
import * as cameras from "@/app/api/home/cameras/route";
import * as devices from "@/app/api/home/devices/route";
import * as frames from "@/app/api/home/frames/route";
import * as pair from "@/app/api/home/pair/route";
import * as prefs from "@/app/api/home/prefs/route";
import * as brief from "@/app/api/guardian/brief/route";
import * as location from "@/app/api/location/route";
import * as mine from "@/app/api/location/mine/route";
import * as pause from "@/app/api/location/pause/route";
import * as places from "@/app/api/location/places/route";
import * as settings from "@/app/api/location/settings/route";
import { JORDAN_ID, KAI_ID, LEONARD_ID, OTHER_PARENT_EMAIL } from "../auth/demo-family.ts";
import sharp from "sharp";
import { resetRateLimits } from "../auth/lockout.ts";
import { resetDemoStore } from "../auth/store-demo.ts";

type Handler = (req: Request) => Promise<Response>;

class Client {
  cookies = new Map<string, string>();
  bodies: string[] = [];
  token: string | null = null;
  async call(handler: Handler, path: string, init: { method?: string; body?: unknown; form?: FormData } = {}) {
    const headers = new Headers();
    if (!init.form) headers.set("content-type", "application/json");
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    const req = new Request(`http://localhost${path}`, { method: init.method ?? (init.body === undefined && !init.form ? "GET" : "POST"), headers, body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)) });
    const res = await handler(req);
    for (const line of res.headers.getSetCookie()) {
      const [kv, ...attrs] = line.split(";");
      const [name, ...rest] = kv.split("=");
      if (!rest.join("=") || attrs.some((a) => /max-age=0/i.test(a.trim()))) this.cookies.delete(name);
      else this.cookies.set(name, rest.join("="));
    }
    const text = await res.text();
    this.bodies.push(text);
    return { status: res.status, body: JSON.parse(text) };
  }
}

const JPEG = new Uint8Array(await sharp({ create: { width: 64, height: 36, channels: 3, background: "#8090a0" } }).jpeg().toBuffer());
const frameForm = (items: { camera: string; bytes: Uint8Array<ArrayBuffer>; burst?: number }[]) => {
  const form = new FormData();
  form.set("meta", JSON.stringify({ frames: items.map((f) => ({ camera: f.camera, at: new Date().toISOString(), burst: f.burst ?? 0 })) }));
  items.forEach((f, i) => form.set(`frame${i}`, new File([f.bytes], `f${i}.jpg`, { type: "image/jpeg" })));
  return form;
};

let parent: Client;
let device: Client;

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "guardian-test-secret-0123456789abcdef");
  resetRateLimits();
  resetDemoStore();
  parent = new Client();
  device = new Client();
  await parent.call(parentRoute.POST, "/api/auth/parent", { body: { email: "anyone@example.com", password: "anything" } });
});

afterEach(() => {
  vi.useRealTimers();
  // No reply ever carries a stored hash.
  for (const b of [...parent.bodies, ...device.bodies]) expect(b).not.toMatch(/tokenHash|token_hash|pairCodeHash|pair_code_hash/);
  vi.unstubAllEnvs();
});

async function pairSimulator() {
  const made = await parent.call(devices.POST, "/api/home/devices", { body: { name: "Home simulator", kind: "simulator" } });
  expect(made.status).toBe(200);
  const paired = await device.call(pair.POST, "/api/home/pair", { body: { code: made.body.code.toLowerCase().replace("-", " "), name: "sim" } });
  expect(paired.status).toBe(200);
  device.token = paired.body.token;
  return made.body;
}

describe("Home watch pairing, cameras and frames", () => {
  it("pairs once with the code, refuses a bedroom, and counts frames only in camera hours", async () => {
    const made = await pairSimulator();
    expect((await new Client().call(pair.POST, "/api/home/pair", { body: { code: made.code, name: "again" } })).status).toBe(401);
    expect((await device.call(cameras.PUT, "/api/home/cameras", { method: "PUT", body: { cameras: [{ key: "cam1", room: "Master bedroom" }] } })).status).toBe(400);
    const cams = await device.call(cameras.PUT, "/api/home/cameras", { method: "PUT", body: { cameras: [{ key: "living", room: "Living room" }, { key: "kitchen", room: "Kitchen" }] } });
    expect(cams.body.cameras.map((c: { roomKind: string }) => c.roomKind).sort()).toEqual(["kitchen", "living"]);

    // Outside the hours (or paused), frames are politely ignored.
    await parent.call(prefs.PATCH, "/api/home/prefs", { method: "PATCH", body: { pauseHours: 1 } });
    expect((await device.call(frames.POST, "/api/home/frames", { form: frameForm([{ camera: "living", bytes: JPEG }]) })).body).toMatchObject({ accepted: 0, camerasOn: false });
    await parent.call(prefs.PATCH, "/api/home/prefs", { method: "PATCH", body: { pauseHours: 0, camDays: [1, 2, 3, 4, 5, 6, 7], camFrom: "00:00", camTo: "23:59" } });
    expect((await device.call(frames.POST, "/api/home/frames", { form: frameForm([{ camera: "living", bytes: JPEG }, { camera: "kitchen", bytes: JPEG }]) })).body).toMatchObject({ accepted: 2, camerasOn: true });
    expect((await device.call(frames.POST, "/api/home/frames", { form: frameForm([{ camera: "living", bytes: new TextEncoder().encode("not an image") }]) })).status).toBe(415);
    expect((await device.call(frames.POST, "/api/home/frames", { form: frameForm([{ camera: "nope", bytes: JPEG }]) })).status).toBe(400);

    // The parent sees the device and its cameras; revoking stops the token at once.
    const list = await parent.call(devices.GET, "/api/home/devices");
    expect(list.body.devices).toHaveLength(1);
    expect(list.body.cameras.find((c: { key: string }) => c.key === "living").lastFrameAt).toBeTruthy();
    await parent.call(devices.DELETE, "/api/home/devices", { method: "DELETE", body: { id: made.device.id } });
    expect((await device.call(frames.POST, "/api/home/frames", { form: frameForm([{ camera: "living", bytes: JPEG }]) })).status).toBe(401);
  });

  it("keeps preferences per household and checks the kids' descriptions", async () => {
    const saved = await parent.call(prefs.PATCH, "/api/home/prefs", { method: "PATCH", body: { homeArea: "Sengkang", radiusKm: 5, interests: ["Badminton", "badminton", "nature walks"], descriptions: { [JORDAN_ID]: "youngest, light blue T-shirt" } } });
    expect(saved.body.prefs).toMatchObject({ radiusKm: 5, interests: ["badminton", "nature walks"], descriptions: { [JORDAN_ID]: "youngest, light blue T-shirt" } });
    expect((await parent.call(prefs.PATCH, "/api/home/prefs", { method: "PATCH", body: { descriptions: { [KAI_ID]: "not ours" } } })).status).toBe(404);
    const other = new Client();
    await other.call(parentRoute.POST, "/api/auth/parent", { body: { email: OTHER_PARENT_EMAIL, password: "x" } });
    expect((await other.call(prefs.GET, "/api/home/prefs")).body.prefs.radiusKm).toBe(3);
  });
});

describe("where they are", () => {
  it("stores points only when sharing is on, works out motion and arrived/left, and shows the parent today", async () => {
    // An afternoon in Singapore, so "today" holds all the points whatever time the suite runs.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-28T08:00:00Z"));
    await pairSimulator();
    const now = Date.now();
    const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
    const pts = [
      { at: at(30), lat: 1.3966, lng: 103.8865, accuracyM: 10, speed: 0 },
      { at: at(20), lat: 1.3935, lng: 103.893, accuracyM: 10, speed: 1.3 },
      { at: at(2), lat: 1.3895, lng: 103.9003, accuracyM: 8, speed: 0.1 },
    ];
    expect((await device.call(location.POST, "/api/location", { body: { kidId: JORDAN_ID, points: pts } })).status).toBe(403);
    await parent.call(settings.PATCH, "/api/location/settings", { method: "PATCH", body: { kidId: JORDAN_ID, enabled: true, mode: "balanced" } });
    await parent.call(places.POST, "/api/location/places", { body: { name: "Home", kind: "home", lat: 1.3895, lng: 103.9003, radiusM: 150 } });
    await parent.call(places.POST, "/api/location/places", { body: { name: "School", kind: "school", lat: 1.3966, lng: 103.8865, radiusM: 200 } });
    const sent = await device.call(location.POST, "/api/location", { body: { kidId: JORDAN_ID, points: pts } });
    expect(sent.body).toMatchObject({ stored: 3, mode: "balanced", intervals: { movingSec: 120 }, motion: "still" });
    expect(sent.body.events.map((e: { kind: string; place: string }) => `${e.kind} ${e.place}`)).toEqual(["arrived School", "left School", "arrived Home"]);
    // A retry stores nothing twice.
    expect((await device.call(location.POST, "/api/location", { body: { kidId: JORDAN_ID, points: pts } })).body.stored).toBe(0);
    // Another household's kid is refused.
    expect((await device.call(location.POST, "/api/location", { body: { kidId: KAI_ID, points: pts } })).status).toBe(404);

    const view = await parent.call(location.GET, "/api/location");
    const ari = view.body.kids.find((k: { id: string }) => k.id === JORDAN_ID);
    expect(ari.latest).toMatchObject({ motion: "still" });
    expect(ari.today.map((p: { motion: string }) => p.motion)).toEqual(["still", "walking", "still"]);
    expect(ari.events[0]).toMatchObject({ kind: "arrived", placeName: "Home" });
    expect(view.body.places).toHaveLength(2);
  });

  it("lets a teen pause for 30 minutes, and nothing is stored meanwhile; juniors can't", async () => {
    await pairSimulator();
    await parent.call(settings.PATCH, "/api/location/settings", { method: "PATCH", body: { kidId: LEONARD_ID, enabled: true } });
    await parent.call(kidRoute.POST, "/api/auth/kid", { body: { kidId: LEONARD_ID, secret: { kind: "password", password: "local-demo-only" } } });
    const paused = await parent.call(pause.POST, "/api/location/pause", { body: { minutes: 30 } });
    expect(paused.status).toBe(200);
    expect(Date.parse(paused.body.pausedUntil) - Date.now()).toBeGreaterThan(29 * 60_000);
    const sent = await device.call(location.POST, "/api/location", { body: { kidId: LEONARD_ID, points: [{ at: new Date().toISOString(), lat: 1.39, lng: 103.9, accuracyM: 10 }] } });
    expect(sent.body).toMatchObject({ stored: 0, pausedUntil: paused.body.pausedUntil });
  });

  it("shows a kid only their own state, refuses a junior's pause, and lets a teen pause and resume", async () => {
    await pairSimulator();
    await parent.call(settings.PATCH, "/api/location/settings", { method: "PATCH", body: { kidId: LEONARD_ID, enabled: true } });
    await parent.call(settings.PATCH, "/api/location/settings", { method: "PATCH", body: { kidId: JORDAN_ID, enabled: true } });
    await parent.call(cameras.PUT, "/api/home/cameras", { method: "PUT", body: { cameras: [{ key: "study", room: "Study" }] } }); // the parent's cookie isn't a device: refused
    await device.call(cameras.PUT, "/api/home/cameras", { method: "PUT", body: { cameras: [{ key: "study", room: "Study" }] } });
    await parent.call(prefs.PATCH, "/api/home/prefs", { method: "PATCH", body: { camDays: [1, 2, 3, 4, 5, 6, 7], camFrom: "00:00", camTo: "23:59" } });

    await parent.call(kidRoute.POST, "/api/auth/kid", { body: { kidId: JORDAN_ID, secret: { kind: "pictures", code: ["idle", "cheer", "pilot", "dreamlight"] } } });
    const junior = await parent.call(mine.GET, "/api/location/mine");
    expect(junior.body).toMatchObject({ nickname: "Jordan", band: "junior", sharing: { enabled: true, paused: false, canPause: false }, cameras: { on: true, rooms: ["Study"] } });
    expect(JSON.stringify(junior.body)).not.toMatch(/lat|lng|reading|activity/);
    expect((await parent.call(pause.POST, "/api/location/pause", { body: { minutes: 30 } })).status).toBe(403);

    await parent.call(kidRoute.POST, "/api/auth/kid", { body: { kidId: LEONARD_ID, secret: { kind: "password", password: "local-demo-only" } } });
    expect((await parent.call(mine.GET, "/api/location/mine")).body.sharing).toMatchObject({ canPause: true, paused: false });
    await parent.call(pause.POST, "/api/location/pause", { body: { minutes: 30 } });
    expect((await parent.call(mine.GET, "/api/location/mine")).body.sharing).toMatchObject({ paused: true, on: true });
    expect((await parent.call(pause.DELETE, "/api/location/pause", { method: "DELETE" })).body.pausedUntil).toBeNull();
    expect((await parent.call(mine.GET, "/api/location/mine")).body.sharing.paused).toBe(false);
  });

  it("writes the Right now brief from facts with the rules' own words when Muse isn't there, and says nothing when there's nothing", async () => {
    // A weekday morning: the demo family's school-hours sharing (1–7 pm) and camera hours (2–7 pm) are both off, so
    // there's nothing to say until Jordan's location arrives.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-29T02:00:00Z"));
    expect((await parent.call(brief.GET, "/api/guardian/brief")).body.brief).toBeNull();
    await pairSimulator();
    await parent.call(settings.PATCH, "/api/location/settings", { method: "PATCH", body: { kidId: JORDAN_ID, enabled: true } });
    await parent.call(places.POST, "/api/location/places", { body: { name: "School", kind: "school", lat: 1.3966, lng: 103.8865, radiusM: 200 } });
    await device.call(location.POST, "/api/location", { body: { kidId: JORDAN_ID, points: [{ at: new Date(Date.now() - 60_000).toISOString(), lat: 1.3966, lng: 103.8865, accuracyM: 8, speed: 0 }] } });
    const r = await parent.call(brief.GET, "/api/guardian/brief");
    expect(r.body.brief).toMatchObject({ source: "fallback", cached: false });
    expect(r.body.brief.text).toContain("Jordan is at School");
    expect(r.body.brief.text).not.toMatch(/\d\.\d{3}/);
    expect((await parent.call(brief.GET, "/api/guardian/brief")).body.brief.cached).toBe(true);
  });
});

