import { describe, expect, it } from "vitest";
import type { SkillItem, SkillTopic } from "../types.ts";
import { loadFigures, loadPrintBank } from "./bank.ts";
import { buildBlocks } from "./blocks.ts";
import { apportion, assemblePaper, paperFigures, printableTopics, SHORT_QUESTIONS, type Paper, type PrintBank } from "./paper.ts";
import { paperHref, readPaperOptions } from "./params.ts";

// ─── Synthetic bank (a pack with no blueprint: sections by item type) ─────

let n = 0;
function item(p: Partial<SkillItem> & { topic: string }): SkillItem {
  n += 1;
  const type = p.type ?? "mcq";
  return {
    id: p.id ?? `t-${String(n).padStart(3, "0")}`,
    skill: "test-pack",
    subskill: "s",
    difficulty: 2,
    marks: type === "mcq" ? 2 : 1,
    type,
    stem: `Question ${n}?`,
    options: type === "mcq" ? ["one", "two", "three", "four"] : undefined,
    answer: type === "mcq" ? 1 : "an answer",
    source: { kind: "own", ref: "test" },
    status: "reviewed",
    version_added: "1.0.0",
    ...p,
  };
}

const topics: SkillTopic[] = [
  { id: "plants", title: "Plants", weight: 0.5, subskills: ["s"] },
  { id: "animals", title: "Animals", weight: 0.3, subskills: ["s"] },
  { id: "rocks", title: "Rocks", weight: 0.2, subskills: ["s"] },
];

const items: SkillItem[] = [
  ...Array.from({ length: 12 }, (_, i) => item({ topic: topics[i % 3].id, difficulty: ((i % 3) + 1) as 1 | 2 | 3 })),
  ...Array.from({ length: 6 }, (_, i) => item({ topic: topics[i % 3].id, type: "short" })),
  // a three-part open question
  item({ id: "t-q20a", topic: "plants", type: "open", marks: 1, stem: "A seed was planted.\n\n(a) What does it need?" }),
  item({ id: "t-q20b", topic: "plants", type: "open", marks: 2, stem: "A seed was planted.\n\n(b) Why?" }),
  item({ id: "t-q20c", topic: "plants", type: "open", marks: 1, stem: "A seed was planted.\n\n(c) What next?" }),
  // a passage with three questions
  ...[1, 2, 3].map((k) => item({ topic: "animals", type: "short", passage: "A long story about a frog.", stem: `Story question ${k}?` })),
  // never printed
  item({ id: "t-draft", topic: "plants", status: "draft" }),
  item({ id: "t-retired", topic: "rocks", status: "retired" }),
  item({ id: "t-card", topic: "rocks", type: "card", answer: "back", options: undefined }),
];

const bank: PrintBank = {
  manifest: { id: "test-pack", title: "Test Science", subject: "science", level: "P3", language: "en", topics },
  items,
};

const ids = (p: Paper) => p.guide.map((g) => g.itemId);

function checkInvariants(p: Paper, source: PrintBank) {
  const byId = new Map(source.items.map((i) => [i.id, i]));
  // only reviewed items, never repeated
  expect(ids(p).every((id) => byId.get(id)?.status === "reviewed")).toBe(true);
  expect(ids(p).every((id) => byId.get(id)?.type !== "card")).toBe(true);
  expect(new Set(ids(p)).size).toBe(ids(p).length);
  // numbered 1..n without gaps, in print order
  const numbers = p.sections.flatMap((s) => s.groups.flatMap((g) => g.questions.map((q) => q.number)));
  expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  expect(p.questionCount).toBe(numbers.length);
  // marks add up: items → questions → sections → paper → guide
  for (const s of p.sections) {
    for (const g of s.groups) for (const q of g.questions) expect(q.marks).toBe(q.parts.reduce((t, x) => t + x.marks, 0));
    expect(s.marks).toBe(s.groups.reduce((t, g) => t + g.questions.reduce((u, q) => u + q.marks, 0), 0));
  }
  expect(p.totalMarks).toBe(p.sections.reduce((t, s) => t + s.marks, 0));
  expect(p.totalMarks).toBe(ids(p).reduce((t, id) => t + byId.get(id)!.marks, 0));
}

