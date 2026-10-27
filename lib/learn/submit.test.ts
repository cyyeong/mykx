// submitAttempt against the demo store (synthetic data only).
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { ARI_ID, DEMO_HOUSEHOLD_ID } from "../auth/demo-family.ts";
import { resetDemoStore, type DemoStore } from "../auth/store-demo.ts";
import { sgDate } from "../domain/time.ts";
import { submitAttempt, type AttemptInput } from "./submit.ts";

const ITEM = "p3sci-demo-01"; // frog order, answer option 2
const NOW_DAY = sgDate(new Date().toISOString());

function input(p: Partial<AttemptInput> = {}): AttemptInput {
  return { itemId: ITEM, response: 2, explanation: "Eggs hatch into tadpoles", hintsUsed: 0, revealed: false, key: randomUUID(), ...p };
}

let store: DemoStore;
beforeEach(() => {
  store = resetDemoStore();
});

describe("submitAttempt", () => {
  it("marks a correct first try, pays +2 and labels mastery honestly", async () => {
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input());
    expect(r.correct).toBe(true);
    expect(r.marks).toBe(2);
    expect(r.firstTry).toBe(true);
    expect(r.mastery).toContain("limited evidence");
    expect(r.awards).toEqual([{ rule: "first_attempt", amount: 2 }]);
    expect(r.starsToday).toBe(2);
    expect(r.capReached).toBe(false);
  });

  it("pays nothing without an explanation", async () => {
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ explanation: null }));
    expect(r.correct).toBe(true);
    expect(r.awards).toEqual([]);
    expect(r.starsToday).toBe(0);
  });

  it("marks wrong answers kindly: no stars, still stored", async () => {
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ response: 1, explanation: null }));
    expect(r.correct).toBe(false);
    expect(r.marks).toBe(0);
    expect(r.awards).toEqual([]);
    expect(await store.learn.attempts(DEMO_HOUSEHOLD_ID, ARI_ID)).toHaveLength(1);
  });

  it("pays +3 for an explained retry", async () => {
    await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ response: 1, explanation: null }));
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ response: 2, explanation: "Tadpoles come from eggs" }));
    expect(r.firstTry).toBe(false);
    expect(r.awards).toEqual([{ rule: "retry_revised", amount: 3 }]);
    expect(r.starsToday).toBe(3);
  });

  it("a resubmitted key returns the stored result without paying twice", async () => {
    const key = randomUUID();
    const first = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ key }));
    const second = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ key }));
    expect(second.attemptId).toBe(first.attemptId);
    expect(second.correct).toBe(true);
    expect(second.marks).toBe(2);
    expect(second.firstTry).toBe(true);
    expect(second.awards).toEqual([]);
    expect(second.starsToday).toBe(first.starsToday);
    expect(await store.learn.attempts(DEMO_HOUSEHOLD_ID, ARI_ID)).toHaveLength(1);
  });

  it("caps at 15 stars a day and says learning still counts", async () => {
    await store.learn.saveLedgerEntries(DEMO_HOUSEHOLD_ID, ARI_ID, [
      { key: "seed", kind: "stars", rule: "first_attempt", amount: 15, at: new Date().toISOString(), day: NOW_DAY },
    ]);
    const r = await submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ itemId: "p3sci-demo-02" }));
    expect(r.capReached).toBe(true);
    expect(r.starsToday).toBe(15);
    expect(r.awards).toEqual([{ rule: "first_attempt", amount: 0, note: "daily cap reached" }]);
  });

  it("rejects unknown items", async () => {
    await expect(submitAttempt(store, DEMO_HOUSEHOLD_ID, ARI_ID, input({ itemId: "nope" }))).rejects.toThrow("unknown-item");
  });
});
