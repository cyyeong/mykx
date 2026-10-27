import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing.ts";
import { startRun } from "./run.ts";

describe("estimateCostUsd", () => {
  it("prices Muse Spark tokens per million", () => {
    // 1,000 in x $1.25/M + 2,000 out x $4.25/M = 0.00125 + 0.0085
    expect(estimateCostUsd("muse-spark-1.3", { inputTokens: 1000, outputTokens: 2000 })).toBe(0.00975);
  });

  it("prices cached input at the cached rate", () => {
    // 600 uncached x 1.25 + 400 cached x 0.15 = 750 + 60 = 810 per M -> 0.00081
    expect(estimateCostUsd("muse-spark-1.3", { inputTokens: 1000, cachedInputTokens: 400, outputTokens: 0 })).toBe(0.00081);
  });

  it("prices images per image, ignoring reference-only tokens", () => {
    expect(estimateCostUsd("muse-image-1.0", { images: 2, inputTokens: 5000, outputTokens: 5000 })).toBe(0.02);
    expect(estimateCostUsd("sam-3.1", { images: 1 })).toBe(0.0025);
  });

  it("returns null for unknown models or missing usage", () => {
    expect(estimateCostUsd("muse-spark-9", { inputTokens: 10, outputTokens: 10 })).toBeNull();
    expect(estimateCostUsd("muse-spark-1.3", {})).toBeNull();
    expect(estimateCostUsd("muse-image-1.0", { images: null })).toBeNull();
  });
});

describe("startRun", () => {
  it("builds a RunInfo with latency and cost", () => {
    const clock = startRun("chat", "muse-spark-1.3");
    const run = clock.finish({ requestId: "req_1", responseId: "chatcmpl-1", inputTokens: 1000, outputTokens: 2000 });
    expect(run).toMatchObject({
      provider: "meta",
      operation: "chat",
      model: "muse-spark-1.3",
      requestId: "req_1",
      responseId: "chatcmpl-1",
      firstTokenMs: null,
      images: null,
      costUsd: 0.00975,
      ok: true,
      error: null,
    });
    expect(run.latencyMs).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(run.startedAt))).toBe(false);
  });

  it("wraps errors as MetaApiError with a failed run", () => {
    const clock = startRun("image_edit", "muse-image-1.0");
    const err = clock.toError(new Error("socket hang up"), { images: 0 }, false);
    expect(err.code).toBe("error");
    expect(err.run.ok).toBe(false);
    expect(err.run.error).toContain("socket hang up");
    expect(err.run.costUsd).toBe(0);
  });
});
