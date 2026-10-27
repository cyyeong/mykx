import { describe, expect, it } from "vitest";
import { bandOf, describeMastery, familyContributions, recompute } from "./mastery.ts";
import { attempt } from "./test-helpers.ts";

const NOW = "2026-11-04T12:00:00Z";

describe("recompute: the PRD §6 worked example", () => {
  const first = attempt({ itemId: "f1", at: "2026-11-03T09:00:00Z", marks: 2, maxMarks: 4, hintsBeforeSubmit: 2 });
  const second = attempt({ itemId: "f2", at: "2026-11-03T09:05:00Z", marks: 4, maxMarks: 4 });

  it("prior .50; 2/4 with two hints gives q = .10 and m = .38", () => {
    const s = recompute([first], NOW);
    expect(s.steps[0].q).toBeCloseTo(0.1, 3);
    expect(s.m).toBeCloseTo(0.38, 3);
  });

  it("a fresh family at 4/4 without hints gives m = .566", () => {
    const s = recompute([first, second], NOW);
    expect(s.m).toBeCloseTo(0.566, 3);
    expect(s.families).toBe(2);
    expect(describeMastery(s)).toBe("57/100; limited evidence: two families");
  });

  it("ten correct retries of either family leave .566 unchanged", () => {
    const retries = Array.from({ length: 10 }, (_, k) =>
      attempt({ itemId: k % 2 ? "f1" : "f2", firstTry: false, marks: 4, maxMarks: 4, at: `2026-11-03T10:${String(k).padStart(2, "0")}:00Z` }),
    );
    const s = recompute([first, second, ...retries], NOW);
    expect(s.m).toBeCloseTo(0.566, 3);
    expect(s.completion).toMatchObject({ attempts: 12, firstAttempts: 2, retries: 10 });
  });

  it("variants of a seen family (same family, another item) are practice, not evidence", () => {
    const variant = attempt({ itemId: "f2-variant", family: "f2", marks: 0, maxMarks: 4, at: "2026-11-03T11:00:00Z" });
    expect(recompute([first, second, variant], NOW).m).toBeCloseTo(0.566, 3);
  });
});

describe("recompute: eligibility", () => {
  it("hides the .5 prior until there is evidence", () => {
    const s = recompute([], NOW);
    expect(s.m).toBeNull();
    expect(s.confidence).toBe("none");
    expect(describeMastery(s)).toBe("Not yet assessed");
  });

  it("ignores revealed, unconfirmed and retry attempts", () => {
    const events = [
      attempt({ at: "2026-11-01T01:00:00Z", revealed: true, marks: 0 }),
      attempt({ at: "2026-11-01T02:00:00Z", confirmed: false, marks: 0 }),
      attempt({ at: "2026-11-01T03:00:00Z", firstTry: false, marks: 0 }),
    ];
    expect(recompute(events, NOW).m).toBeNull();
    expect(recompute(events, NOW).completion.revealed).toBe(1);
  });

  it("uses the latest score revision, and a correction replays the history", () => {
    const e = attempt({
      at: "2026-11-01T01:00:00Z",
      marks: 0,
      maxMarks: 2,
      revisions: [
        { marks: 1, at: "2026-11-02T00:00:00Z", by: "parent" },
        { marks: 2, at: "2026-11-03T00:00:00Z", by: "admin" },
      ],
    });
    expect(recompute([e], NOW).m).toBeCloseTo(0.65, 6); // .7*.5 + .3*1
  });

  it("uses the earliest attempt per family", () => {
    const early = attempt({ itemId: "x", family: "F", marks: 0, at: "2026-11-01T01:00:00Z" });
    const late = attempt({ itemId: "y", family: "F", marks: 2, at: "2026-11-02T01:00:00Z" });
    expect(recompute([late, early], NOW).m).toBeCloseTo(0.35, 6);
  });

  it("adds the subparts of the earliest question into one contribution", () => {
    const a = attempt({ itemId: "q7a", question: "q7", family: "q7", marks: 1, maxMarks: 1, at: "2026-11-01T01:00:00Z" });
    const b = attempt({ itemId: "q7b", question: "q7", family: "q7", marks: 0, maxMarks: 1, hintsBeforeSubmit: 1, at: "2026-11-01T01:02:00Z" });
    const [c] = familyContributions([a, b]);
    expect(c).toMatchObject({ marks: 1, maxMarks: 2, hints: 1, itemIds: ["q7a", "q7b"] });
    expect(recompute([a, b], NOW).families).toBe(1);
  });

  it("counts a duplicate first try (double submit) once", () => {
    const a = attempt({ id: "d1", itemId: "dup", marks: 0, at: "2026-11-01T01:00:00Z" });
    const b = attempt({ id: "d2", itemId: "dup", marks: 2, at: "2026-11-01T01:00:01Z" });
    expect(recompute([a, b], NOW).m).toBeCloseTo(0.35, 6);
  });

  it("uses only the latest ten families", () => {
    const wrong = Array.from({ length: 5 }, (_, k) => attempt({ marks: 0, at: `2026-10-0${k + 1}T01:00:00Z` }));
    const right = Array.from({ length: 10 }, (_, k) => attempt({ marks: 2, at: `2026-10-${10 + k}T01:00:00Z` }));
    const s = recompute([...wrong, ...right], NOW);
    expect(s.families).toBe(10);
    expect(s.totalFamilies).toBe(15);
    expect(s.m).toBeCloseTo(1 - 0.5 * 0.7 ** 10, 6);
  });

  it("skips malformed events instead of producing NaN", () => {
    const bad = [
      attempt({ at: "not a date" }),
      attempt({ at: "2026-11-01T01:00:00Z", maxMarks: 0 }),
      attempt({ at: "2026-11-01T01:00:00Z", marks: Number.NaN }),
    ];
    const s = recompute(bad, NOW);
    expect(s.m).toBeNull();
  });

  it("clamps marks above the maximum and penalises at most two hints", () => {
    const e = attempt({ at: "2026-11-01T01:00:00Z", marks: 9, maxMarks: 2, hintsBeforeSubmit: 5 });
    const s = recompute([e], NOW);
    expect(s.steps[0].q).toBeCloseTo(0.5, 6); // min(1 - .4, m = .5)
  });
});

