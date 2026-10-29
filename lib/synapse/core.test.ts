// Kix Synapse's rules in code (docs/prd/SYNAPSE.md): de-identification, signed turns, the code checks on a fix, the
// computed confidence and the decision. A model proposes; these decide.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyItemFix, checkFix } from "./checks.ts";
import { computeConfidence, decide } from "./confidence.ts";
import { deidentify, holdsName } from "./deid.ts";
import { codeCheck } from "./expect.ts";
import { DEFAULT_SETTINGS } from "./settings.ts";
import { checkTurn, signTurn } from "./turn.ts";
import type { ItemSnapshot, LearnedCaution, Review } from "./types.ts";

const item: ItemSnapshot = { id: "p6math-x-01", packId: "p6-maths", type: "short", stem: "Tank A holds water. Tank B is empty. How tall is the water in Tank C?", passage: null, options: null, answer: "20", accept: null, working: ["Total volume 54000 cm3", "Height is 20 cm in both"], hints: null, figure: "figures/tanks.svg" };
const review = (over: Partial<Review> = {}, fix: Partial<Review["fix"]> = {}): Review => ({
  verdict: "problem",
  kind: "figure-mismatch",
  fix: { type: "item-text", field: "stem", before: "Tank C", after: "Tank B", when: null, check: null, ...fix },
  test: { kind: "contains", expect: "Tank B" },
  confidence: 100,
  evidence: [],
  rationale: "The figure says Tank B.",
  kidNote: "The question said Tank C, but the picture shows Tank B. It's fixed now.",
  ...over,
});

beforeEach(() => vi.stubEnv("KID_SESSION_SECRET", "synapse-test-secret-0123456789abcdefghijkl"));
afterEach(() => vi.unstubAllEnvs());

describe("de-identification", () => {
  it("replaces the family's names and strips contact details", () => {
    const out = deidentify("Abby says call 9123 4567 or mail abby@example.com, ask Mum Mei at Blk 123 Tampines St 11", { learner: ["Abby"], parent: ["Mei"] });
    expect(out).not.toMatch(/Abby|Mei|9123|example\.com|Blk 123/);
    expect(out).toContain("Learner");
    expect(holdsName("A note for abby", ["Abby"])).toBe(true);
  });
});

describe("signed turns", () => {
  const fields = { surface: "ask-kix" as const, kid: "kid-1", agent: "ask-kix", agentVersion: 1, packId: "p6-maths", packVersion: null, itemId: null, level: "P6", subject: "maths", stage: "steps", species: null, petStage: null, sections: [], shown: "Step 3: total after = 180", ask: "Box A had 3 times…" };

  it("checks the signature, the kid and the exact words", () => {
    const token = signTurn(fields)!;
    expect(checkTurn(token, { kidId: "kid-1", shown: "Step 3:  total after = 180", ask: fields.ask }).ok).toBe(true);
    expect(checkTurn(token, { kidId: "kid-2", shown: fields.shown, ask: fields.ask })).toMatchObject({ ok: false, reason: "other-kid" });
    expect(checkTurn(token, { kidId: "kid-1", shown: "Step 3: total after = 204", ask: fields.ask })).toMatchObject({ ok: false, reason: "text" });
    expect(checkTurn(`${token.slice(0, -2)}xx`, { kidId: "kid-1", shown: fields.shown, ask: fields.ask })).toMatchObject({ ok: false, reason: "signature" });
    expect(checkTurn(token, { kidId: "kid-1", shown: fields.shown, ask: fields.ask, now: Date.now() + 2 * 86_400_000 })).toMatchObject({ ok: false, reason: "expired" });
  });
});

