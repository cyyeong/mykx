import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configPath, type CameraConfig, type Config } from "./config.ts";
import { OFF_HOURS_RECHECK_MS, RETRY_UNREACHABLE_MS, SLOW_DOWN_MS, createHomeLink, type HomeLink } from "./loop.ts";
import { TOKEN, fakeCamera, fakeMyKx, grey, tempDir, type FakeCamera, type FakeMyKx } from "./testkit.ts";

const PASSWORD = "S3cretPw!";
const MINUTE = 60_000;
const T0 = Date.parse("2026-10-28T10:00:00Z");

let t: number;
let cam: FakeCamera;
let other: FakeCamera;
let my: FakeMyKx;
let tmp: ReturnType<typeof tempDir>;
let printed: string[];

beforeEach(async () => {
  t = T0;
  printed = [];
  tmp = tempDir();
  cam = await fakeCamera(await grey(30), `viewer:${PASSWORD}`);
  other = await fakeCamera(await grey(200));
  my = await fakeMyKx();
});
afterEach(async () => {
  await Promise.all([cam.close(), other.close(), my.close()]);
  tmp.remove();
});

const camera = (key: string, room: string, url: string, over: Partial<CameraConfig> = {}): CameraConfig => ({ key, room, url, intervalSec: 60, enabled: true, privacyConfirmed: true, ...over });
const livingUrl = () => cam.url.replace("http://", `http://viewer:${PASSWORD}@`);

function start(cameras: CameraConfig[], over: Partial<Config> = {}): HomeLink {
  const config: Config = { server: my.url, token: TOKEN, deviceName: "Study laptop", cameras, ...over };
  return createHomeLink(tmp.dir, config, [], { now: () => t, sleep: async (ms) => void (t += ms), eager: false, print: (l) => printed.push(l) });
}
const frames = () => my.seen.filter((s) => s.path === "/api/home/frames");
const lastFrames = () => frames().at(-1)?.meta?.frames ?? [];
const logText = (link: HomeLink) => link.state().log.map((l) => l.text);

describe("one round with a camera and myKx", () => {
  it("sends the first picture, then nothing while the room is the same", async () => {
    const link = start([camera("living-room", "Living room", livingUrl())]);
    await link.tick();
    expect(frames()).toHaveLength(1);
    expect(lastFrames()).toEqual([{ camera: "living-room", at: new Date(T0).toISOString(), burst: 0 }]);
    expect(link.state().cameras[0]).toMatchObject({ status: "sent", lastReason: "first" });

    t += MINUTE;
    await link.tick();
    expect(frames()).toHaveLength(1);
    expect(link.state().cameras[0]).toMatchObject({ status: "no-change", lastSentAt: new Date(T0).toISOString() });
    expect(logText(link).filter((l) => /no change/.test(l))).toHaveLength(1);
  });

  it("sends a picture that changed, as one picture", async () => {
    const link = start([camera("living-room", "Living room", livingUrl())]);
    await link.tick();
    cam.picture = await grey(40);
    t += MINUTE;
    await link.tick();
    expect(frames()).toHaveLength(2);
    expect(lastFrames()).toHaveLength(1);
    expect(lastFrames()[0].burst).toBe(0);
    expect(link.state().cameras[0].lastReason).toBe("changed");
  });

  it("sends a burst of three a second apart for a big change", async () => {
    const link = start([camera("living-room", "Living room", livingUrl())]);
    await link.tick();
    cam.picture = await grey(200);
    t += MINUTE;
    await link.tick();
    expect(frames()).toHaveLength(2);
    const sent = lastFrames();
    expect(sent.map((f) => f.burst)).toEqual([0, 1, 2]);
    expect(sent.map((f) => f.camera)).toEqual(["living-room", "living-room", "living-room"]);
    expect(Date.parse(sent[1].at) - Date.parse(sent[0].at)).toBe(1000);
    expect(Date.parse(sent[2].at) - Date.parse(sent[1].at)).toBe(1000);
    expect(frames().at(-1)?.frames).toHaveLength(3);
    expect(link.state().cameras[0].lastReason).toBe("big-change");
    expect(logText(link)[0]).toMatch(/changed a lot → sent a burst of 3 pictures/);
  });

  it("sends a heartbeat after 10 quiet minutes", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 300 })]);
    await link.tick();
    t += 5 * MINUTE;
    await link.tick();
    expect(frames()).toHaveLength(1);
    t += 5 * MINUTE;
    await link.tick();
    expect(frames()).toHaveLength(2);
    expect(link.state().cameras[0].lastReason).toBe("heartbeat");
  });

  it("puts every changed camera into one POST", async () => {
    const link = start([camera("living-room", "Living room", livingUrl()), camera("kitchen", "Kitchen", other.url)]);
    await link.tick();
    expect(frames()).toHaveLength(1);
    expect(lastFrames().map((f) => f.camera).sort()).toEqual(["kitchen", "living-room"]);
    expect(my.seen.filter((s) => s.path === "/api/home/cameras")).toHaveLength(1);
  });

  it("splits more than 12 pictures into more than one POST", async () => {
    const many = Array.from({ length: 10 }, (_, i) => camera(`room-${i}`, `Room ${i}`, other.url));
    const link = start(many);
    await link.tick();
    other.picture = await grey(5);
    t += MINUTE;
    await link.tick();
    const second = frames().slice(1);
    expect(second.length).toBeGreaterThan(1);
    expect(second.every((s) => (s.meta?.frames.length ?? 0) <= 12)).toBe(true);
    expect(second.flatMap((s) => s.meta?.frames ?? [])).toHaveLength(30);
    for (const s of second) for (const key of new Set(s.meta?.frames.map((f) => f.camera))) expect(s.meta?.frames.filter((f) => f.camera === key)).toHaveLength(3);
  });

  it("checks each camera on its own interval", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 }), camera("kitchen", "Kitchen", other.url, { intervalSec: 300 })]);
    await link.tick();
    cam.picture = await grey(40);
    other.picture = await grey(220);
    t += 10_000;
    await link.tick();
    expect(lastFrames().map((f) => f.camera)).toEqual(["living-room"]);
  });
});

