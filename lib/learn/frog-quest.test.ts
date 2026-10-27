import { describe, expect, it } from "vitest";
import { attempt } from "../domain/test-helpers.ts";
import { FROG_QUEST, loadFrogItems, nextPickId, questStops, questSummary, sessionPicks } from "./frog-quest.ts";

const NOW = "2026-10-28T19:00:00+08:00";

describe("frog quest items", () => {
  it("loads the five reviewed frog items, easiest first", () => {
    const items = loadFrogItems();
    expect(items.map((i) => i.id)).toEqual(["p3sci-demo-01", "p3sci-demo-02", "p3sci-demo-03", "p3sci-demo-04", "p3sci-demo-05"]);
    expect(items.every((i) => i.status === "reviewed" && i.topic === "cycles.animal")).toBe(true);
  });
});

describe("questStops", () => {
  const ids = FROG_QUEST.stops.map((s) => s.itemId);

  it("starts current, next, locked with no attempts", () => {
    expect(questStops(ids, []).map((s) => s.state)).toEqual(["current", "next", "locked", "locked", "locked"]);
  });

  it("masters only on independent success, never on a wrong try", () => {
    const wrong = [attempt({ itemId: ids[0], family: ids[0], marks: 0, at: NOW })];
    expect(questStops(ids, wrong).map((s) => s.state)).toEqual(["current", "next", "locked", "locked", "locked"]);
    const right = [attempt({ itemId: ids[0], family: ids[0], at: NOW })];
    expect(questStops(ids, right).map((s) => s.state)).toEqual(["mastered", "current", "next", "locked", "locked"]);
  });

  it("a hinted success leaves the stop current: only independent success masters", () => {
    const assisted = [attempt({ itemId: ids[0], family: ids[0], hintsBeforeSubmit: 1, at: NOW })];
    expect(questStops(ids, assisted).map((s) => s.state)).toEqual(["current", "next", "locked", "locked", "locked"]);
  });
});

describe("sessionPicks", () => {
  it("picks three distinct frog families, all new evidence", () => {
    const picks = sessionPicks(loadFrogItems(), [], NOW, "ari-2026-10-28");
    expect(picks).toHaveLength(3);
    // Cold start may reserve one probe pick; every pick is still new evidence.
    expect(picks.every((p) => p.evidence === "new")).toBe(true);
    expect(new Set(picks.map((p) => p.family)).size).toBe(3);
  });

  it("moves past attempted families", () => {
    const items = loadFrogItems();
    const first = sessionPicks(items, [], NOW, "ari-2026-10-28");
    const done = first.map((p) => attempt({ itemId: p.items[0].id, family: p.family, at: NOW }));
    const second = sessionPicks(items, done, NOW, "ari-2026-10-28");
    expect(second.map((p) => p.items[0].id)).not.toEqual(first.map((p) => p.items[0].id));
  });
});

describe("nextPickId", () => {
  it("walks the session in order and ends with null", () => {
    const items = loadFrogItems();
    const picks = sessionPicks(items, [], NOW, "ari-2026-10-28");
    const [a, b, c] = picks.map((p) => p.items[0].id);
    const afterA = [attempt({ itemId: a, family: picks[0].family, at: NOW })];
    expect(nextPickId(picks, afterA, a)).toBe(b);
    const afterB = [...afterA, attempt({ itemId: b, family: picks[1].family, at: NOW })];
    expect(nextPickId(picks, afterB, b)).toBe(c);
    const afterC = [...afterB, attempt({ itemId: c, family: picks[2].family, at: NOW })];
    expect(nextPickId(picks, afterC, c)).toBeNull();
  });
});

describe("questSummary", () => {
  it("counts families attempted and independently correct", () => {
    const ids = FROG_QUEST.stops.map((s) => s.itemId);
    const attempts = [
      attempt({ itemId: ids[0], family: ids[0], at: NOW }),
      attempt({ itemId: ids[1], family: ids[1], marks: 0, at: NOW }),
      attempt({ itemId: ids[1], family: ids[1], marks: 0, hintsBeforeSubmit: 1, at: NOW }),
    ];
    expect(questSummary(ids, attempts)).toEqual({ total: 5, attempted: 2, correct: 1, hints: 1 });
  });
});
