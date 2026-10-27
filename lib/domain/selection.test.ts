import { describe, expect, it } from "vitest";
import type { PracticeItem } from "./attempts.ts";
import { recompute } from "./mastery.ts";
import { NO_NEW_EVIDENCE, type SelectionRequest, factorsFor, priorityOf, selectNext } from "./selection.ts";
import { attempt } from "./test-helpers.ts";

const NOW = "2026-11-04T09:00:00Z";

function item(id: string, subskill: string, p: Partial<PracticeItem> = {}): PracticeItem {
  return { id, skill: "p3-science", topic: "cycles.animal", subskill, difficulty: 3, marks: 2, type: "mcq", status: "reviewed", ...p };
}

const bank: PracticeItem[] = [
  item("s-1", "stage_features"),
  item("s-2", "stage_features"),
  item("s-3", "stage_features"),
  item("o-1", "three_stage"),
  item("o-2", "three_stage"),
  item("d-1", "duration_graph", { difficulty: 4 }),
  item("m-1", "poles", { topic: "interactions.magnets" }),
  item("draft-1", "stage_features", { status: "draft" }),
  item("open-1", "stage_features", { type: "open" }),
  item("other-course", "stage_features", { skill: "p6-science" }),
];

const req = (p: Partial<SelectionRequest> = {}): SelectionRequest => ({ course: "p3-science", items: bank, mastery: {}, history: [], now: NOW, ...p });

describe("factors and priority", () => {
  it("follow the §6 formula", () => {
    const mastery = recompute([attempt({ at: "2026-11-01T01:00:00Z", marks: 0 })], NOW); // m = .35
    const f = factorsFor(
      { topic: "cycles.animal", difficulty: 1 },
      { mastery, lastPractised: "2026-11-01T01:00:00Z", now: NOW, selectedTopics: ["cycles.animal"], assessment: { date: "2026-11-10T00:00:00Z", topics: ["cycles.animal"] } },
    );
    expect(f.W).toBeCloseTo(0.65, 6);
    expect(f.C).toBe(1);
    expect(f.A).toBeCloseTo(1 - 6 / 30, 6);
    expect(f.D).toBeCloseTo(3.333 / 7, 3);
    expect(f.H).toBe(1); // easy item, easy band
    expect(priorityOf(f)).toBeCloseTo(0.35 * 0.65 + 0.2 + 0.2 * 0.8 + 0.15 * f.D + 0.1, 6);
  });

  it("use the hidden prior, the unseen D and a 0.3 band mismatch at cold start", () => {
    const f = factorsFor({ topic: "x", difficulty: 5 }, { mastery: undefined, lastPractised: null, now: NOW });
    expect(f).toEqual({ W: 0.5, C: 0, A: 0, D: 0.5, H: 0.3 });
  });

  it("score a prerequisite topic 0.5 and an out-of-scope or past test 0", () => {
    const ctx = { mastery: undefined, lastPractised: null, now: NOW };
    expect(factorsFor({ topic: "p", difficulty: 3 }, { ...ctx, prerequisiteTopics: ["p"] }).C).toBe(0.5);
    expect(factorsFor({ topic: "p", difficulty: 3 }, { ...ctx, assessment: { date: "2026-11-10T00:00:00Z", topics: ["q"] } }).A).toBe(0);
    expect(factorsFor({ topic: "p", difficulty: 3 }, { ...ctx, assessment: { date: "2026-11-01T00:00:00Z", topics: ["p"] } }).A).toBe(0);
    expect(factorsFor({ topic: "p", difficulty: 3 }, { ...ctx, assessment: { date: "2027-01-01T00:00:00Z", topics: ["p"] } }).A).toBe(0);
  });
});