describe("keeping camera passwords private", () => {
  it("never sends the password to myKx, in any byte, and never writes it down", async () => {
    const link = start([camera("living-room", "Living room", livingUrl())]);
    await link.tick();
    cam.picture = await grey(220);
    t += MINUTE;
    await link.tick();
    cam.mode = "down";
    t += MINUTE;
    await link.tick();
    expect(my.seen.length).toBeGreaterThan(2);
    for (const s of my.seen) {
      for (const secret of [PASSWORD, "viewer", encodeURIComponent(PASSWORD), Buffer.from(`viewer:${PASSWORD}`).toString("base64")]) expect(s.raw.includes(secret), `${s.path} holds ${secret}`).toBe(false);
      expect(s.raw.includes("127.0.0.1")).toBe(false);
      expect(String(s.authorization)).toBe(`Bearer ${TOKEN}`);
    }
    const everything = JSON.stringify(link.state()) + printed.join("\n");
    expect(everything).not.toContain(PASSWORD);
    expect(everything).not.toContain("viewer");
    expect(everything).not.toContain(TOKEN);
  });

  it("reaches the camera with a Basic header and a clean address", async () => {
    const link = start([camera("living-room", "Living room", livingUrl())]);
    await link.tick();
    expect(cam.hits[0]).toEqual({ url: "/snapshot.jpg", authorization: `Basic ${Buffer.from(`viewer:${PASSWORD}`).toString("base64")}` });
  });

  it("keeps the password in the settings file, readable only by this user", async () => {
    const link = start([]);
    expect(await link.saveCamera({ room: "Living room", url: livingUrl(), intervalSec: 60, privacyConfirmed: true })).toMatchObject({ ok: true, camera: { address: expect.stringContaining("••••@") } });
    expect(readFileSync(configPath(tmp.dir), "utf8")).toContain(PASSWORD);
    expect(JSON.stringify(link.state())).not.toContain(PASSWORD);
  });
});

