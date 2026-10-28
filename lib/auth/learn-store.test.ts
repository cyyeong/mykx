// The learning record in the demo store (synthetic data only).
import { beforeEach, describe, expect, it } from "vitest";
import { attempt } from "../domain/test-helpers.ts";
import { JORDAN_ID, DEMO_HOUSEHOLD_ID, KAI_ID, OTHER_HOUSEHOLD_ID, ABBY_ID } from "./demo-family.ts";
import { resetDemoStore, seedDemoHistory, DemoStore } from "./store-demo.ts";
import type { StoredAttempt } from "./store.ts";

const AT = "2026-10-28T19:00:00.000Z";

function stored(p: Partial<StoredAttempt> = {}): StoredAttempt {
  const base = attempt({ at: AT });
  return {
    ...base,
    idempotencyKey: `key-${base.id}`,
    answer: 2,
    explanationText: null,
    skillVersion: "1.0.0",
    ...p,
  };
}

let store: DemoStore;
beforeEach(() => {
  store = resetDemoStore();
});

describe("attempts", () => {
  it("round-trips oldest first", async () => {
    await store.learn.saveAttempt(DEMO_HOUSEHOLD_ID, JORDAN_ID, stored({ id: "b", at: "2026-10-28T19:02:00.000Z", idempotencyKey: "k2" }));
    await store.learn.saveAttempt(DEMO_HOUSEHOLD_ID, JORDAN_ID, stored({ id: "a", at: "2026-10-28T19:01:00.000Z", idempotencyKey: "k1" }));
    expect((await store.learn.attempts(DEMO_HOUSEHOLD_ID, JORDAN_ID)).map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("ignores a resubmitted idempotency key (offline retry)", async () => {
    const first = stored({ idempotencyKey: "same" });
    await store.learn.saveAttempt(DEMO_HOUSEHOLD_ID, JORDAN_ID, first);
    await store.learn.saveAttempt(DEMO_HOUSEHOLD_ID, JORDAN_ID, { ...first, id: "other", marks: 0 });
    expect(await store.learn.attempts(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toHaveLength(1);
  });

  it("is scoped to the household", async () => {
    await store.learn.saveAttempt(DEMO_HOUSEHOLD_ID, JORDAN_ID, stored());
    expect(await store.learn.attempts(DEMO_HOUSEHOLD_ID, KAI_ID)).toEqual([]);
    expect(await store.learn.attempts(OTHER_HOUSEHOLD_ID, JORDAN_ID)).toEqual([]);
  });

  it("refuses a kid from another household", async () => {
    await store.learn.saveAttempt(OTHER_HOUSEHOLD_ID, JORDAN_ID, stored());
    expect(await store.learn.attempts(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toEqual([]);
  });

  it("finds attempts by idempotency key, scoped to the household", async () => {
    await store.learn.saveAttempt(DEMO_HOUSEHOLD_ID, JORDAN_ID, stored({ id: "a1", idempotencyKey: "k1" }));
    expect((await store.learn.attemptByKey(DEMO_HOUSEHOLD_ID, JORDAN_ID, "k1"))?.id).toBe("a1");
    expect(await store.learn.attemptByKey(DEMO_HOUSEHOLD_ID, JORDAN_ID, "missing")).toBeNull();
    expect(await store.learn.attemptByKey(OTHER_HOUSEHOLD_ID, JORDAN_ID, "k1")).toBeNull();
    expect(await store.learn.attemptByKey(DEMO_HOUSEHOLD_ID, KAI_ID, "k1")).toBeNull();
  });
});

describe("ledger", () => {
  const entry = { key: "first_attempt:x", kind: "stars" as const, rule: "first_attempt" as const, amount: 2, at: AT, day: "2026-10-28" };

  it("appends and skips replays", async () => {
    await store.learn.saveLedgerEntries(DEMO_HOUSEHOLD_ID, JORDAN_ID, [entry]);
    await store.learn.saveLedgerEntries(DEMO_HOUSEHOLD_ID, JORDAN_ID, [entry, { ...entry, key: "retry_revised:x", rule: "retry_revised" as const, amount: 3 }]);
    expect((await store.learn.ledger(DEMO_HOUSEHOLD_ID, JORDAN_ID)).map((e) => e.key)).toEqual(["first_attempt:x", "retry_revised:x"]);
  });

  it("is scoped to the household", async () => {
    await store.learn.saveLedgerEntries(DEMO_HOUSEHOLD_ID, JORDAN_ID, [entry]);
    expect(await store.learn.ledger(OTHER_HOUSEHOLD_ID, KAI_ID)).toEqual([]);
  });

  it("pays the same award to two kids (storage keys are namespaced)", async () => {
    await store.learn.saveLedgerEntries(DEMO_HOUSEHOLD_ID, JORDAN_ID, [entry]);
    await store.learn.saveLedgerEntries(DEMO_HOUSEHOLD_ID, ABBY_ID, [entry]);
    expect((await store.learn.ledger(DEMO_HOUSEHOLD_ID, JORDAN_ID)).map((e) => e.key)).toEqual(["first_attempt:x"]);
    expect((await store.learn.ledger(DEMO_HOUSEHOLD_ID, ABBY_ID)).map((e) => e.key)).toEqual(["first_attempt:x"]);
  });
});

describe("seedDemoHistory", () => {
  it("gives Jordan two answered stops, two cards and a tadpole Pip", async () => {
    const seeded = new DemoStore();
    seedDemoHistory(seeded);
    expect(await seeded.learn.attempts(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toHaveLength(3);
    expect((await seeded.learn.ledger(DEMO_HOUSEHOLD_ID, JORDAN_ID)).map((e) => [e.key, e.amount])).toEqual([
      ["first_attempt:p3sci-demo-01", 2],
      ["retry_revised:p3sci-demo-02", 3],
    ]);
  });
});

describe("removeKid", () => {
  it("drops the learning record with the profile", async () => {
    await store.learn.saveAttempt(DEMO_HOUSEHOLD_ID, JORDAN_ID, stored());
    await store.learn.saveLedgerEntries(DEMO_HOUSEHOLD_ID, JORDAN_ID, [{ key: "k", kind: "stars", rule: "first_attempt", amount: 2, at: AT, day: "2026-10-28" }]);
    expect(await store.removeKid(DEMO_HOUSEHOLD_ID, JORDAN_ID)).toBe(true);
    expect(store.attemptRows.size).toBe(0);
    expect(store.ledgerRows.size).toBe(0);
  });
});
