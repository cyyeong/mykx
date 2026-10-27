import { describe, expect, it } from "vitest";
import type { AttemptEvent } from "./attempts.ts";
import { CAP_NOTE, DAILY_CAP, type LedgerEntry, type RewardEvent, awardsFor, buildLedger, pointsOnDay, totalPoints } from "./rewards.ts";
import { attempt } from "./test-helpers.ts";

const A = (p: Partial<AttemptEvent> & { at: string }): RewardEvent => ({ type: "attempt", attempt: attempt(p) });

describe("FR10 rules", () => {
  it("pays 2 for a first attempt with the child's explanation, and nothing without one", () => {
    const ledger = buildLedger([A({ itemId: "i1", at: "2026-11-04T01:00:00Z", explanation: true }), A({ itemId: "i2", at: "2026-11-04T01:01:00Z" })]);
    expect(ledger.map((e) => [e.rule, e.amount, e.ref])).toEqual([["first_attempt", 2, "i1"]]);
  });

  it("pays 3 for a retry with a revised explanation, once per item, never after a reveal", () => {
    const ledger = buildLedger([
      A({ itemId: "i1", at: "2026-11-04T01:00:00Z", marks: 0 }),
      A({ itemId: "i1", at: "2026-11-04T01:01:00Z", firstTry: false, explanation: true, explanationRevised: true }),
      A({ itemId: "i1", at: "2026-11-04T01:02:00Z", firstTry: false, explanation: true, explanationRevised: true }),
      A({ itemId: "i1", at: "2026-11-04T01:03:00Z", firstTry: false, explanation: true }), // not revised
      A({ itemId: "i2", at: "2026-11-04T01:04:00Z", marks: 0, revealed: true }),
      A({ itemId: "i2", at: "2026-11-04T01:05:00Z", firstTry: false, explanation: true, explanationRevised: true }),
    ]);
    expect(ledger.map((e) => [e.rule, e.amount, e.ref])).toEqual([["retry_revised", 3, "i1"]]);
  });

  it("pays 5 for a fresh-family independent success after an error in the subskill, once per error", () => {
    const ledger = buildLedger([
      A({ itemId: "f1", at: "2026-11-04T01:00:00Z", marks: 0 }), // error
      A({ itemId: "f2", at: "2026-11-04T01:01:00Z", hintsBeforeSubmit: 1 }), // assisted: no
      A({ itemId: "f3", at: "2026-11-04T01:02:00Z" }), // fresh, independent: yes
      A({ itemId: "f4", at: "2026-11-04T01:03:00Z" }), // no new error since: no
      A({ itemId: "f5", at: "2026-11-04T01:04:00Z", subskill: "other" }), // no error in that subskill: no
      A({ itemId: "f6", at: "2026-11-04T01:05:00Z", revealed: true, marks: 0 }), // error (reveal)
      A({ itemId: "f7", family: "f3", at: "2026-11-04T01:06:00Z" }), // a seen family: no
      A({ itemId: "f8", at: "2026-11-04T01:07:00Z" }), // yes
    ]);
    expect(ledger.map((e) => [e.rule, e.amount, e.key])).toEqual([
      ["fresh_transfer", 5, "fresh_transfer:f3"],
      ["fresh_transfer", 5, "fresh_transfer:f8"],
    ]);
  });

  it("pays 5 per saved creation, once per creation however many versions", () => {
    const ledger = buildLedger([
      { type: "creation_saved", creationId: "c1", at: "2026-11-04T01:00:00Z" },
      { type: "creation_saved", creationId: "c1", at: "2026-11-04T02:00:00Z" },
      { type: "creation_saved", creationId: "c2", at: "2026-11-05T02:00:00Z" },
    ]);
    expect(ledger.map((e) => [e.key, e.amount])).toEqual([
      ["creation_saved:c1", 5],
      ["creation_saved:c2", 5],
    ]);
  });
});

describe("the daily cap and idempotency", () => {
  const busyDay = Array.from({ length: 12 }, (_, k) =>
    A({ itemId: `d${k}`, at: `2026-11-04T0${Math.floor(k / 6)}:${String(k * 5).padStart(2, "0")}:00Z`, explanation: true, marks: k % 2 ? 2 : 0 }),
  );

  it("never pays more than 15 repeatable points on one Singapore day, topping up exactly", () => {
    const ledger = buildLedger(busyDay);
    expect(pointsOnDay(ledger, "2026-11-04")).toBe(DAILY_CAP);
    const capped = ledger.filter((e) => e.note === CAP_NOTE);
    expect(capped.length).toBeGreaterThan(0);
    expect(capped.every((e) => e.amount < (e.requested ?? 0))).toBe(true);
  });

  it("uses the Singapore date: 23:30 SGT and 00:30 SGT are different days", () => {
    const late = Array.from({ length: 8 }, (_, k) => A({ itemId: `l${k}`, at: `2026-11-04T15:3${k}:00Z`, explanation: true })); // 23:3x SGT, 4 Nov
    const early = Array.from({ length: 8 }, (_, k) => A({ itemId: `e${k}`, at: `2026-11-04T16:3${k}:00Z`, explanation: true })); // 00:3x SGT, 5 Nov
    const ledger = buildLedger([...late, ...early]);
    expect(pointsOnDay(ledger, "2026-11-04")).toBe(15);
    expect(pointsOnDay(ledger, "2026-11-05")).toBe(15);
  });

  it("never pays twice for a refresh, a double submit or a replay of the stream", () => {
    const first = A({ id: "same", itemId: "r1", at: "2026-11-04T01:00:00Z", explanation: true });
    const ledger = buildLedger([first]);
    expect(awardsFor(first, { ledger, attempts: [] })).toEqual([]);
    const doubleSubmit = A({ id: "other", itemId: "r1", at: "2026-11-04T01:00:02Z", explanation: true });
    expect(awardsFor(doubleSubmit, { ledger, attempts: [] })).toEqual([]);
    const replayed = buildLedger(busyDay, buildLedger(busyDay));
    expect(replayed).toEqual(buildLedger(busyDay));
  });

  it("spends the key of a capped event, so it never pays out on a later day", () => {
    const ledger = buildLedger(busyDay);
    const lastCapped = ledger.filter((e) => e.amount === 0 && e.rule === "first_attempt").at(-1) as LedgerEntry;
    const again = busyDay.find((e) => e.type === "attempt" && `first_attempt:${e.attempt.itemId}` === lastCapped.key) as RewardEvent;
    expect(awardsFor(again, { ledger, attempts: [] })).toEqual([]);
  });

  it("keeps keys unique and amounts whole and non-negative", () => {
    const ledger = buildLedger(busyDay);
    expect(new Set(ledger.map((e) => e.key)).size).toBe(ledger.length);
    expect(ledger.every((e) => Number.isInteger(e.amount) && e.amount >= 0)).toBe(true);
    expect(totalPoints(ledger)).toBe(15);
  });
});