describe("a camera that can't be reached", () => {
  it("is logged once, retried every minute, and logged again when it is back", async () => {
    const link = start([camera("living-room", "Living room", cam.url, { intervalSec: 10 }), camera("kitchen", "Kitchen", other.url, { intervalSec: 10 })].map((c) => (c.key === "living-room" ? { ...c, url: livingUrl() } : c)));
    await link.tick();
    cam.mode = "down";
    for (let i = 0; i < 3; i++) {
      t += 10_000;
      await link.tick();
    }
    const lost = logText(link).filter((l) => /can't reach the camera/.test(l));
    expect(lost).toEqual(["Living room: can't reach the camera. Retrying every minute; your family sees “offline”."]);
    expect(link.state().cameras[0]).toMatchObject({ status: "unreachable", unreachableSince: expect.any(String) });
    // Tried again only after a minute, not every 10 seconds.
    const before = cam.hits.length;
    t += 10_000;
    await link.tick();
    expect(cam.hits.length).toBe(before);
    t += RETRY_UNREACHABLE_MS;
    await link.tick();
    expect(cam.hits.length).toBe(before + 1);
    expect(logText(link).filter((l) => /can't reach the camera/.test(l))).toHaveLength(1);

    cam.mode = "ok";
    t += RETRY_UNREACHABLE_MS;
    await link.tick();
    expect(logText(link)).toContain("Living room: the camera is back.");
    expect(link.state().cameras[0].status).not.toBe("unreachable");
  });

  it("says why when the password is wrong", async () => {
    const link = start([camera("living-room", "Living room", cam.url.replace("http://", "http://viewer:nope@"))]);
    await link.tick();
    expect(logText(link)[0]).toMatch(/Living room: The camera refused the user name or password\. Retrying every minute/);
    expect(frames()).toHaveLength(0);
  });
});

describe("how myKx answers", () => {
  it("outside the family's hours, backs off to a 5-minute check and says so once", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 })]);
    my.answer = (r) => (r.path === "/api/home/frames" ? { status: 200, body: { ok: true, accepted: 0, camerasOn: false } } : undefined);
    await link.tick();
    expect(frames()).toHaveLength(1);
    expect(link.state().notice).toMatchObject({ kind: "off-hours", message: expect.stringContaining("Cameras are off right now (your family’s hours)") });
    expect(link.state().cameras[0].lastSentAt).toBeNull();

    for (let i = 0; i < 5; i++) {
      t += 40_000;
      await link.tick();
    }
    expect(frames()).toHaveLength(1);
    t = T0 + OFF_HOURS_RECHECK_MS;
    await link.tick();
    expect(frames()).toHaveLength(2);
    expect(logText(link).filter((l) => /Cameras are off right now/.test(l))).toHaveLength(1);

    // The cameras come on: the picture that never got through goes first.
    my.answer = null;
    t += OFF_HOURS_RECHECK_MS;
    await link.tick();
    expect(frames()).toHaveLength(3);
    expect(link.state().notice).toBeNull();
    expect(link.state().cameras[0]).toMatchObject({ status: "sent", lastReason: "first" });
  });

  it("stops and says the computer was removed on a 401", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 })]);
    my.answer = (r) => (r.path === "/api/home/frames" ? { status: 401, body: { ok: false, reason: "wrong" } } : undefined);
    await link.tick();
    expect(link.state()).toMatchObject({ paired: false, sending: false, deviceName: null, notice: { kind: "revoked", message: "This computer was removed in myKx; pair it again." } });
    expect(JSON.parse(readFileSync(configPath(tmp.dir), "utf8")).token).toBeNull();
    const count = my.seen.length;
    for (let i = 0; i < 3; i++) {
      t += 10_000;
      await link.tick();
    }
    expect(my.seen.length).toBe(count);
    expect(link.state().cameras).toHaveLength(1);
  });

  it("waits as long as myKx asks when it says slow down", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 })]);
    my.answer = (r) => (r.path === "/api/home/frames" ? { status: 429, body: { ok: false, reason: "slow-down", retryAfterSec: 90 } } : undefined);
    await link.tick();
    expect(frames()).toHaveLength(1);
    expect(link.state().notice).toMatchObject({ kind: "slow-down", message: expect.stringContaining("90 seconds") });
    t += 89_000;
    await link.tick();
    expect(frames()).toHaveLength(1);
    my.answer = null;
    t += 1_000;
    await link.tick();
    expect(frames()).toHaveLength(2);
    expect(link.state().notice).toBeNull();
    expect(logText(link).filter((l) => /slow down/.test(l))).toHaveLength(1);
  });

  it("waits longer each time it is told to slow down with no hint (the daily budget), up to 10 minutes", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 })]);
    my.answer = (r) => (r.path === "/api/home/frames" ? { status: 429, body: { ok: false, reason: "slow-down" } } : undefined);
    const waits: number[] = [];
    for (const expected of [60, 120, 240, 480, 600, 600]) {
      const before = frames().length;
      await link.tick();
      expect(frames().length).toBe(before + 1);
      t += expected * 1000 - 1;
      await link.tick();
      expect(frames().length).toBe(before + 1);
      t += 1;
      waits.push(expected);
    }
    my.answer = null;
    await link.tick();
    expect(link.state().notice).toBeNull();
    expect(logText(link).filter((l) => /slow down/.test(l))).toHaveLength(1);
    expect(SLOW_DOWN_MS).toBe(60_000);
    expect(waits).toHaveLength(6);
  });

  it("skips the round on a 413, 415 or 400 and carries on", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 })]);
    for (const status of [413, 415]) {
      my.answer = (r) => (r.path === "/api/home/frames" ? { status, body: { ok: false, reason: "too-large" } } : undefined);
      await link.tick();
      t += 10_000;
    }
    expect(frames()).toHaveLength(2);
    expect(link.state().paired).toBe(true);
    expect(logText(link)[0]).toMatch(/didn’t take this round’s pictures \(415/);
    my.answer = null;
    await link.tick();
    expect(frames()).toHaveLength(3);
    expect(link.state().cameras[0].status).toBe("sent");
  });

  it("sends the camera list again after a 400, in case myKx doesn't know a camera", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 })]);
    let first = true;
    my.answer = (r) => {
      if (r.path === "/api/home/frames" && first) {
        first = false;
        return { status: 400, body: { ok: false, reason: "invalid" } };
      }
      return undefined;
    };
    await link.tick();
    t += 10_000;
    await link.tick();
    expect(my.seen.filter((s) => s.path === "/api/home/cameras")).toHaveLength(2);
    expect(link.state().cameras[0].status).toBe("sent");
  });

  it("keeps trying every minute when myKx can't be reached, and says so once", async () => {
    const link = start([camera("living-room", "Living room", livingUrl(), { intervalSec: 10 })], { server: "http://127.0.0.1:9" });
    await link.tick();
    expect(link.state().notice).toMatchObject({ kind: "offline" });
    t += 30_000;
    await link.tick();
    t += 31_000;
    await link.tick();
    expect(logText(link).filter((l) => /Can't reach myKx/.test(l))).toHaveLength(1);
    expect(link.state().cameras[0].lastSentAt).toBeNull();
  });

  it("reads myKx's words about each room into the log", async () => {
    const link = start([camera("living-room", "Living room", livingUrl())]);
    my.answer = (r) => (r.path === "/api/home/frames" ? { status: 202, body: { ok: true, accepted: 1, camerasOn: true, read: "live", statuses: [{ camera: "living-room", activity: "arguing", cue: null, concern: "watch", reason: "x", source: "live" }], alerts: [{ camera: "living-room", level: "watch", kind: "arguing" }] } } : undefined);
    await link.tick();
    expect(logText(link)[0]).toBe("Living room: sent the first picture. myKx: “arguing” (watch). myKx raised a watch flag for you to check.");
    expect(printed.at(-1)).toMatch(/^\[\d\d:\d\d:\d\d\] Living room: sent the first picture/);
  });
});

