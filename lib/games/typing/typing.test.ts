import { describe, expect, it } from "vitest";
import { GAMES, gamesFor } from "../registry.ts";
import { STAGES, builtInLevel, startingStage } from "./curriculum.ts";
import { FINGER_OF, cueFor, keyCentre } from "./fingers.ts";
import { accuracy, slips, starsFor, wordsPerMinute } from "./score.ts";
import { expectedKey, press, roundOver, startRound, type TypingState } from "./session.ts";

const typeAll = (s: TypingState, keys: string, t0 = 0, step = 300) =>
  keys.split("").reduce((st, k, i) => press(st, k, t0 + i * step).state, s);

describe("fingers", () => {
  it("maps every board key to one finger, and home keys rest in place", () => {
    for (const row of ["qwertyuiop", "asdfghjkl;", "zxcvbnm,./"]) for (const k of row) expect(FINGER_OF[k]).toBeDefined();
    expect(cueFor("f")).toMatchObject({ finger: "li", reach: { dx: 0, dy: 0 }, caption: "Left pointer → F" });
    expect(cueFor(" ")).toMatchObject({ caption: "Thumb → space", numbers: [5, 6] });
    expect(["a", "s", "d", "f", "j", "k", "l", ";"].map((k) => cueFor(k)?.numbers[0])).toEqual([1, 2, 3, 4, 7, 8, 9, 10]);
  });

  it("reaches up and right for R from F, and down for B", () => {
    const r = cueFor("r");
    expect(r?.finger).toBe("li");
    expect(r?.reach.dy).toBe(-1);
    expect(cueFor("b")?.reach.dy).toBe(1);
    expect(keyCentre("?")).toBeNull();
  });
});

describe("a round", () => {
  it("locks the meteor whose word starts with the key and finishes it", () => {
    let s = startRound(["frog", "egg", "pond"], 3);
    expect(expectedKey(s)).toBe("f");
    const first = press(s, "e", 0); // "egg" is on screen, so E locks it
    expect(first.result).toEqual({ kind: "hit", slot: 1, done: false });
    s = typeAll(first.state, "gg", 300);
    expect(s.finished).toBe(1);
    expect(s.target).toBeNull();
    expect(s.slots[1]).toBeNull(); // the queue had nothing left for that slot
  });

  it("a wrong key fires nothing, counts a miss and remembers what was pressed instead", () => {
    let s = startRound(["bin"], 1);
    const r = press(s, "n", 0);
    expect(r.result).toEqual({ kind: "miss", expected: "b" });
    s = r.state;
    expect(s.hits).toBe(0);
    expect(s.misses).toBe(1);
    expect(s.keys.b.instead.n).toBe(1);
  });

  it("ends when every target is finished and then ignores keys", () => {
    let s = typeAll(startRound(["as", "ad"], 1), "asad");
    expect(roundOver(s)).toBe(true);
    expect(press(s, "a", 99).result.kind).toBe("ignored");
    s = startRound([], 1);
    expect(roundOver(s)).toBe(true);
  });
});

describe("scoring", () => {
  it("accuracy and words a minute", () => {
    const s = typeAll(startRound(["salad", "shall"], 1), "saladshall", 0, 600); // 10 chars over 5.4 s
    expect(accuracy(s)).toBe(1);
    expect(wordsPerMinute(s)).toBe(22);
  });

  it("stars are deterministic: finish, 90 %, 96 % (teens also need speed)", () => {
    expect(starsFor({ finished: false, accuracy: 1, wpm: 40, band: "junior", stage: 1 })).toBe(0);
    expect(starsFor({ finished: true, accuracy: 0.85, wpm: 40, band: "junior", stage: 1 })).toBe(1);
    expect(starsFor({ finished: true, accuracy: 0.92, wpm: 40, band: "junior", stage: 1 })).toBe(2);
    expect(starsFor({ finished: true, accuracy: 0.97, wpm: 4, band: "junior", stage: 1 })).toBe(3);
    expect(starsFor({ finished: true, accuracy: 0.97, wpm: 20, band: "teen", stage: 7 })).toBe(2);
    expect(starsFor({ finished: true, accuracy: 0.97, wpm: 26, band: "teen", stage: 7 })).toBe(3);
  });

  it("slips name a key the child often misses and what they press instead", () => {
    let s = startRound(["bin", "bin", "bin", "bin", "bin"], 1);
    for (let i = 0; i < 5; i++) s = typeAll(s, i < 2 ? "nbin" : "bin", i * 10_000);
    expect(slips(s)[0]).toMatchObject({ key: "b", instead: "n" });
  });
});

describe("curriculum and registry", () => {
  it("built-in levels only use their stage's keys so far, and are stable", () => {
    const allowed = ["asdfghjkl;", "qwertyuiop", "zxcvbnm,./"];
    for (const stage of [1, 2, 3]) {
      const keys = allowed.slice(0, stage).join("");
      for (const w of STAGES[stage - 1].words ?? []) for (const ch of w) expect(keys).toContain(ch);
    }
    expect(builtInLevel(4, 5)).toEqual(builtInLevel(4, 5));
    expect(builtInLevel(1, 1)[0]).toBe("as");
    expect(builtInLevel(4, 1)).toHaveLength(10);
    expect(startingStage("teen")).toBe(4);
  });

  it("shows every child every game, ready ones first, tagged for their own level", () => {
    const ari = gamesFor("junior", "P3");
    const mei = gamesFor("teen", "Sec 2");
    expect(ari.map((g) => g.id).sort()).toEqual(GAMES.map((g) => g.id).sort());
    expect(mei.map((g) => g.id).sort()).toEqual(GAMES.map((g) => g.id).sort());
    expect(ari.slice(0, 3).every((g) => g.status === "ready")).toBe(true);
    expect(ari.find((g) => g.id === "neon-strike")?.tagText).toBe("Typing · P3 Science answers");
    expect(mei.find((g) => g.id === "star-typer")?.tagText).toBe("Typing · Sec 2 vocabulary");
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
  });
});
