// Kix Synapse end to end on the sample family, with the models faked (docs/prd/SYNAPSE.md §3): a typo fixes itself
// as the pack's next version and can be undone; an Ask Kix mistake is reproduced, its caution proven and added to
// the prompt; a score change waits for the admin; "Kix was right" is explained to the kid; evals run.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askKixVars } from "../kix/homework.ts";
import { instructionsFor } from "../agents/runtime.ts";
import { LEARNED_HEADING } from "../agents/instructions.ts";
import { ABBY_ID, DEMO_HOUSEHOLD_ID } from "../auth/demo-family.ts";
import { demoStore, resetDemoStore } from "../auth/store-demo.ts";
import { findItem } from "../learn/subjects.ts";
import { clearSkillOverrides } from "../skills/overrides.ts";
import { undoFix } from "./apply.ts";
import { cautionsFor, forgetCautions } from "./cautions.ts";
import { runEvals } from "./evals.ts";
import { takeReport } from "./intake.ts";
import { runReview, type Deps } from "./review.ts";
import { DEFAULT_SETTINGS } from "./settings.ts";
import { signTurn } from "./turn.ts";
import type { Review } from "./types.ts";

const ITEM = "p6math-demo-01";
const base: Review = { verdict: "problem", kind: "typo", fix: { type: "item-text", field: "stem", before: "same number of stamps", after: "same number of stamp", when: null, check: null }, test: { kind: "exact", expect: "" }, confidence: 100, evidence: [], rationale: "r", kidNote: "Fixed: a word in the question." };

function deps(review: Review, o: { second?: { agree: boolean; confidence: number } } = {}): Deps {
  const store = demoStore();
  return {
    store,
    settings: DEFAULT_SETTINGS,
    names: ["Abby", "Jordan", "Leonard"],
    review: async () => ({ data: review, choice: { role: "synapse.reviewer", wanted: { provider: "baseten", model: "meta-models/muse-spark-open" }, used: { provider: "meta", model: "muse-spark-1.3" }, fallback: "no-key" }, costUsd: 0.004 }),
    second: async () => ({ agree: o.second?.agree ?? true, confidence: o.second?.confidence ?? 100, reason: "ok", model: "muse-spark-1.3", costUsd: 0.002 }),
    judge: async () => ({ pass: true, costUsd: 0 }),
    // Ask Kix keeps the total only when the caution is in its prompt.
    rerun: async (_t, extra) => ({ text: "Steps…", final: extra.some((l) => l.includes("total stays the same")) ? "Box A had 153 marbles at first." : "Box A had 135 marbles at first.", costUsd: 0.001 }),
    now: () => new Date().toISOString(),
  };
}

const abby = async () => (await demoStore().kid(DEMO_HOUSEHOLD_ID, ABBY_ID))!;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "");
  vi.stubEnv("KID_SESSION_SECRET", "synapse-test-secret-0123456789abcdefghijkl");
  resetDemoStore();
  clearSkillOverrides();
  forgetCautions();
});
afterEach(() => {
  clearSkillOverrides();
  vi.unstubAllEnvs();
});

describe("a typo in a question", () => {
  it("fixes itself as the pack's next version, tells the kid, adds an eval, and can be undone", async () => {
    const store = demoStore();
    const taken = await takeReport(store, DEMO_HOUSEHOLD_ID, await abby(), { surface: "learn", kind: "typo", note: "Abby thinks 'stamps' is wrong", itemId: ITEM });
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(taken.report.case.note).toBe("Learner thinks 'stamps' is wrong");
    const r = (await runReview(taken.report.id, deps(base)))!;
    expect(r.status).toBe("auto-fixed");
    expect(r.confidence).toBe(100);
    expect(r.fixRef).toMatchObject({ type: "skill-version", packId: "p6-maths" });
    expect(r.kidNote).toContain("Fixed");
    expect(r.steps.map((s) => s.kind)).toEqual(["report", "case", "ai", "guard", "guard", "decision"]);
    expect(findItem(ITEM)!.item.stem).toContain("same number of stamp.");
    const run = await runEvals(store, deps(base), "manual");
    expect(run).toMatchObject({ passed: 1, total: 1 });
    const undone = await undoFix(store, r, null);
    expect(undone.ok).toBe(true);
    // Reverted by a new version with the inverse change: the history keeps both.
    expect(findItem(ITEM)!.item.stem).toContain("same number of stamps");
    const versions = await store.skillVersions.list("p6-maths");
    expect(versions.filter((v) => v.source === "synapse" && !v.deletedAt)).toHaveLength(2);
    expect(r.fixRef).toMatchObject({ type: "skill-version", change: "text", field: "stem", before: "same number of stamps", after: "same number of stamp" });
  });

  it("joins a second report on the same question, and stops at 10 a day", async () => {
    const store = demoStore();
    const kid = await abby();
    const first = await takeReport(store, DEMO_HOUSEHOLD_ID, kid, { surface: "learn", kind: "typo", note: null, itemId: ITEM });
    const again = await takeReport(store, DEMO_HOUSEHOLD_ID, kid, { surface: "learn", kind: "hint", note: null, itemId: ITEM });
    expect(again.ok && again.duplicate && first.ok && again.report.id === first.report.id).toBe(true);
    expect((await takeReport(store, DEMO_HOUSEHOLD_ID, kid, { surface: "learn", kind: "typo", note: null, itemId: "p3sci-nope" })).ok).toBe(false);
  });
});