describe("safe by default", () => {
  it("sends nothing until paired and a camera is saved with its confirmation", async () => {
    const unpaired = start([camera("living-room", "Living room", livingUrl())], { token: null });
    await unpaired.tick();
    const noCameras = start([]);
    await noCameras.tick();
    const unconfirmed = start([camera("living-room", "Living room", livingUrl(), { privacyConfirmed: false })]);
    await unconfirmed.tick();
    const off = start([camera("living-room", "Living room", livingUrl(), { enabled: false })]);
    await off.tick();
    expect(my.seen).toEqual([]);
    expect(cam.hits).toEqual([]);
    expect(unpaired.state().sending).toBe(false);
  });

  it("refuses to save a camera without the confirmation, or one that sees a bedroom, or an 11th", async () => {
    const link = start([]);
    expect(await link.saveCamera({ room: "Study", url: other.url, privacyConfirmed: false })).toMatchObject({ ok: false, field: "privacyConfirmed" });
    expect(await link.saveCamera({ room: "Master bedroom", url: other.url, privacyConfirmed: true })).toMatchObject({ ok: false, field: "room" });
    for (let i = 0; i < 10; i++) expect(await link.saveCamera({ room: `Room ${i}`, url: other.url, privacyConfirmed: true })).toMatchObject({ ok: true });
    expect(await link.saveCamera({ room: "One too many", url: other.url, privacyConfirmed: true })).toMatchObject({ ok: false, field: "cameras" });
    expect(link.state().cameras).toHaveLength(10);
    expect(my.seen).toEqual([]);
  });

  it("tells myKx the camera list only after a camera is saved, and again when one is removed", async () => {
    const link = start([]);
    await link.tick();
    expect(my.seen).toEqual([]);
    await link.saveCamera({ room: "Study", url: other.url, privacyConfirmed: true });
    await link.tick();
    expect(my.seen.map((s) => s.path)).toEqual(["/api/home/cameras", "/api/home/frames"]);
    expect(link.removeCamera("study")).toBe(true);
    await link.tick();
    expect(my.seen.at(-1)).toMatchObject({ path: "/api/home/cameras", json: { cameras: [] } });
  });

  it("doesn't lose a camera saved while the list is being sent", async () => {
    const link = start([camera("a", "Study", other.url)]);
    const slow = link.tick();
    await link.saveCamera({ room: "Kitchen", url: other.url, privacyConfirmed: true });
    await slow;
    await link.tick();
    const lists = my.seen.filter((s) => s.path === "/api/home/cameras").map((s) => (s.json?.cameras as { key: string }[]).map((c) => c.key));
    expect(lists.at(-1)).toEqual(["a", "kitchen"]);
  });
});