describe("assisted success cannot raise m", () => {
  it("holds for every hinted contribution, whatever the marks", () => {
    const events = [];
    for (let k = 0; k < 30; k++) {
      events.push(attempt({ at: `2026-10-${String(1 + (k % 28)).padStart(2, "0")}T0${k % 10}:00:00Z`, marks: k % 3, maxMarks: 2, hintsBeforeSubmit: (k % 3) as 0 | 1 | 2 }));
    }
    for (let n = 1; n <= events.length; n++) {
      for (const s of recompute(events.slice(0, n), NOW).steps) if (s.assisted) expect(s.after).toBeLessThanOrEqual(s.before + 1e-12);
    }
  });
});

describe("confidence, staleness and the label", () => {
  const five = (day: (k: number) => string) => Array.from({ length: 5 }, (_, k) => attempt({ at: day(k), marks: 2 }));

  it("is limited below five families, and below two dates", () => {
    expect(recompute(five(() => "2026-11-01T01:00:00Z").slice(0, 4), NOW).confidence).toBe("limited");
    const oneDay = recompute(five((k) => `2026-11-01T0${k}:00:00Z`), NOW);
    expect(oneDay.confidence).toBe("limited");
    expect(describeMastery(oneDay)).toMatch(/limited evidence: five families, all on one day$/);
  });

  it("is developing at five families over two Singapore dates", () => {
    // 15:00Z on 1 Nov is 23:00 SGT; 17:00Z is 01:00 SGT on 2 Nov.
    const s = recompute(five((k) => (k < 3 ? `2026-11-01T15:0${k}:00Z` : `2026-11-01T17:0${k}:00Z`)), NOW);
    expect(s.dates).toEqual(["2026-11-01", "2026-11-02"]);
    expect(s.confidence).toBe("developing");
    expect(describeMastery(s)).toBe("92/100; developing evidence: five families over two days");
  });

  it("flags evidence older than 14 days as stale", () => {
    const s = recompute([attempt({ at: "2026-10-15T01:00:00Z" })], NOW);
    expect(s.stale).toBe(true);
    expect(describeMastery(s)).toBe("65/100; limited evidence: one family; stale: last practised 20 days ago");
    expect(recompute([attempt({ at: "2026-10-25T01:00:00Z" })], NOW).stale).toBe(false);
  });
});

describe("challenge bands", () => {
  it("are easy below .4, medium .4–.7, harder above .7, and medium at cold start", () => {
    expect([0.39, 0.4, 0.7, 0.71].map(bandOf)).toEqual(["easy", "medium", "medium", "harder"]);
    expect(bandOf(null)).toBe("medium");
  });
});

describe("assisted success across a sliding window", () => {
  it("never lifts the score when the window drops a weak old family", () => {
    // Ten families: the oldest is a zero, the rest are perfect. Then an assisted perfect answer arrives.
    const ten = Array.from({ length: 10 }, (_, k) =>
      attempt({ itemId: `w${k}`, at: `2026-10-${String(10 + k).padStart(2, "0")}T09:00:00Z`, marks: k === 0 ? 0 : 4, maxMarks: 4 }),
    );
    const before = recompute(ten, NOW).m ?? 0;
    const assisted = attempt({ itemId: "w10", at: "2026-10-25T09:00:00Z", marks: 4, maxMarks: 4, hintsBeforeSubmit: 1 });
    const after = recompute([...ten, assisted], NOW).m ?? 0;
    expect(after).toBeLessThanOrEqual(before);
  });
});
