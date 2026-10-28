import { describe, expect, it } from "vitest";
import { cardsFromLedger } from "./TreasureScreen.tsx";

const ENTRY = { key: "retry_revised:p3sci-demo-02", kind: "stars" as const, rule: "retry_revised" as const, amount: 3, at: "2026-10-28T03:00:00.000Z", day: "2026-10-28", ref: "p3sci-demo-02" };
const STOPS = { "p3sci-demo-02": { label: "Pip the tadpole", art: "/art/cards/frog-tadpole" } };

describe("cardsFromLedger", () => {
  it("titles a card by its stop, with the stop's art, so children never see item ids", () => {
    const [card] = cardsFromLedger([ENTRY], STOPS);
    expect(card).toMatchObject({ title: "Pip the tadpole", note: "Revised retry · +3 stars · 28 Oct", art: "/art/cards/frog-tadpole", chip: "P3 Science" });
    // The id is only a React key; everything a child sees is free of item ids.
    expect(JSON.stringify([card.title, card.note, card.alt, card.chip])).not.toContain("p3sci-demo");
  });

  it("falls back to the rule and the quest art for unknown refs, and skips unpaid entries", () => {
    const [card] = cardsFromLedger([{ ...ENTRY, ref: "mystery" }], STOPS);
    expect(card).toMatchObject({ title: "Revised retry", note: "+3 stars · 28 Oct", art: "/art/cards/gecko-and-frog" });
    expect(cardsFromLedger([{ ...ENTRY, amount: 0 }], STOPS)).toEqual([]);
  });
});
