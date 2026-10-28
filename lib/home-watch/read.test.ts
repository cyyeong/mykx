import { readFileSync } from "node:fs";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readTick } from "./read.ts";
import type { ReaderKid } from "./reader.ts";

const KIDS: ReaderKid[] = [{ nickname: "Ari", band: "junior", description: null }, { nickname: "Zara", band: "junior", description: null }];
afterEach(() => vi.unstubAllEnvs());

describe("the cached fallback for the simulator's synthetic frames (rule 7)", () => {
  it("answers from an earlier live read when there's no Meta key, labelled cached, and says nothing for other pictures", async () => {
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "");
    const bytes = new Uint8Array(readFileSync("public/art/sim/living-argument.webp"));
    const tick = await readTick([{ cameraKey: "living-room", room: "Living room", at: "2026-10-30T09:08:00Z", bytes }], KIDS);
    expect(tick.source).toBe("cached");
    expect(tick.error).toBe("no-key");
    expect(tick.readings.get("living-room")).toMatchObject({ activity: "arguing", concern: "watch", source: "cached" });
    const other = new Uint8Array(await sharp({ create: { width: 64, height: 36, channels: 3, background: "#123456" } }).jpeg().toBuffer());
    expect((await readTick([{ cameraKey: "study", room: "Study", at: "2026-10-30T09:08:00Z", bytes: other }], KIDS)).source).toBe("none");
  });
});
