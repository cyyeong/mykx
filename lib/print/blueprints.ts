// Exam blueprints for printable papers: the section order, marks and question counts of the real paper,
// transcribed from each pack's reference notes (cited per blueprint). The manifest has no structured
// blueprint field yet, so they live here. A pack without one gets sections by item type (paper.ts).
// Section `accepts` runs on whole blocks; each block goes to the first section that accepts it.
import { allOfType, blockMarks, inTopic, someOfType, type Block } from "./blocks.ts";

export type SectionOrder = "source" | "topic" | "difficulty";

export interface BlueprintSection {
  id: string;
  /** Printed after the section label ("Section A", "第一部分"). */
  title: string;
  /** One line of instructions under the heading. */
  note?: string;
  /** Marks and numbered questions in the real paper. */
  marks: number;
  count: number;
  /** How questions are ordered inside the section. */
  order: SectionOrder;
  /** Start on a new page in a full paper (a new booklet or paper). */
  newPage?: boolean;
  /** Which blocks belong here. */
  accepts: (block: Block) => boolean;
  /** Draw from another section's pool instead (a second comprehension passage, Paper 2's short answers). */
  samePoolAs?: string;
}

export interface Blueprint {
  /** e.g. "Paper 2 · Language Use and Comprehension". */
  name: string;
  /** Time allowed for the real paper, in minutes. */
  minutes: number;
  /** The pack reference this mirrors. */
  reference: string;
  sections: BlueprintSection[];
}

const mcqOnly = (b: Block) => allOfType(b, "mcq");
const notMcq = (b: Block) => !allOfType(b, "mcq");
const single = (b: Block) => b.kind === "single" || b.kind === "linked" || b.kind === "bank";
/** An editing passage: spelling and punctuation mistakes marked in the text. */
const isEditing = (b: Block) => b.kind === "passage" && b.items.some((i) => i.topic === "language.spelling" || i.subskill === "punctuation");

const SCIENCE_MCQ_NOTE = "For each question, four options are given. Write the number of the correct option (1, 2, 3 or 4) in the brackets.";
const SCIENCE_OEQ_NOTE = "Write your answers in the spaces provided. The marks for each question or part are shown in brackets [ ].";