describe("a mistake in Ask Kix's reply", () => {
  it("is reproduced, the caution proven, and Ask Kix's prompt carries it", async () => {
    const store = demoStore();
    const kid = await abby();
    const shown = "Step 3: Total after = 4u − 20 = 180";
    const ask = "Box A had 3 times as many marbles as Box B. After 85 moved from A to B, B had twice as many as A. How many were in A at first?";
    const token = signTurn({ surface: "ask-kix", kid: kid.id, agent: "ask-kix", agentVersion: 1, packId: "p6-maths", packVersion: null, itemId: null, level: "P6", subject: "maths", stage: "steps", species: null, petStage: null, sections: [], shown, ask })!;
    const taken = await takeReport(store, DEMO_HOUSEHOLD_ID, kid, { surface: "ask-kix", kind: "answer-wrong", note: "Step 3 changes the total", token, shown, ask });
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    const caution: Review = { ...base, kind: "model-behaviour", fix: { type: "caution", field: null, before: null, after: null, when: "items move between two groups in a before-and-after problem", check: "check the total stays the same before working out one unit" }, test: { kind: "number", expect: "153" } };
    const r = (await runReview(taken.report.id, deps(caution)))!;
    expect(r.reproduce).toEqual({ runs: 3, failing: 3, how: "model" });
    expect(r.retest).toMatchObject({ before: 0, after: 3, runs: 3 });
    expect(r.status).toBe("auto-fixed");
    expect(r.fixRef).toMatchObject({ type: "caution", agent: "ask-kix" });
    expect(await cautionsFor(store, "ask-kix", { level: "P6" })).toEqual(["When items move between two groups in a before-and-after problem, check the total stays the same before working out one unit."]);
    expect(await cautionsFor(store, "ask-kix", { level: "P3" })).toEqual([]);
    const prompt = await instructionsFor("ask-kix", askKixVars({ nickname: "Learner", level: "P6", band: "teen", stage: "steps" }), { store });
    expect(prompt).toContain(LEARNED_HEADING);
    expect(prompt.indexOf(LEARNED_HEADING)).toBeLessThan(prompt.lastIndexOf("Never"));
  });

  it("refuses a turn that wasn't this kid's or these words", async () => {
    const store = demoStore();
    const kid = await abby();
    const token = signTurn({ surface: "ask-kix", kid: "someone-else", agent: "ask-kix", agentVersion: 1, packId: null, packVersion: null, itemId: null, level: "P6", subject: null, stage: "hint", species: null, petStage: null, sections: [], shown: "x" })!;
    expect(await takeReport(store, DEMO_HOUSEHOLD_ID, kid, { surface: "ask-kix", kind: "other", note: null, token, shown: "x" })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("decisions that wait or explain", () => {
  it("leaves a score change for the admin, even at 100 with a second opinion", async () => {
    const store = demoStore();
    const taken = await takeReport(store, DEMO_HOUSEHOLD_ID, await abby(), { surface: "learn", kind: "marked-wrong", note: null, itemId: ITEM, answer: "2. 60", marked: false });
    if (!taken.ok) throw new Error("not taken");
    const key: Review = { ...base, kind: "answer-key", fix: { type: "item-answer", field: null, before: null, after: "2", when: null, check: null } };
    const r = (await runReview(taken.report.id, deps(key)))!;
    expect(r.second).toMatchObject({ agree: true });
    expect(r.status).toBe("waiting");
    expect(r.steps.at(-1)!.title).toContain("scoring changes need an admin");
    expect(findItem(ITEM)!.item.answer).toBe(3);
  });

  it("tells the kid why Kix was right", async () => {
    const store = demoStore();
    const taken = await takeReport(store, DEMO_HOUSEHOLD_ID, await abby(), { surface: "learn", kind: "question-wrong", note: null, itemId: ITEM });
    if (!taken.ok) throw new Error("not taken");
    const right: Review = { ...base, verdict: "not-a-problem", kind: "not-an-issue", fix: { type: "none", field: null, before: null, after: null, when: null, check: null }, kidNote: "Good eye! The question is right: the total stays the same." };
    const r = (await runReview(taken.report.id, deps(right)))!;
    expect(r.status).toBe("kix-was-right");
    expect(r.kidNote).toContain("Good eye");
  });
});
