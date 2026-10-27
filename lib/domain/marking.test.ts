import { describe, expect, it } from "vitest";
import { type MarkableItem, markItem, normaliseAnswer, parseQuantity } from "./marking.ts";

const mcq: MarkableItem = { type: "mcq", marks: 2, answer: 3, options: ["a", "b", "c", "d"] };
const short = (answer: string, extra: Partial<MarkableItem> = {}): MarkableItem => ({ type: "short", marks: 1, answer, ...extra });
const ok = (item: MarkableItem, r: string) => markItem(item, r).correct;

describe("mcq", () => {
  it("marks the keyed option right and every other option wrong", () => {
    expect(markItem(mcq, 3)).toMatchObject({ status: "marked", correct: true, marks: 2, confirmed: true });
    expect(markItem(mcq, "3")).toMatchObject({ correct: true });
    for (const r of [1, 2, 4, 0, 3.5, "", null, undefined, "c"]) expect(markItem(mcq, r).correct).toBe(false);
  });
});

describe("short answers", () => {
  it("ignores case, spacing, Markdown bold, quotes and a trailing full stop", () => {
    expect(ok(short("happily"), "  Happily. ")).toBe(true);
    expect(ok(short("Living things **reproduce**."), "living things reproduce")).toBe(true);
    expect(ok(short("happily"), "happyly")).toBe(false);
  });

  it("accepts the listed alternatives", () => {
    expect(markItem(short("about", { accept: ["on"] }), "On")).toMatchObject({ correct: true, rule: "accept" });
    expect(ok(short("about", { accept: ["on"] }), "in")).toBe(false);
  });

  it("matches sequences however they are separated", () => {
    const seq = short("1, 5, 3, 6, 2, 4, 7");
    for (const r of ["1,5,3,6,2,4,7", "1 5 3 6 2 4 7", "1536247", "1，5，3，6，2，4，7"]) expect(ok(seq, r)).toBe(true);
    expect(ok(seq, "1, 5, 3, 6, 2, 7, 4")).toBe(false);
  });

  it("matches money and units, rejecting a different unit", () => {
    expect(ok(short("$12"), "12")).toBe(true);
    expect(ok(short("$12"), "$12.00")).toBe(true);
    expect(ok(short("$142"), "S$142")).toBe(true);
    expect(ok(short("25 cm²"), "25")).toBe(true);
    expect(ok(short("25 cm²"), "25cm2")).toBe(true);
    expect(ok(short("25 cm²"), "25 cm")).toBe(false);
    expect(ok(short("1,200 m"), "1200")).toBe(true);
    expect(ok(short("6"), "6.0")).toBe(true);
    expect(ok(short("6"), "7")).toBe(false);
  });

  it("applies a numeric tolerance only when the item has one", () => {
    expect(ok(short("3.14", { tolerance: 0.01 }), "3.141")).toBe(true);
    expect(ok(short("3.14"), "3.141")).toBe(false);
    expect(ok(short("15", { unit: "kWh" }), "15 kWh")).toBe(true);
    expect(ok(short("15", { unit: "kWh" }), "15 W")).toBe(false);
  });

  it("compares fractions as written, so 6/8 is not 3/4 in simplest form", () => {
    expect(ok(short("3/4"), "3/4")).toBe(true);
    expect(ok(short("3/4"), " 3 / 4 ")).toBe(false); // only spacing inside is not normalised
    expect(ok(short("3/4"), "6/8")).toBe(false);
    expect(ok(short("3/4"), "0.75")).toBe(false);
  });

  it("matches clock times on the same clock", () => {
    expect(ok(short("16 05"), "1605")).toBe(true);
    expect(ok(short("16 05"), "16:05")).toBe(true);
    expect(ok(short("16 05"), "4.05 p.m.")).toBe(false);
    expect(ok(short("5.35 p.m."), "5:35pm")).toBe(true);
    expect(ok(short("5.35 p.m."), "5.35 a.m.")).toBe(false);
    expect(ok(short("5.35 p.m."), "5.35")).toBe(false);
  });

  it("keeps punctuation-only answers (a trailing-full-stop rule must not erase them)", () => {
    expect(ok(short("."), ".")).toBe(true);
    expect(ok(short("!"), "!")).toBe(true);
    expect(ok(short("!"), ".")).toBe(false);
    expect(ok(short("."), "")).toBe(false);
  });

  it("marks an empty answer wrong", () => {
    expect(markItem(short("6"), "   ")).toMatchObject({ correct: false, marks: 0, confirmed: true });
  });
});

describe("open and card items", () => {
  const open: MarkableItem = { type: "open", marks: 2, answer: "A model answer." };
  const card: MarkableItem = { type: "card", marks: 1, answer: "lā jī — rubbish" };

  it("never invents a score for an open item", () => {
    expect(markItem(open, "my answer")).toEqual({ status: "needs_review", correct: null, marks: null, maxMarks: 2, confirmed: false });
  });

  it("takes a parent's or admin's score as confirmed, a self-check as unconfirmed", () => {
    expect(markItem(open, "x", { marks: 1, by: "parent" })).toMatchObject({ status: "marked", marks: 1, correct: false, confirmed: true });
    expect(markItem(open, "x", { marks: 5, by: "admin" })).toMatchObject({ marks: 2, correct: true, confirmed: true });
    expect(markItem(open, "x", { marks: 2, by: "self" })).toMatchObject({ status: "self_check", confirmed: false });
  });

  it("treats cards as self-checks that never confirm", () => {
    expect(markItem(card, "knew it")).toMatchObject({ status: "self_check", marks: null, confirmed: false });
    expect(markItem(card, "", { marks: 1, by: "admin" })).toMatchObject({ confirmed: false });
  });
});

describe("helpers", () => {
  it("normalise full-width characters and curly quotes", () => {
    expect(normaliseAnswer("“ＡＢＣ”。")).toBe("abc");
  });

  it("parse quantities but not fractions", () => {
    expect(parseQuantity("$4.50")).toEqual({ value: 4.5, unit: "$" });
    expect(parseQuantity("2 kw")).toEqual({ value: 2, unit: "kw" });
    expect(parseQuantity("3/4")).toBeNull();
  });
});