describe("code checks on a fix", () => {
  it("passes a small text fix that is in the item once", () => {
    expect(checkFix(review(), item, ["Abby"]).every((c) => c.ok)).toBe(true);
  });

  it("refuses a fix that changes a number, isn't in the item, or carries a name", () => {
    expect(checkFix(review({}, { before: "20 cm", after: "25 cm", field: "working.1" }), item, []).some((c) => !c.ok)).toBe(true);
    expect(checkFix(review({}, { before: "Tank D" }), item, []).find((c) => c.name === "Text found once")?.ok).toBe(false);
    expect(checkFix(review({ kidNote: "Thanks Abby!" }), item, ["Abby"]).find((c) => c.name === "No names")?.ok).toBe(false);
  });

  it("only lets a caution narrow what an agent does", () => {
    const good = review({ kind: "model-behaviour" }, { type: "caution", field: null, before: null, after: null, when: "items move between two groups in a before-and-after problem", check: "check the total stays the same before working out one unit" });
    expect(checkFix(good, null, []).every((c) => c.ok)).toBe(true);
    const loose = review({ kind: "model-behaviour" }, { type: "caution", field: null, before: null, after: null, when: "a child is stuck", check: "reveal the answer to save time" });
    expect(checkFix(loose, null, []).find((c) => c.name === "Only narrows")?.ok).toBe(false);
  });

  it("applies a text fix to the one item in the pack files", () => {
    const files = { "items/a.json": JSON.stringify([{ id: "other", stem: "Tank C" }, { ...item, packId: undefined }]) };
    const out = applyItemFix(files, item.id, review());
    expect(out.ok).toBe(true);
    if (out.ok) {
      const list = JSON.parse(out.files["items/a.json"]);
      expect(list[1].stem).toContain("Tank B");
      expect(list[0].stem).toBe("Tank C");
    }
  });
});

describe("confidence and the decision", () => {
  const checks = [{ name: "x", ok: true, note: "" }];

  it("is the reviewer's number only when everything holds up", () => {
    expect(computeConfidence({ review: review(), checks, reproduce: { runs: 1, failing: 1, how: "pack" }, retest: null, second: null }).value).toBe(100);
    expect(computeConfidence({ review: review(), checks: [{ name: "x", ok: false, note: "" }], reproduce: { runs: 1, failing: 1, how: "pack" }, retest: null, second: null }).value).toBe(0);
    const caution = review({ kind: "model-behaviour" }, { type: "caution", when: "w", check: "c" });
    expect(computeConfidence({ review: caution, checks, reproduce: { runs: 3, failing: 2, how: "model" }, retest: { before: 1, after: 3, runs: 3 }, second: null }).value).toBe(90);
    expect(computeConfidence({ review: caution, checks, reproduce: { runs: 3, failing: 3, how: "model" }, retest: { before: 0, after: 2, runs: 3 }, second: null }).value).toBe(70);
    expect(computeConfidence({ review: caution, checks, reproduce: { runs: 3, failing: 0, how: "model" }, retest: { before: 3, after: 3, runs: 3 }, second: null }).value).toBe(60);
    const key = review({ kind: "marking-rule" }, { type: "item-accept", field: null, before: null, after: "1/4" });
    expect(computeConfidence({ review: key, checks, reproduce: { runs: 1, failing: 1, how: "pack" }, retest: null, second: null }).value).toBe(0);
    expect(computeConfidence({ review: key, checks, reproduce: { runs: 1, failing: 1, how: "pack" }, retest: null, second: { agree: true, confidence: 96 } }).value).toBe(96);
  });

  it("fixes by itself only at the threshold, and never a score change while an admin must approve those", () => {
    const s = DEFAULT_SETTINGS;
    expect(decide({ review: review(), confidence: 100, settings: s, autoToday: 0, repeats: 1 }).decision).toBe("auto-fix");
    expect(decide({ review: review(), confidence: 99, settings: s, autoToday: 0, repeats: 1 }).decision).toBe("waiting");
    expect(decide({ review: review(), confidence: 92, settings: { ...s, threshold: 90 }, autoToday: 0, repeats: 1 }).decision).toBe("auto-fix");
    expect(decide({ review: review(), confidence: 100, settings: s, autoToday: 20, repeats: 1 }).decision).toBe("waiting");
    const key = review({ kind: "answer-key" }, { type: "item-answer", after: "3" });
    expect(decide({ review: key, confidence: 100, settings: s, autoToday: 0, repeats: 1 }).decision).toBe("waiting");
    expect(decide({ review: key, confidence: 100, settings: { ...s, scoringNeedsAdmin: false }, autoToday: 0, repeats: 1 }).decision).toBe("auto-fix");
    expect(decide({ review: review({ verdict: "not-a-problem", kind: "not-an-issue" }, { type: "none" }), confidence: 100, settings: s, autoToday: 0, repeats: 1 }).decision).toBe("kix-was-right");
    expect(decide({ review: review({ kind: "app-bug" }, { type: "none" }), confidence: 100, settings: s, autoToday: 0, repeats: 1 }).decision).toBe("for-team");
    expect(decide({ review: review(), confidence: 100, settings: { ...s, on: false }, autoToday: 0, repeats: 1 }).decision).toBe("waiting");
  });
});

