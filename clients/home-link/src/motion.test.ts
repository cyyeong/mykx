import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BURST_DIFF, HEARTBEAT_MS, MAX_FRAME_BYTES, SEND_DIFF, SEND_WIDTH, THUMB_H, THUMB_W, decide, forUpload, meanAbsDiff, thumbnail } from "./motion.ts";
import { grey } from "./testkit.ts";

const flat = (level: number) => new Uint8Array(THUMB_W * THUMB_H).fill(level);
const sent = (level: number, at: number) => ({ thumb: flat(level), at });
const T0 = Date.parse("2026-10-28T10:00:00Z");

describe("the thresholds", () => {
  it("are the ones in the Guardian spec", () => {
    expect([THUMB_W, THUMB_H, SEND_DIFF, BURST_DIFF, HEARTBEAT_MS]).toEqual([64, 36, 6, 25, 600_000]);
  });
});

describe("thumbnail and difference", () => {
  it("is 64×36 grey, one byte a pixel", async () => {
    const t = await thumbnail(await grey(120));
    expect(t.length).toBe(64 * 36);
    expect(Math.abs(t[100] - 120)).toBeLessThanOrEqual(2);
  });

  it("reads a colour picture as grey too", async () => {
    const colour = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    expect((await thumbnail(colour)).length).toBe(64 * 36);
  });

  it("is the mean absolute difference on the 0–255 scale", () => {
    expect(meanAbsDiff(flat(100), flat(100))).toBe(0);
    expect(meanAbsDiff(flat(100), flat(130))).toBe(30);
    const half = flat(100);
    half.fill(110, 0, half.length / 2);
    expect(meanAbsDiff(flat(100), half)).toBe(5);
  });

  it("treats pictures of different shapes as completely different", () => {
    expect(meanAbsDiff(new Uint8Array(3), new Uint8Array(4))).toBe(255);
  });
});

describe("what to send", () => {
  it("always sends the first picture, as one", () => {
    expect(decide(flat(50), null, T0)).toEqual({ send: true, burst: false, reason: "first", diff: null });
  });

  it("holds back a picture that hasn't changed", () => {
    expect(decide(flat(100), sent(100, T0), T0 + 60_000)).toMatchObject({ send: false, reason: "same", diff: 0 });
    expect(decide(flat(105), sent(100, T0), T0 + 60_000)).toMatchObject({ send: false, diff: 5 });
  });

  it("sends from a difference of 6 up", () => {
    expect(decide(flat(106), sent(100, T0), T0 + 60_000)).toMatchObject({ send: true, burst: false, reason: "changed", diff: 6 });
    expect(decide(flat(124), sent(100, T0), T0 + 60_000)).toMatchObject({ send: true, burst: false, reason: "changed" });
  });

  it("sends a burst of three from a difference of 25 up", () => {
    expect(decide(flat(125), sent(100, T0), T0 + 60_000)).toMatchObject({ send: true, burst: true, reason: "big-change", diff: 25 });
    expect(decide(flat(0), sent(200, T0), T0 + 60_000)).toMatchObject({ burst: true });
  });

  it("sends a heartbeat after 10 quiet minutes, not before", () => {
    expect(decide(flat(100), sent(100, T0), T0 + HEARTBEAT_MS - 1)).toMatchObject({ send: false });
    expect(decide(flat(100), sent(100, T0), T0 + HEARTBEAT_MS)).toMatchObject({ send: true, burst: false, reason: "heartbeat" });
  });

  it("compares with the last picture SENT, so a slow drift adds up", () => {
    const last = sent(100, T0);
    expect(decide(flat(103), last, T0 + 60_000).send).toBe(false);
    expect(decide(flat(106), last, T0 + 120_000).send).toBe(true);
  });
});

describe("the picture as uploaded", () => {
  it("is a JPEG no wider than 960 px", async () => {
    const big = await sharp({ create: { width: 2560, height: 1440, channels: 3, background: "#406080" } }).png().toBuffer();
    const out = await forUpload(big);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(SEND_WIDTH);
    expect(meta.height).toBe(540);
  });

  it("doesn't enlarge a small picture", async () => {
    expect((await sharp(await forUpload(await grey(90, 320, 180))).metadata()).width).toBe(320);
  });

  it("squeezes a noisy picture under myKx's size limit", async () => {
    const noise = Buffer.alloc(3840 * 2160 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    const raw = await sharp(noise, { raw: { width: 3840, height: 2160, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    const out = await forUpload(raw);
    expect(out.length).toBeLessThanOrEqual(MAX_FRAME_BYTES);
    expect(MAX_FRAME_BYTES).toBeLessThan(1.5 * 1024 * 1024);
  });
});
