import { afterEach, describe, expect, it } from "vitest";
import { TOKEN, fakeMyKx, type FakeMyKx } from "./testkit.ts";
import { buildFramesForm, cleanCode, pair, sendFrames, syncCameras, type Frame } from "./upload.ts";

let my: FakeMyKx | null = null;
afterEach(async () => {
  await my?.close();
  my = null;
});
const server = async () => (my = await fakeMyKx());
const jpeg = (n: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, n, n, n]);
const frames: Frame[] = [
  { camera: "living-room", at: "2026-10-28T17:08:31.000+08:00", burst: 0, bytes: jpeg(1) },
  { camera: "living-room", at: "2026-10-28T17:08:32.000+08:00", burst: 1, bytes: jpeg(2) },
  { camera: "kitchen", at: "2026-10-28T17:08:33.000+08:00", burst: 0, bytes: jpeg(3) },
];

describe("pairing", () => {
  it("swaps the code for a token", async () => {
    const s = await server();
    const r = await pair(s.url, "k7q4 mz2p", "MacBook");
    expect(r).toEqual({ ok: true, token: TOKEN, device: { id: "d1", name: "Study laptop", kind: "home-link" } });
    expect(s.seen[0]).toMatchObject({ method: "POST", path: "/api/home/pair", json: { code: "K7Q4-MZ2P", name: "MacBook" }, authorization: undefined });
  });

  it("says a wrong or used code didn't work", async () => {
    const s = await server();
    expect(await pair(s.url, "ZZZZ-ZZZZ", "MacBook")).toMatchObject({ ok: false, kind: "wrong", status: 401, message: "That code didn't work. It works once and runs out after 15 minutes." });
  });

  it("doesn't even ask for a code that can't be one", async () => {
    const s = await server();
    expect(await pair(s.url, "123", "MacBook")).toMatchObject({ ok: false, kind: "wrong" });
    expect(s.seen).toHaveLength(0);
    expect(cleanCode("  k7q4-mz2p ")).toBe("K7Q4-MZ2P");
    expect(cleanCode("K7Q4MZ2P")).toBe("K7Q4-MZ2P");
    expect(cleanCode("K7Q4-MZ2P-9")).toBeNull();
  });

  it("slows down when myKx says so", async () => {
    const s = await server();
    s.answer = () => ({ status: 429, body: { ok: false, reason: "slow-down", retryAfterSec: 42 } });
    expect(await pair(s.url, "K7Q4-MZ2P", "x")).toMatchObject({ ok: false, kind: "slow-down", retryAfterSec: 42 });
  });

  it("refuses a plain http server that isn't this computer, and says when myKx can't be reached", async () => {
    expect(await pair("http://mykx.example.com", "K7Q4-MZ2P", "x")).toMatchObject({ ok: false, kind: "invalid" });
    expect(await pair("http://127.0.0.1:9", "K7Q4-MZ2P", "x")).toMatchObject({ ok: false, kind: "network" });
  });
});

describe("the camera list", () => {
  it("is sent with the Bearer token, room names only", async () => {
    const s = await server();
    expect(await syncCameras(s.url, TOKEN, [{ key: "kitchen", room: "Kitchen", enabled: true }])).toEqual({ ok: true });
    expect(s.seen[0]).toMatchObject({ method: "PUT", path: "/api/home/cameras", authorization: `Bearer ${TOKEN}`, json: { cameras: [{ key: "kitchen", room: "Kitchen", enabled: true }] } });
  });

  it("passes on myKx's refusal of a room, a revoked token and a slow-down", async () => {
    const s = await server();
    s.answer = () => ({ status: 400, body: { ok: false, reason: "not-allowed", note: "No camera may look at a bathroom or a bedroom." } });
    expect(await syncCameras(s.url, TOKEN, [])).toMatchObject({ ok: false, refusedRoom: true, message: expect.stringMatching(/bathroom/) });
    s.answer = () => ({ status: 401, body: { ok: false, reason: "wrong" } });
    expect(await syncCameras(s.url, TOKEN, [])).toMatchObject({ ok: false, kind: "revoked" });
    s.answer = () => ({ status: 429, body: { ok: false, reason: "slow-down" } });
    expect(await syncCameras(s.url, TOKEN, [])).toMatchObject({ ok: false, kind: "slow-down", retryAfterSec: 60 });
  });
});

describe("a frames upload", () => {
  it("is one multipart POST: a meta part, then frame0, frame1… in the same order", async () => {
    const s = await server();
    const r = await sendFrames(s.url, TOKEN, frames);
    expect(r).toMatchObject({ kind: "accepted", accepted: 3, read: "live" });
    const seen = s.seen[0];
    expect(seen).toMatchObject({ method: "POST", path: "/api/home/frames", authorization: `Bearer ${TOKEN}` });
    expect(seen.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(seen.meta).toEqual({ frames: frames.map(({ camera, at, burst }) => ({ camera, at, burst })) });
    expect(seen.frames?.map((f) => f.bytes.equals(jpeg(f.bytes[4])) && f.bytes[4])).toEqual([1, 2, 3]);
    expect(seen.frames?.every((f) => f.type === "image/jpeg")).toBe(true);
  });

  it("sends only the token, a time, a camera key and the pictures", async () => {
    const s = await server();
    await sendFrames(s.url, TOKEN, frames.slice(0, 1));
    expect(Object.keys(s.seen[0].meta ?? {})).toEqual(["frames"]);
    expect(Object.keys(s.seen[0].meta?.frames[0] ?? {}).sort()).toEqual(["at", "burst", "camera"]);
  });

  it("builds the form without a network", () => {
    const form = buildFramesForm(frames);
    expect([...form.keys()]).toEqual(["meta", "frame0", "frame1", "frame2"]);
  });

  it("outside the family's hours, comes back as off", async () => {
    const s = await server();
    s.answer = () => ({ status: 200, body: { ok: true, accepted: 0, camerasOn: false } });
    expect(await sendFrames(s.url, TOKEN, frames)).toEqual({ kind: "off" });
  });

  it("is revoked on a 401, and slows down on a 429", async () => {
    const s = await server();
    s.answer = () => ({ status: 401, body: { ok: false, reason: "wrong" } });
    expect(await sendFrames(s.url, TOKEN, frames)).toEqual({ kind: "revoked" });
    s.answer = () => ({ status: 429, body: { ok: false, reason: "slow-down", retryAfterSec: 33 } });
    expect(await sendFrames(s.url, TOKEN, frames)).toEqual({ kind: "slow-down", retryAfterSec: 33 });
    s.answer = () => ({ status: 429, body: { ok: false, reason: "slow-down" } });
    expect(await sendFrames(s.url, TOKEN, frames)).toEqual({ kind: "slow-down", retryAfterSec: null });
  });

  it("skips the round on a 400, 413 or 415", async () => {
    const s = await server();
    for (const [status, reason] of [[400, "invalid"], [413, "too-large"], [415, "not-allowed"]] as const) {
      s.answer = () => ({ status, body: { ok: false, reason } });
      expect(await sendFrames(s.url, TOKEN, frames)).toEqual({ kind: "skipped", status, reason });
    }
  });

  it("reports a server that can't be reached", async () => {
    expect(await sendFrames("http://127.0.0.1:9", TOKEN, frames)).toMatchObject({ kind: "network" });
  });
});
