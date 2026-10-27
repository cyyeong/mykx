import { describe, expect, it } from "vitest";
import { cardsFromLedger } from "./TreasureScreen.tsx";

const ENTRY = { key: "first_attempt:x", kind: "stars" as const, rule: "first_attempt" as const, amount: 2, at: "2026-10-28T11:00:00.000Z", day: "2026-10-28", ref: "p3sci-demo-02" };

describe("cardsFromLedger", () => {
  it("renders refs through labels so children never see item ids", () => {
    const [card] = cardsFromLedger([ENTRY], { "p3sci-demo-02": "Pip the tadpole" });
    expect(card.note).toBe("2026-10-28 · +2 stars · Pip the tadpole");
  });

  it("omits unknown refs and unpaid entries", () => {
    expect(cardsFromLedger([{ ...ENTRY, ref: "mystery" }])).toHaveLength(1);
    expect(cardsFromLedger([{ ...ENTRY, ref: "mystery" }])[0].note).toBe("2026-10-28 · +2 stars");
    expect(cardsFromLedger([{ ...ENTRY, amount: 0 }])).toEqual([]);
  });
});