describe("blocks", () => {
  it("keeps passages, multi-part questions and word boxes together, and drops drafts, retired items and cards", () => {
    const blocks = buildBlocks(items);
    const flat = blocks.flatMap((b) => b.items.map((i) => i.id));
    expect(flat).not.toContain("t-draft");
    expect(flat).not.toContain("t-retired");
    expect(flat).not.toContain("t-card");
    const multi = blocks.find((b) => b.kind === "multipart")!;
    expect(multi.items.map((i) => i.id)).toEqual(["t-q20a", "t-q20b", "t-q20c"]);
    const passage = blocks.find((b) => b.kind === "passage")!;
    expect(passage.items).toHaveLength(3);
    expect(passage.divisible).toBe(true);
  });

  it("treats cloze passages with numbered blanks as all-or-nothing", () => {
    const cloze = buildBlocks([1, 2].map((k) => item({ topic: "plants", passage: "It (1) [was / were] and (2) [is / are].", stem: `Choose for (${k}).` })));
    expect(cloze[0].divisible).toBe(false);
  });

  it("joins a linked question to the one before it", () => {
    const linked = buildBlocks([item({ topic: "plants" }), item({ topic: "plants", stem: "Refer to the same set-up. What happens next?" })]);
    expect(linked).toHaveLength(1);
    expect(linked[0].kind).toBe("linked");
  });

  it("groups a word box shared by consecutive items", () => {
    const options = ["he", "him", "his", "they", "them", "we"];
    const box = buildBlocks([1, 2, 3].map((k) => item({ topic: "plants", options, answer: k, stem: `Blank ${k}` })));
    expect(box).toHaveLength(1);
    expect(box[0].kind).toBe("bank");
  });
});

describe("assemblePaper (no blueprint: sections by item type)", () => {
  it("is deterministic: the same seed gives the same paper", () => {
    const a = assemblePaper(bank, { seed: "abc123", length: "full" });
    const b = assemblePaper(bank, { seed: "abc123", length: "full" });
    expect(b).toEqual(a);
  });

  it("varies with the seed", () => {
    const papers = ["a", "b", "c", "d", "e"].map((seed) => ids(assemblePaper(bank, { seed, length: "short" })).join());
    expect(new Set(papers).size).toBeGreaterThan(1);
  });

  it("keeps the paper's invariants for both lengths and many seeds", () => {
    for (const length of ["short", "full"] as const)
      for (const seed of ["1", "2", "3", "x9", "zz"]) checkInvariants(assemblePaper(bank, { seed, length }), bank);
  });

  it("makes sections by item type, MCQ first", () => {
    const p = assemblePaper(bank, { seed: "s", length: "full" });
    expect(p.blueprint).toBeNull();
    expect(p.sections.map((s) => s.id)).toEqual(["mcq", "short", "open"]);
    expect(p.sections[0].groups.flatMap((g) => g.questions).every((q) => q.parts.every((x) => x.type === "mcq"))).toBe(true);
  });

  it("prints a multi-part question as one number with parts (a)–(c) and a shared lead", () => {
    const p = assemblePaper(bank, { seed: "s", length: "full" });
    const q = p.sections.flatMap((s) => s.groups.flatMap((g) => g.questions)).find((x) => x.parts.length === 3)!;
    expect(q.lead).toBe("A seed was planted.");
    expect(q.parts.map((x) => x.label)).toEqual(["a", "b", "c"]);
    expect(q.parts[0].text).toBe("(a) What does it need?");
    expect(q.marks).toBe(4);
    expect(p.guide.filter((g) => g.number === q.number).map((g) => g.label)).toEqual(["a", "b", "c"]);
  });

  it("prints a passage once, before its questions", () => {
    const p = assemblePaper(bank, { seed: "s", length: "full" });
    const group = p.sections.flatMap((s) => s.groups).find((g) => g.passage)!;
    expect(group.passage).toBe("A long story about a frog.");
    expect(group.questions.length).toBeGreaterThan(0);
  });

  it("aims for about ten questions in a short paper", () => {
    for (const seed of ["1", "2", "3"]) {
      const p = assemblePaper(bank, { seed, length: "short" });
      expect(p.questionCount).toBeGreaterThanOrEqual(SHORT_QUESTIONS - 1);
      expect(p.questionCount).toBeLessThanOrEqual(SHORT_QUESTIONS + 2);
    }
  });

  it("only uses the chosen topics", () => {
    const p = assemblePaper(bank, { seed: "s", length: "full", topics: ["rocks", "not-a-topic"] });
    expect(p.topics).toEqual(["rocks"]);
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(ids(p).length).toBeGreaterThan(0);
    expect(ids(p).every((id) => byId.get(id)!.topic === "rocks")).toBe(true);
  });

  it("balances topics roughly by their weights", () => {
    const p = assemblePaper(bank, { seed: "w", length: "short" });
    const byId = new Map(items.map((i) => [i.id, i]));
    const topicsUsed = new Set(ids(p).map((id) => byId.get(id)!.topic));
    expect(topicsUsed.size).toBe(3);
  });

  it("returns an answer guide with the MCQ option, working and marks", () => {
    const withWorking = { ...bank, items: bank.items.map((i) => (i.type === "mcq" ? { ...i, working: ["Because."] } : i)) };
    const p = assemblePaper(withWorking, { seed: "g", length: "short" });
    const mcq = p.guide.find((g) => g.type === "mcq")!;
    expect(mcq.answer).toBe("(1) one");
    expect(mcq.working).toEqual(["Because."]);
    expect(p.guide.reduce((t, g) => t + g.marks, 0)).toBe(p.totalMarks);
  });
});

