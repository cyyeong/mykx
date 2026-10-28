import { describe, expect, it } from "vitest";
import { partPoints, quantize, REPLAY_INDEX, ReplayRecorder } from "./replay.ts";

const face = (shift = 0) => Array.from({ length: 478 }, (_, i) => ({ x: ((i % 100) / 100) * 0.5 + 0.2 + shift, y: (Math.floor(i / 100) / 5) * 0.5 + 0.2 }));
const reading = (o: Partial<{ yaw: number; pitch: number; eyesClosed: number; jawOpen: number }> = {}) => ({ yaw: 0, pitch: 0, eyesClosed: 0, jawOpen: 0, ...o });

describe("face-free replay", () => {
  it("keeps only the outline points, as rounded numbers", () => {
    const q = quantize(face())!;
    expect(q).toHaveLength(REPLAY_INDEX.length * 2);
    expect(q.every((n) => Number.isInteger(n) && n >= 0 && n <= 999)).toBe(true);
    expect(quantize(face().slice(0, 100))).toBeNull();
    expect(partPoints(q, "irises")).toHaveLength(2);
  });

  it("clips a few seconds around a counted moment, and only inside a note's window", () => {
    const r = new ReplayRecorder();
    const t0 = Date.parse("2026-10-30T10:00:00Z");
    for (let i = 0; i < 40; i++) {
      const t = t0 + i * 300;
      const closed = i >= 10 && i < 16; // 1.8 s with eyes shut
      r.push(face(), reading({ eyesClosed: closed ? 0.9 : 0.1 }), t);
    }
    const clips = r.clipsBetween("2026-10-30T09:59:00Z", "2026-10-30T10:01:00Z");
    expect(clips).toHaveLength(1);
    expect(clips[0].kind).toBe("eyes");
    expect(clips[0].frames.length).toBeGreaterThanOrEqual(6);
    expect(r.clipsBetween("2026-10-30T11:00:00Z", "2026-10-30T11:03:00Z")).toEqual([]);
  });

  it("ignores a normal blink", () => {
    const r = new ReplayRecorder();
    const t0 = Date.parse("2026-10-30T10:00:00Z");
    for (let i = 0; i < 20; i++) r.push(face(), reading({ eyesClosed: i === 5 ? 0.9 : 0.1 }), t0 + i * 300);
    expect(r.clipsBetween("2026-10-30T09:59:00Z", "2026-10-30T10:01:00Z")).toEqual([]);
  });
});