describe("selectNext", () => {
  it("picks three distinct families from the course's approved objective items only", () => {
    const r = selectNext(req());
    expect(r.picks).toHaveLength(3);
    const ids = r.picks.flatMap((p) => p.items.map((i) => i.id));
    expect(new Set(r.picks.map((p) => p.family)).size).toBe(3);
    for (const id of ids) expect(["draft-1", "open-1", "other-course"]).not.toContain(id);
  });

  it("never crosses course to fill a gap", () => {
    const r = selectNext(req({ items: [item("a", "x"), item("b", "y", { skill: "p6-science" }), item("c", "z", { skill: "p3-maths" })] }));
    expect(r.picks.map((p) => p.question)).toEqual(["a"]);
  });

  it("keeps sessions diverse: at most two questions per subskill while others remain", () => {
    const miss = attempt({ itemId: "s-0", at: "2026-10-20T01:00:00Z", subskill: "stage_features", marks: 0 });
    const r = selectNext(req({ mastery: { "p3-science/cycles.animal/stage_features": recompute([miss], NOW) }, history: [miss] }));
    const counts = new Map<string, number>();
    for (const p of r.picks) counts.set(p.subskill, (counts.get(p.subskill) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    expect(r.picks[0].subskill).toBe("p3-science/cycles.animal/stage_features");
  });

  it("reserves one cold-start probe when an unassessed subskill has questions", () => {
    const key = (s: string) => `p3-science/cycles.animal/${s}`;
    const weak = (s: string) => recompute([attempt({ at: "2026-10-20T01:00:00Z", subskill: s, marks: 0 })], NOW);
    const mastery = { [key("stage_features")]: weak("stage_features"), [key("three_stage")]: weak("three_stage"), [key("duration_graph")]: weak("duration_graph") };
    const r = selectNext(req({ mastery }));
    expect(r.picks.filter((p) => p.kind === "probe")).toHaveLength(1);
    expect(r.picks.find((p) => p.kind === "probe")?.subskill).toBe("p3-science/interactions.magnets/poles");
  });

  it("excludes families practised within 7 days, and offers older ones only as labelled review", () => {
    const history = [
      attempt({ itemId: "s-1", at: "2026-10-28T10:00:00Z" }), // 6.96 days ago: excluded
      attempt({ itemId: "s-2", at: "2026-10-28T08:00:00Z" }), // 7.04 days ago: review
    ];
    const small = [item("s-1", "stage_features"), item("s-2", "stage_features"), item("n-1", "three_stage")];
    const r = selectNext(req({ items: small, history }));
    expect(r.excludedRecent).toBe(1);
    expect(r.picks.map((p) => [p.question, p.kind, p.evidence, p.label])).toEqual([
      ["n-1", "probe", "new", undefined],
      ["s-2", "review", "none", NO_NEW_EVIDENCE],
    ]);
    expect(r.exhausted).toBe(false);
  });

  it("treats a future-dated attempt (clock skew) as just practised", () => {
    const history = [attempt({ itemId: "s-1", at: "2026-11-04T09:30:00Z" })];
    const r = selectNext(req({ items: [item("s-1", "stage_features"), item("n-1", "three_stage")], history }));
    expect(r.picks.map((p) => p.question)).toEqual(["n-1"]);
    expect(r.excludedRecent).toBe(1);
  });

  it("takes tuned weights, and can switch the probe reservation off", () => {
    const f = { W: 1, C: 0, A: 0, D: 0, H: 0 };
    expect(priorityOf(f)).toBeCloseTo(0.35, 9);
    expect(priorityOf(f, { weights: { W: 0.5 } })).toBeCloseTo(0.5, 9);
    const ctx = { mastery: undefined, lastPractised: null, now: NOW };
    expect(factorsFor({ topic: "x", difficulty: 5 }, { ...ctx, tuning: { unseenD: 0.2, hMismatch: 0 } })).toMatchObject({ D: 0.2, H: 0 });
    const key = (s: string) => `p3-science/cycles.animal/${s}`;
    const weak = (s: string) => recompute([attempt({ at: "2026-10-20T01:00:00Z", subskill: s, marks: 0 })], NOW);
    const mastery = { [key("stage_features")]: weak("stage_features"), [key("three_stage")]: weak("three_stage"), [key("duration_graph")]: weak("duration_graph") };
    const wHeavy = { weights: { W: 1 } };
    expect(selectNext(req({ mastery, tuning: wHeavy })).picks.some((p) => p.kind === "probe")).toBe(true);
    expect(selectNext(req({ mastery, tuning: { ...wHeavy, reserveProbe: false } })).picks.some((p) => p.kind === "probe")).toBe(false);
  });

  it("reports an exhausted bank and never invents questions", () => {
    const history = bank.map((i) => attempt({ itemId: i.id, at: "2026-10-01T00:00:00Z" }));
    const r = selectNext(req({ history }));
    expect(r.exhausted).toBe(true);
    expect(r.picks.every((p) => p.evidence === "none" && p.label === NO_NEW_EVIDENCE)).toBe(true);
    expect(selectNext(req({ items: [] })).picks).toEqual([]);
  });

  it("serves the parts of a question together", () => {
    const parts = [item("q-9a", "x"), item("q-9b", "x"), item("q-10", "y")];
    const r = selectNext(req({ items: parts }));
    expect(r.picks.find((p) => p.question === "q-9")?.items.map((i) => i.id)).toEqual(["q-9a", "q-9b"]);
  });

  it("is deterministic, and a seed only reorders ties", () => {
    const a = selectNext(req({ seed: "kid-1|2026-11-04" }));
    expect(selectNext(req({ seed: "kid-1|2026-11-04" }))).toEqual(a);
    const seeds = new Set(Array.from({ length: 12 }, (_, k) => selectNext(req({ seed: `s${k}` })).picks.map((p) => p.question).join()));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("explains each pick by its strongest weighted factors", () => {
    const r = selectNext(req({ selectedTopics: ["cycles.animal"], assessment: { date: "2026-11-08T00:00:00Z", topics: ["cycles.animal"] } }));
    const top = r.picks[0];
    expect(top.strongest).toHaveLength(2);
    expect(top.strongest[0].value).toBeGreaterThanOrEqual(top.strongest[1].value);
    expect(top.strongest.map((s) => s.reason)).toEqual(expect.arrayContaining(["today's topic"]));
  });

  it("raises the share of in-scope questions before a test", () => {
    const inScope = (r: ReturnType<typeof selectNext>) => r.picks.filter((p) => p.items[0].topic === "interactions.magnets").length;
    const hard = { topic: "interactions.magnets", difficulty: 5 as const };
    const magnets = [...bank.filter((i) => i.id !== "m-1"), item("m-1", "poles", hard), item("m-2", "attract_repel", hard), item("m-3", "north_south", hard)];
    const before = inScope(selectNext(req({ items: magnets })));
    const during = inScope(selectNext(req({ items: magnets, assessment: { date: "2026-11-07T00:00:00Z", topics: ["interactions.magnets"] } })));
    expect(before).toBe(0);
    expect(during).toBeGreaterThan(before);
  });
});