describe("apportion", () => {
  it("shares a total by weight with largest remainders", () => {
    expect(apportion(10, [5, 4, 4, 5, 1, 5, 3, 3])).toEqual([2, 1, 1, 2, 0, 2, 1, 1]);
    expect(apportion(10, [0, 0])).toEqual([0, 0]);
  });
});

describe("params", () => {
  it("reads and writes the print page's URL", () => {
    const o = readPaperOptions({ seed: "K3X9Q2", length: "full", topics: "b.x,a.y,BAD TOPIC", guide: "only" }, { guide: "with" });
    expect(o).toEqual({ seed: "k3x9q2", length: "full", topics: ["a.y", "b.x"], guide: "only" });
    expect(paperHref("/papers/p3-science", { ...o, seed: "k3x9q2" })).toBe("/papers/p3-science?seed=k3x9q2&length=full&topics=a.y,b.x&guide=only");
    expect(readPaperOptions({ seed: "../etc", guide: "maybe" }, { guide: "none" })).toEqual({ seed: null, length: "short", topics: [], guide: "none" });
  });
});

// ─── The real packs in content/skills (loose bounds: the banks grow) ───────

describe("real packs", () => {
  const science = loadPrintBank("p3-science")!;
  const chinese = loadPrintBank("p3-chinese")!;

  it("loads published packs and refuses odd ids", () => {
    expect(science.manifest.level).toBe("P3");
    expect(loadPrintBank("../content")).toBeNull();
    expect(loadPrintBank("no-such-pack")).toBeNull();
  });

  it("P3 Science full follows the blueprint: Booklet A MCQs then open-ended, about 80 marks", () => {
    const p = assemblePaper(science, { seed: "demo", length: "full" });
    checkInvariants(p, science);
    expect(p.blueprint).not.toBeNull();
    expect(p.sections.map((s) => s.id)).toEqual(["a", "b"]);
    expect(p.sections[0].marks).toBe(48);
    expect(p.totalMarks).toBeGreaterThanOrEqual(76);
    expect(p.totalMarks).toBeLessThanOrEqual(84);
    expect(p.sections[1].newPage).toBe(true);
    expect(paperFigures(p).length).toBeGreaterThan(5);
  });

  it("P3 Chinese full is the whole Paper 2 (45 marks), with section instructions printed once", () => {
    const p = assemblePaper(chinese, { seed: "demo", length: "full" });
    checkInvariants(p, chinese);
    expect(p.totalMarks).toBe(45);
    expect(p.sections).toHaveLength(8);
    const first = p.sections[0].groups[0];
    expect(first.instruction).toMatch(/选出最适当的字/);
    expect(first.questions[0].parts[0].text).not.toMatch(/选出最适当的字/);
    const box = p.sections.find((s) => s.id === "dapei")!.groups[0];
    expect(box.bank).toHaveLength(6);
    expect(box.questions[0].parts[0].options).toBeUndefined();
  });

  it("short papers have about ten questions for every pack with enough items", () => {
    for (const id of ["p3-science", "p3-chinese", "p3-english", "p3-maths", "p6-science", "s2-science", "p6-english", "s2-english"]) {
      const b = loadPrintBank(id)!;
      for (const seed of ["a", "b"]) {
        const p = assemblePaper(b, { seed, length: "short" });
        checkInvariants(p, b);
        expect(p.questionCount, id).toBeGreaterThanOrEqual(9);
        expect(p.questionCount, id).toBeLessThanOrEqual(12);
      }
    }
  });

  it("P3 English full keeps cloze passages whole and has two comprehension passages", () => {
    const english = loadPrintBank("p3-english")!;
    const p = assemblePaper(english, { seed: "demo", length: "full" });
    checkInvariants(p, english);
    expect(p.sections.filter((s) => s.title === "Comprehension")).toHaveLength(2);
    for (const g of p.sections.find((s) => s.id === "cloze")!.groups) {
      const all = english.items.filter((i) => i.passage === g.passage);
      expect(g.questions).toHaveLength(all.length);
    }
  });

  it("P6 English full follows SEAB's nine Paper 2 components in order and keeps cloze and editing passages whole", () => {
    const english = loadPrintBank("p6-english")!;
    const p = assemblePaper(english, { seed: "demo", length: "full" });
    checkInvariants(p, english);
    expect(p.sections.map((s) => s.id)).toEqual(["grammar", "vocab", "vocab_cloze", "visual", "grammar_cloze", "editing", "comp_cloze", "synthesis", "comprehension"]);
    expect(p.sections.find((s) => s.id === "grammar_cloze")?.newPage).toBe(true);
    for (const id of ["vocab_cloze", "grammar_cloze", "editing", "comp_cloze"]) {
      for (const g of p.sections.find((s) => s.id === id)!.groups) expect(g.questions).toHaveLength(english.items.filter((i) => i.passage === g.passage).length);
    }
    expect(paperFigures(p)).toHaveLength(1);
  });

  it("Sec 2 English full is Editing then Paper 2's three sections, with the summary in Section C", () => {
    const english = loadPrintBank("s2-english")!;
    const p = assemblePaper(english, { seed: "demo", length: "full" });
    checkInvariants(p, english);
    expect(p.sections.map((s) => s.id)).toEqual(["editing", "visual", "narrative", "non_narrative"]);
    const summary = english.items.find((i) => i.subskill === "summary_writing")!;
    expect(p.sections.find((s) => s.id === "non_narrative")!.groups.flatMap((g) => g.questions.flatMap((q) => q.parts.map((x) => x.itemId)))).toContain(summary.id);
  });

  it("topic chips list only topics with printable items", () => {
    expect(printableTopics(chinese).map((t) => t.id)).not.toContain("words.catalogue");
  });

  it("inlines figures as data URIs with a size", () => {
    const p = assemblePaper(science, { seed: "demo", length: "full" });
    const figures = loadFigures("p3-science", paperFigures(p));
    const one = Object.values(figures)[0];
    expect(one.src).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(one.widthMm).toBeGreaterThan(50);
    expect(loadFigures("p3-science", ["../skill.json", "figures/../../x"])).toEqual({});
  });
});