describe("pairing and the test picture", () => {
  it("pairs with a code, keeps the token in the file, and never in the state", async () => {
    const link = start([], { token: null, deviceName: null });
    expect(await link.pair("wrong-wrong")).toMatchObject({ ok: false });
    expect(await link.pair("k7q4 mz2p")).toEqual({ ok: true });
    expect(link.state()).toMatchObject({ paired: true, deviceName: "Study laptop", serverHost: new URL(my.url).host });
    expect(JSON.stringify(link.state())).not.toContain(TOKEN);
    expect(JSON.parse(readFileSync(configPath(tmp.dir), "utf8"))).toMatchObject({ token: TOKEN, deviceName: "Study laptop" });
    link.unpair();
    expect(link.state().paired).toBe(false);
    expect(JSON.parse(readFileSync(configPath(tmp.dir), "utf8")).token).toBeNull();
  });

  it("takes a test picture without sending anything, from an address not yet saved", async () => {
    const link = start([]);
    const r = await link.testPicture(null, livingUrl());
    expect(r).toMatchObject({ ok: true, dataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/) });
    expect(my.seen).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(PASSWORD);
    cam.mode = "down";
    const bad = await link.testPicture(null, livingUrl());
    expect(bad).toMatchObject({ ok: false, kind: "unreachable" });
    expect(JSON.stringify(bad)).not.toContain(PASSWORD);
    expect(await link.testPicture(null, "")).toMatchObject({ ok: false, kind: "invalid" });
    expect(await link.testPicture(null, "ftp://x/y")).toMatchObject({ ok: false, kind: "invalid" });
  });

  it("keeps each camera's last picture for the wall", async () => {
    const link = start([camera("living-room", "Living room", livingUrl())]);
    expect(link.thumb("living-room")).toBeNull();
    await link.tick();
    expect(link.thumb("living-room")?.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(link.thumb("nope")).toBeNull();
  });

  it("keeps the last 100 lines of activity, newest first", () => {
    const link = start([]);
    for (let i = 0; i < 130; i++) link.note(`line ${i}`);
    const log = link.state().log;
    expect(log).toHaveLength(100);
    expect(log[0].text).toBe("line 129");
    expect(log[99].text).toBe("line 30");
  });
});
