import { describe, expect, it } from "vitest";
import type { StoredRun } from "../auth/store.ts";
import { AGENTS, manifestSummary, packCards, publicRun, totalsByModel } from "./hood.ts";

const run = (p: Partial<StoredRun>): StoredRun => ({ at: "2026-10-29T10:00:00.000Z", route: "tutor", operation: "chat_stream", model: "muse-spark-1.3", householdId: "h", profileId: "k", requestId: "r1", responseId: null, latencyMs: 1000, firstTokenMs: 400, inputTokens: 100, outputTokens: 20, images: null, audioSeconds: null, costUsd: 0.0002, ok: true, error: null, ...p });

describe("under the hood", () => {
  it("sums calls per model", () => {
    const t = totalsByModel([run({}), run({ latencyMs: 3000, ok: false }), run({ model: "sam-3.1", images: 1, inputTokens: null, outputTokens: null, latencyMs: null })]);
    expect(t[0]).toMatchObject({ model: "muse-spark-1.3", calls: 2, failed: 1, avgLatencyMs: 2000, inputTokens: 200 });
    expect(t[1]).toMatchObject({ model: "sam-3.1", calls: 1, images: 1, avgLatencyMs: null });
  });

  it("shows which agent, never which child", () => {
    const p = publicRun(run({}));
    expect(p.agent).toBe("Kix Tutor");
    expect(p.forChild).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/"h"|"k"/);
  });

  it("never lists a contributor model for an agent (rule 1)", () => {
    expect(AGENTS.flatMap((a) => a.models).some((m) => m.includes("contributor"))).toBe(false);
  });

  it("reads the packs and the manifest from disk", () => {
    const packs = packCards();
    expect(packs.length).toBeGreaterThanOrEqual(7);
    expect(packs.every((p) => p.coverage >= 0 && p.coverage <= 100)).toBe(true);
    const m = manifestSummary();
    expect(m.assets).toBeGreaterThan(0);
    expect(m.byModel.some((x) => x.model === "muse-image-1.0")).toBe(true);
  });
});