export const BLUEPRINTS: Record<string, Blueprint> = {
  "p3-science": {
    name: "End-of-year practice · Booklets A and B",
    minutes: 90,
    reference: "references/syllabus-map.md#Exam format",
    sections: [
      { id: "a", title: "Multiple-choice questions", note: SCIENCE_MCQ_NOTE, marks: 48, count: 24, order: "topic", accepts: mcqOnly },
      { id: "b", title: "Open-ended questions", note: SCIENCE_OEQ_NOTE, marks: 32, count: 10, order: "topic", newPage: true, accepts: notMcq },
    ],
  },
  "p6-science": {
    name: "PSLE-style practice · Booklets A and B",
    minutes: 105,
    reference: "references/syllabus.md#Exam day and format (SEAB)",
    sections: [
      { id: "a", title: "Multiple-choice questions", note: SCIENCE_MCQ_NOTE, marks: 60, count: 30, order: "topic", accepts: mcqOnly },
      { id: "b", title: "Open-ended questions", note: SCIENCE_OEQ_NOTE, marks: 40, count: 11, order: "topic", newPage: true, accepts: notMcq },
    ],
  },
  "s2-science": {
    name: "End-of-year practice",
    minutes: 120,
    reference: "references/exam-blueprint.md#The paper",
    sections: [
      { id: "mcq", title: "Multiple-choice questions", note: "Each question has four options. Write the number of the correct option in the brackets.", marks: 30, count: 30, order: "topic", accepts: mcqOnly },
      {
        id: "structured",
        title: "Structured questions",
        note: "Answer all questions in the spaces provided.",
        marks: 40,
        count: 7,
        order: "difficulty",
        newPage: true,
        accepts: (b) => notMcq(b) && blockMarks(b) <= 7,
      },
      { id: "free", title: "Free-response questions", note: "Answer all questions. Show your working for calculations.", marks: 30, count: 3, order: "difficulty", newPage: true, accepts: notMcq },
    ],
  },
  "s2-maths": {
    // Sec 2 papers are school-set; this is the common two-paper pattern modelled on the national G3 paper (K310).
    name: "End-of-year practice · Papers 1 and 2",
    minutes: 150,
    reference: "references/exam-blueprint.md#The paper",
    sections: [
      {
        id: "p1",
        title: "Paper 1 · Short questions",
        note: "Answer all questions. A calculator may be used. Show your working: omitting essential working will lose marks.",
        marks: 50,
        count: 20,
        order: "difficulty",
        accepts: (b) => b.kind === "single" && blockMarks(b) <= 2,
      },
      {
        id: "p2",
        title: "Paper 2 · Structured questions",
        note: "Answer all questions. Give non-exact answers correct to 3 significant figures, and angles to 1 decimal place.",
        marks: 50,
        count: 8,
        order: "difficulty",
        newPage: true,
        accepts: () => true,
      },
    ],
  },
  "p3-maths": {
    name: "End-of-year practice",
    minutes: 90,
    reference: "references/exam-blueprint.md#1. Paper format",
    sections: [
      { id: "a", title: "Multiple-choice questions", note: "Write the number of the correct option (1, 2, 3 or 4) in the brackets.", marks: 16, count: 10, order: "difficulty", accepts: mcqOnly },
      {
        id: "b",
        title: "Short-answer questions",
        note: "Write your answers in the spaces provided. Show your working where it helps.",
        marks: 17,
        count: 12,
        order: "difficulty",
        accepts: (b) => notMcq(b) && b.kind !== "multipart" && blockMarks(b) <= 2,
      },
      { id: "c", title: "Problem sums", note: "Show your working clearly in the space below each question. Write your answers in the spaces provided.", marks: 17, count: 5, order: "difficulty", accepts: notMcq },
    ],
  },
  "p6-maths": {
    name: "PSLE-style practice · Papers 1 and 2",
    minutes: 150,
    reference: "references/exam-format.md#Format",
    sections: [
      { id: "p1a", title: "Paper 1 · Multiple-choice questions", note: "No calculator. Write the number of the correct option (1, 2, 3 or 4) in the brackets.", marks: 26, count: 18, order: "difficulty", accepts: mcqOnly },
      {
        id: "p1b",
        title: "Paper 1 · Short-answer questions",
        note: "No calculator. Write your answers in the spaces provided. Show your working.",
        marks: 24,
        count: 12,
        order: "difficulty",
        accepts: (b) => notMcq(b) && b.kind !== "multipart" && blockMarks(b) <= 2,
      },
      {
        id: "p2s",
        title: "Paper 2 · Short-answer questions",
        note: "You may use a calculator. Show your working.",
        marks: 10,
        count: 5,
        order: "difficulty",
        newPage: true,
        samePoolAs: "p1b",
        accepts: () => false,
      },
      { id: "p2l", title: "Paper 2 · Structured questions", note: "You may use a calculator. Show your working clearly; marks are given for method.", marks: 40, count: 10, order: "difficulty", accepts: notMcq },
    ],
  },
  "p3-english": {
    name: "Paper 2 · Language Use and Comprehension",
    minutes: 75,
    reference: "references/exam-blueprint.md#Paper 2 at a glance",
    sections: [
      {
        id: "grammar",
        title: "Grammar",
        note: "Choose the correct answer and write its number (1, 2, 3 or 4) in the brackets.",
        marks: 8,
        count: 8,
        order: "source",
        accepts: (b) => single(b) && mcqOnly(b) && inTopic(b, "language.grammar"),
      },
      {
        id: "vocab",
        title: "Vocabulary",
        note: "Choose the correct answer and write its number (1, 2, 3 or 4) in the brackets.",
        marks: 5,
        count: 5,
        order: "source",
        accepts: (b) => single(b) && mcqOnly(b) && inTopic(b, "language.vocab"),
      },
      {
        id: "visual",
        title: "Visual text",
        note: "Study the poster, then answer the questions. Write the number of the correct option in the brackets.",
        marks: 4,
        count: 4,
        order: "source",
        accepts: (b) => b.kind === "passage" && inTopic(b, "reading.visual"),
      },
      {
        id: "cloze",
        title: "Grammar cloze",
        note: "Read the passage, then answer the questions about the numbered blanks.",
        marks: 8,
        count: 8,
        order: "source",
        accepts: (b) => b.kind === "passage" && inTopic(b, "language.grammar") && !isEditing(b),
      },
      {
        id: "editing",
        title: "Editing",
        note: "The passage has some mistakes. Answer the questions about them.",
        marks: 5,
        count: 5,
        order: "source",
        accepts: isEditing,
      },
      {
        id: "synthesis",
        title: "Synthesis and word order",
        marks: 4,
        count: 3,
        order: "source",
        accepts: (b) => inTopic(b, "language.sentence"),
      },
      {
        id: "comp1",
        title: "Comprehension",
        note: "Read the passage, then answer the questions.",
        marks: 8,
        count: 8,
        order: "source",
        newPage: true,
        accepts: (b) => b.kind === "passage" && inTopic(b, "reading.comprehension"),
      },
      {
        id: "comp2",
        title: "Comprehension",
        note: "Read the passage, then answer the questions.",
        marks: 8,
        count: 8,
        order: "source",
        samePoolAs: "comp1",
        accepts: () => false,
      },
    ],
  },
  "p3-chinese": {
    name: "试卷二 · 语文应用与阅读理解 (Paper 2)",
    minutes: 60,
    reference: "references/exam-blueprint.md#The 100 marks",
    sections: [
      { id: "bianzi", title: "辨字测验", marks: 5, count: 5, order: "source", accepts: (b) => inTopic(b, "paper2.bianzi") },
      { id: "ciyu", title: "词语选择", marks: 4, count: 4, order: "source", accepts: (b) => inTopic(b, "paper2.ciyu") },
      { id: "kantu", title: "看图选词", marks: 4, count: 4, order: "source", accepts: (b) => inTopic(b, "paper2.kantu") },
      { id: "dapei", title: "词语搭配", marks: 5, count: 5, order: "source", accepts: (b) => inTopic(b, "paper2.dapei") },
      { id: "zuju", title: "组句成段", marks: 5, count: 1, order: "source", accepts: (b) => inTopic(b, "paper2.zuju") },
      { id: "juzi", title: "完成句子", marks: 10, count: 5, order: "source", accepts: (b) => inTopic(b, "paper2.juzi") },
      { id: "yuedu1", title: "阅读理解一", marks: 6, count: 3, order: "source", newPage: true, accepts: (b) => inTopic(b, "paper2.yuedu") && mcqOnly(b) },
      { id: "yuedu2", title: "阅读理解二", marks: 6, count: 3, order: "source", accepts: (b) => inTopic(b, "paper2.yuedu") && someOfType(b, "open", "short") },
    ],
  },
  "p6-chinese": {
    name: "试卷二 · 语文应用与阅读理解 (PSLE Paper 2)",
    minutes: 100,
    reference: "references/exam-blueprint.md#Paper 2 at a glance: 90 marks, 1 h 40 min",
    sections: [
      { id: "yuwen", title: "语文应用", marks: 30, count: 15, order: "source", accepts: (b) => inTopic(b, "paper2.yuwen") },
      { id: "tiankong", title: "短文填空", marks: 10, count: 5, order: "source", accepts: (b) => inTopic(b, "paper2.tiankong") },
      { id: "yuedu1", title: "阅读理解一", marks: 10, count: 5, order: "source", newPage: true, accepts: (b) => inTopic(b, "paper2.yuedu1") },
      { id: "duihua", title: "完成对话", marks: 8, count: 4, order: "source", accepts: (b) => inTopic(b, "paper2.duihua") },
      { id: "yuedu2", title: "阅读理解二", marks: 32, count: 11, order: "source", newPage: true, accepts: (b) => inTopic(b, "paper2.yuedu2") },
    ],
  },
  "s2-chinese": {
    name: "试卷二 · 语文应用与阅读理解 (G3 Paper 2)",
    minutes: 90,
    reference: "references/exam-blueprint.md#Paper 2 at a glance: 70 marks, 1 h 30 min",
    sections: [
      { id: "zonghe", title: "语文应用 · 综合填空", marks: 5, count: 5, order: "source", accepts: (b) => inTopic(b, "paper2.zonghe") },
      { id: "tihuan", title: "语文应用 · 词语替换", marks: 10, count: 5, order: "source", accepts: (b) => inTopic(b, "paper2.tihuan") },
      { id: "yuedu1", title: "阅读理解一", marks: 20, count: 10, order: "source", newPage: true, accepts: (b) => inTopic(b, "paper2.yuedu1") },
      { id: "yuedu2", title: "阅读理解二", marks: 35, count: 10, order: "source", newPage: true, accepts: (b) => inTopic(b, "paper2.yuedu2") },
    ],
  },
};

export const blueprintMarks = (b: Blueprint) => b.sections.reduce((s, x) => s + x.marks, 0);
export const blueprintQuestions = (b: Blueprint) => b.sections.reduce((s, x) => s + x.count, 0);