describe("code-checked tests", () => {
  it("checks numbers in the final answer, and words", () => {
    expect(codeCheck({ kind: "number", expect: "153" }, "…", "Box A had 153 marbles at first.")).toBe(true);
    expect(codeCheck({ kind: "number", expect: "153" }, "…", "135 marbles")).toBe(false);
    expect(codeCheck({ kind: "not-contains", expect: "flies" }, "I eat algae and soft plants.")).toBe(true);
    expect(codeCheck({ kind: "judge", expect: "kind" }, "x")).toBeNull();
  });
});

describe("undo is a deterministic revert", () => {
  const files = { "items/a.json": JSON.stringify([{ id: "q1", type: "short", stem: "Tank B is full", answer: "20", accept: ["20 cm"] }, { id: "q2", type: "mcq", stem: "Pick", options: ["a", "b", "c"], answer: 2 }]) };
  const item = (f: Record<string, string>, id: string) => JSON.parse(f["items/a.json"]).find((x: { id: string }) => x.id === id);

  it("puts the words back, takes an extra answer out, and restores an old answer", async () => {
    const { revertItemFix } = await import("./checks.ts");
    const text = revertItemFix(files, { itemId: "q1", change: "text", field: "stem", before: "Tank C", after: "Tank B", previous: null });
    expect(text.ok && item(text.files, "q1").stem).toBe("Tank C is full");
    const accept = revertItemFix(files, { itemId: "q1", change: "accept", field: null, before: null, after: "20 cm", previous: null });
    expect(accept.ok && item(accept.files, "q1").accept).toBeUndefined();
    const answer = revertItemFix(files, { itemId: "q2", change: "answer", field: null, before: null, after: "2", previous: "3" });
    expect(answer.ok && item(answer.files, "q2").answer).toBe(3);
  });

  it("refuses when the question no longer holds what the fix wrote", async () => {
    const { revertItemFix } = await import("./checks.ts");
    expect(revertItemFix(files, { itemId: "q1", change: "text", field: "stem", before: "Tank C", after: "Tank D", previous: null })).toEqual({ ok: false, reason: "changed-since" });
  });
});

describe("the change log", () => {
  it("lists what changed, by whom, and whether it's still live", async () => {
    const { changesFrom } = await import("./admin.ts");
    const base = { id: "r1", householdId: "h", profileId: "p", by: "kid", createdAt: "2026-10-29T10:00:00Z", updatedAt: "2026-10-29T10:01:00Z", surface: "ask-kix", kind: "other", turn: { agent: "ask-kix" }, case: { note: "dont use the word fun" }, decidedBy: "synapse", decidedAt: "2026-10-29T10:01:00Z" };
    const caution = { id: "c1", agent: "ask-kix", when: "replying to a learner", check: "don't use the word \"fun\"", scope: { level: null, subject: null }, status: "active", reportIds: ["r1"], evalCaseIds: [], createdAt: "2026-10-29T10:01:00Z", createdBy: "synapse", expiresAt: null } as LearnedCaution;
    const reports = [
      { ...base, status: "auto-fixed", fixRef: { type: "caution", cautionId: "c1", agent: "ask-kix", line: "When replying to a learner, don't use the word \"fun\"." } },
      { ...base, id: "r2", status: "kix-was-right", fixRef: null },
      { ...base, id: "r3", status: "undone", decidedBy: "admin-1", fixRef: { type: "skill-version", packId: "p6-maths", versionId: "v", version: "1.4.0", change: "text", field: "stem", before: "Tank C", after: "Tank B" }, undo: { at: "2026-10-29T11:00:00Z", by: "admin-1", versionId: "v2", version: "1.5.0" } },
    ] as unknown as Parameters<typeof changesFrom>[0];
    const log = changesFrom(reports, [caution]);
    expect(log.map((c) => [c.reportId, c.target.id, c.kind, c.status, c.by])).toEqual([
      ["r1", "ask-kix", "caution", "live", "synapse"],
      ["r3", "p6-maths", "text", "undone", "admin"],
    ]);
    expect(log[1].undo?.version).toBe("1.5.0");
  });
});
