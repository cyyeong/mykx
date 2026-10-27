// Printable practice papers (PRD FR08: "a fixed printable set + a separate guide"). Picks a paper from one
// skill pack deterministically: the same pack, seed, length and topics always give the same paper.
// Only reviewed items are used (never drafts or retired ones); every item appears at most once; questions
// are numbered continuously; marks are totalled from the items (hard rule 5: nothing here is model-made).
// Pure, no I/O: lib/print/bank.ts reads the pack, the print page renders the result.
import type { ItemType, SkillItem, SkillManifest } from "../types.ts";
import {
  allOfType,
  blockDifficulty,
  blockMarks,
  blockQuestions,
  blockTopic,
  buildBlocks,
  type Block,
} from "./blocks.ts";
import { BLUEPRINTS, blueprintMarks, type Blueprint, type BlueprintSection, type SectionOrder } from "./blueprints.ts";
import { splitParagraphs } from "./markup.ts";

export type PaperLength = "short" | "full";

/** About ten questions, about twenty minutes. */
export const SHORT_QUESTIONS = 10;
/** A full paper for a pack without a blueprint: about 50 marks, a typical school paper. */
export const FALLBACK_FULL_MARKS = 50;
/** Minutes per mark when a pack has no blueprint. */
const FALLBACK_MINUTES_PER_MARK = 1.2;

export interface PaperRequest {
  seed: string;
  length: PaperLength;
  /** Topic ids to draw from; empty or missing means every topic. Unknown ids are ignored. */
  topics?: readonly string[];
}

export type PackInfo = Pick<SkillManifest, "id" | "title" | "subject" | "level" | "language" | "topics"> & {
  attributions?: string[];
};

export interface PrintBank {
  manifest: PackInfo;
  /** Every item in the pack, in pack order (files sorted by name, then array order). */
  items: readonly SkillItem[];
}

/** What to draw for the answer. Sizes are millimetres on A4. */
export type AnswerSpace =
  | { kind: "bracket" }
  | { kind: "line" }
  | { kind: "lines"; lines: number }
  | { kind: "working"; mm: number; answerLine: boolean }
  | { kind: "box"; mm: number };

export interface PaperPart {
  itemId: string;
  /** "a", "b"… for a multi-part question. */
  label?: string;
  type: ItemType;
  marks: number;
  /** The stem with any shared text (section instruction, question lead) taken out. */
  text: string;
  /** Pack-relative figure path, set the first time the figure appears in the question. */
  figure?: string;
  /** Paragraph index the figure goes before (equal to the paragraph count: after the text). */
  figureAt: number;
  /** Omitted when the group prints a word box instead. */
  options?: string[];
  unit?: string;
  space: AnswerSpace;
}

export interface PaperQuestion {
  number: number;
  marks: number;
  /** Shared opening of a multi-part question. */
  lead?: string;
  leadFigure?: string;
  parts: PaperPart[];
}

export interface PaperGroup {
  /** An instruction shared by every question in the group, printed once. */
  instruction?: string;
  /** Reading passage, printed once before its questions. */
  passage?: string;
  /** A figure shared by every question in the group (a visual-text poster). */
  figure?: string;
  /** A word box shared by every question in the group. */
  bank?: string[];
  questions: PaperQuestion[];
}

export interface PaperSection {
  id: string;
  title: string;
  note?: string;
  marks: number;
  /** Start on a new page (a new booklet in the real paper). */
  newPage: boolean;
  groups: PaperGroup[];
}

export interface GuideEntry {
  number: number;
  label?: string;
  itemId: string;
  type: ItemType;
  marks: number;
  /** MCQ: "(2) the option text". Otherwise the expected answer. */
  answer: string;
  accept: string[];
  working: string[];
  marking: string[];
  unit?: string;
}

export interface Paper {
  pack: string;
  title: string;
  subject: SkillManifest["subject"];
  level: SkillManifest["level"];
  language: string;
  seed: string;
  length: PaperLength;
  /** Topic ids actually applied (empty: every topic). */
  topics: string[];
  /** The paper's name ("Paper 2 · Language Use and Comprehension"), or a generic one. */
  name: string;
  /** Reference the sections follow, or null when sections are by item type. */
  blueprint: string | null;
  minutes: number;
  totalMarks: number;
  questionCount: number;
  /** What a paper of this length aims for: the real paper's marks (full) or ten questions (short). */
  target: { marks: number | null; questions: number | null };
  sections: PaperSection[];
  guide: GuideEntry[];
  /** Credits for bundled artwork, printed when the paper has figures. */
  attributions: string[];
}

// ─── Seeded randomness ─────────────────────────────────────────────────────

/** FNV-1a, 32-bit. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast and good enough to shuffle a question bank. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Largest-remainder rounding of `total` across `weights`. */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((s, n) => s + n, 0);
  const order = raw.map((r, i) => ({ i, r: r - Math.floor(r) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

// ─── Sections ──────────────────────────────────────────────────────────────

interface SectionPlan {
  section: Omit<BlueprintSection, "accepts">;
  pool: Block[];
}

const TYPE_SECTIONS: Omit<BlueprintSection, "marks" | "count">[] = [
  {
    id: "mcq",
    title: "Multiple-choice questions",
    note: "Write the number of the correct option in the brackets.",
    order: "topic",
    accepts: (b) => allOfType(b, "mcq"),
  },
  {
    id: "short",
    title: "Short-answer questions",
    note: "Write your answers in the spaces provided.",
    order: "topic",
    accepts: (b) => b.kind !== "multipart" && allOfType(b, "mcq", "short"),
  },
  {
    id: "open",
    title: "Open-ended questions",
    note: "Write your answers in the spaces provided. The marks for each question or part are shown in brackets [ ].",
    order: "topic",
    newPage: true,
    accepts: () => true,
  },
];

function planSections(blocks: Block[], blueprint: Blueprint | undefined): SectionPlan[] {
  const defs: BlueprintSection[] = blueprint?.sections ?? TYPE_SECTIONS.map((s) => ({ ...s, marks: 0, count: 0 }));
  const plans: SectionPlan[] = defs.map((d) => ({
    section: { id: d.id, title: d.title, note: d.note, marks: d.marks, count: d.count, order: d.order, newPage: d.newPage },
    pool: [],
  }));
  // A section that draws from another's pool shares the very same array, so a block is only ever used once.
  defs.forEach((d, i) => {
    const owner = d.samePoolAs ? plans.find((p) => p.section.id === d.samePoolAs) : undefined;
    if (owner) plans[i].pool = owner.pool;
  });
  for (const block of blocks) {
    const at = defs.findIndex((d) => !d.samePoolAs && d.accepts(block));
    if (at >= 0) plans[at].pool.push(block);
  }
  if (!blueprint) {
    // No real paper to copy: share the full-paper marks by what the bank holds.
    const marks = apportion(
      FALLBACK_FULL_MARKS,
      plans.map((p) => p.pool.reduce((s, b) => s + blockMarks(b), 0)),
    );
    plans.forEach((p, i) => {
      p.section.marks = marks[i];
      p.section.count = p.pool.reduce((s, b) => s + blockQuestions(b), 0);
    });
  }
  return plans;
}

// ─── Filling a section ─────────────────────────────────────────────────────

interface Balance {
  /** Paper-wide goal in the measure (marks for full, questions for short). */
  goal: number;
  topicShare: Map<string, number>;
  diffShare: Map<number, number>;
  topic: Map<string, number>;
  diff: Map<number, number>;
  total: number;
}

type Measure = (b: Pick<Block, "items" | "kind">) => number;

/** A block's items in a seeded order, used to trim divisible blocks the same way every time. */
type Candidate = { block: Block; trimOrder: SkillItem[] };

/** The block as it fits `room`: whole, trimmed (divisible blocks), slightly over (atomic), or not at all. */
function fit(c: Candidate, room: number, measure: Measure): Block | null {
  const size = measure(c.block);
  if (size <= room) return c.block;
  if (c.block.divisible) {
    const passageLength = c.block.items[0].passage?.length ?? 0;
    const min = Math.min(c.block.items.length, passageLength > 500 ? 2 : 1);
    const kept: SkillItem[] = [];
    let used = 0;
    for (const item of c.trimOrder) {
      const add = measure({ items: [item], kind: "single" });
      if (used + add <= room) {
        kept.push(item);
        used += add;
      }
    }
    if (kept.length >= min && kept.length > 0) {
      const order = new Map(c.block.items.map((item, i) => [item.id, i]));
      return { ...c.block, items: kept.sort((a, b) => order.get(a.id)! - order.get(b.id)!) };
    }
  }
  // Atomic and too big: take it only if that lands closer to the goal than stopping short.
  return size - room < room ? c.block : null;
}

function score(block: Block, b: Balance): number {
  const topic = blockTopic(block);
  const topicNeed = ((b.topicShare.get(topic) ?? 0) * b.goal - (b.topic.get(topic) ?? 0)) / Math.max(1, b.goal);
  const d = blockDifficulty(block);
  const diffNeed = (b.diffShare.get(d) ?? 0) - (b.total ? (b.diff.get(d) ?? 0) / b.total : 0);
  return topicNeed + 0.5 * diffNeed;
}

function take(block: Block, b: Balance, measure: Measure) {
  const size = measure(block);
  const topic = blockTopic(block);
  const d = blockDifficulty(block);
  b.topic.set(topic, (b.topic.get(topic) ?? 0) + size);
  b.diff.set(d, (b.diff.get(d) ?? 0) + size);
  b.total += size;
}

/** Adds blocks from `pool` until `goal` is met; returns what it took and removes it from the pool. */
function fill(pool: Candidate[], goal: number, measure: Measure, balance: Balance, once = false): Block[] {
  const picked: Block[] = [];
  let sum = 0;
  while (sum < goal && pool.length) {
    let best: { at: number; block: Block; score: number } | null = null;
    for (let at = 0; at < pool.length; at++) {
      const block = fit(pool[at], goal - sum, measure);
      if (!block) continue;
      const s = score(block, balance);
      if (!best || s > best.score + 1e-9) best = { at, block, score: s };
    }
    if (!best) break;
    pool.splice(best.at, 1);
    picked.push(best.block);
    sum += measure(best.block);
    take(best.block, balance, measure);
    if (once) break;
  }
  return picked;
}

function orderBlocks(blocks: Block[], order: SectionOrder, topicIndex: Map<string, number>): Block[] {
  const avg = (b: Block) => b.items.reduce((s, i) => s + i.difficulty, 0) / b.items.length;
  return [...blocks].sort((a, b) => {
    if (order === "topic") {
      const t = (topicIndex.get(blockTopic(a)) ?? 99) - (topicIndex.get(blockTopic(b)) ?? 99);
      if (t) return t;
      const d = avg(a) - avg(b);
      if (d) return d;
    } else if (order === "difficulty") {
      const d = avg(a) - avg(b) || blockMarks(a) - blockMarks(b);
      if (d) return d;
    }
    return a.source - b.source;
  });
}

// ─── Layout of questions ───────────────────────────────────────────────────

const PART_LABEL = /^\(([a-h])\)\s*/;
const DRAW = /\bdraw\b|画出|画一/i;

function answerSpace(item: SkillItem, subject: Paper["subject"]): AnswerSpace {
  if (item.type === "mcq") return { kind: "bracket" };
  if (DRAW.test(item.stem)) return { kind: "box", mm: Math.min(80, 30 + item.marks * 15) };
  if (subject === "maths") return { kind: "working", mm: Math.min(70, Math.max(22, 10 + item.marks * 14)), answerLine: item.type === "short" };
  if (item.type === "short") return item.marks >= 2 ? { kind: "lines", lines: 2 } : { kind: "line" };
  // A sentence to rewrite or a comprehension answer needs a line or two; a science explanation needs room.
  if (subject === "chinese" || subject === "english") return { kind: "lines", lines: Math.min(6, Math.max(2, item.marks + (item.marks > 2 ? 1 : 0))) };
  return { kind: "lines", lines: Math.min(8, Math.max(2, item.marks * 2)) };
}

/** Where a figure sits: before the question line when there is context above it, else after the text. */
function figureIndex(paragraphs: string[], multipart: boolean): number {
  if (multipart) {
    const labelled = paragraphs.findIndex((p) => PART_LABEL.test(p));
    if (labelled > 0) return labelled;
  }
  return paragraphs.length >= 2 ? paragraphs.length - 1 : paragraphs.length;
}

function makePart(item: SkillItem, text: string, subject: Paper["subject"], opts: { figure?: string; label?: string; multipart?: boolean; bank?: boolean }): PaperPart {
  const paragraphs = splitParagraphs(text);
  return {
    itemId: item.id,
    label: opts.label,
    type: item.type,
    marks: item.marks,
    text: paragraphs.join("\n\n"),
    figure: opts.figure,
    figureAt: figureIndex(paragraphs, !!opts.multipart),
    options: opts.bank ? undefined : item.options,
    unit: item.unit,
    space: answerSpace(item, subject),
  };
}

function multipartQuestion(block: Block, number: number, subject: Paper["subject"]): PaperQuestion {
  const paras = block.items.map((i) => splitParagraphs(i.stem));
  let k = 0;
  while (paras.every((p) => p.length > k + 1 && p[k] === paras[0][k])) k++;
  const figures = block.items.map((i) => i.figure);
  const shared = figures.every((f) => f && f === figures[0]) ? figures[0] : undefined;
  const shown = new Set(shared ? [shared] : []);
  let previous: string[] = [];
  const parts = block.items.map((item, i) => {
    const rest = paras[i].slice(k);
    // Context a part repeats from the part before it ("Marcus classified some animals as shown.") prints once.
    let j = 0;
    while (j < rest.length - 1 && j < previous.length && rest[j] === previous[j] && !PART_LABEL.test(rest[j])) j++;
    previous = rest;
    const own = rest.slice(j);
    const labelled = own.find((p) => PART_LABEL.test(p));
    const label = labelled ? PART_LABEL.exec(labelled)![1] : String.fromCharCode(97 + i);
    const text = labelled ? own.join("\n\n") : `(${label}) ${own.join("\n\n")}`;
    const figure = item.figure && !shown.has(item.figure) ? item.figure : undefined;
    if (figure) shown.add(figure);
    return makePart(item, text, subject, { figure, label, multipart: true });
  });
  return {
    number,
    marks: blockMarks(block),
    lead: k ? paras[0].slice(0, k).join("\n\n") : undefined,
    leadFigure: shared,
    parts,
  };
}

/** The first paragraph, when every stem in `items` opens with the same one and has more after it. */
function sharedOpening(items: SkillItem[], min = 2): string | undefined {
  if (items.length < min) return undefined;
  const firsts = items.map((i) => splitParagraphs(i.stem));
  if (!firsts.every((p) => p.length >= 2 && p[0] === firsts[0][0])) return undefined;
  return firsts[0][0];
}

const withoutOpening = (stem: string, opening?: string) => (opening ? splitParagraphs(stem).slice(1).join("\n\n") : stem);

function sharedBank(items: SkillItem[]): string[] | undefined {
  const first = items[0].options;
  if (!first || first.length < 5 || !items.every((i) => i.type === "mcq" && i.options?.join("\u0000") === first.join("\u0000"))) return undefined;
  return first;
}

/** Turns a section's ordered blocks into groups of numbered questions. */
function layoutSection(blocks: Block[], next: () => number, subject: Paper["subject"]): PaperGroup[] {
  const groups: PaperGroup[] = [];
  let run: Block[] = [];
  // Consecutive questions that open with the same instruction ("Choose the correct word…") share it.
  // Only short, instruction-like openings: a table or a long scenario stays with its own question.
  const opening = (b: Block): string | undefined => {
    const first = b.kind === "multipart" ? undefined : sharedOpening(b.items, 1);
    return first && first.length <= 160 && !first.includes("|") ? first : undefined;
  };
  const flushRun = () => {
    let i = 0;
    while (i < run.length) {
      const first = opening(run[i]);
      let j = i + 1;
      while (first && j < run.length && opening(run[j]) === first) j++;
      const slice = run.slice(i, j);
      const instruction = first && slice.reduce((s, b) => s + b.items.length, 0) > 1 ? first : undefined;
      const questions: PaperQuestion[] = [];
      for (const block of slice) {
        if (block.kind === "multipart") questions.push(multipartQuestion(block, next(), subject));
        else
          for (const item of block.items)
            questions.push({
              number: next(),
              marks: item.marks,
              parts: [makePart(item, withoutOpening(item.stem, instruction), subject, { figure: item.figure })],
            });
      }
      groups.push({ instruction, questions });
      i = j;
    }
    run = [];
  };
  for (const block of blocks) {
    if (block.kind !== "passage" && block.kind !== "bank") {
      run.push(block);
      continue;
    }
    flushRun();
    const items = block.items;
    const instruction = sharedOpening(items);
    const bank = sharedBank(items);
    const figures = items.map((i) => i.figure);
    const figure = figures.every((f) => f && f === figures[0]) ? figures[0] : undefined;
    // A poster's text is drawn in its figure; print the passage only when there is no poster.
    const posterOnly = !!figure && items.every((i) => /visual/.test(i.topic));
    groups.push({
      instruction,
      passage: posterOnly ? undefined : items[0].passage,
      figure,
      bank,
      questions: items.map((item) => ({
        number: next(),
        marks: item.marks,
        parts: [
          makePart(item, withoutOpening(item.stem, instruction), subject, {
            figure: figure ? undefined : item.figure,
            bank: !!bank,
          }),
        ],
      })),
    });
  }
  flushRun();
  return groups;
}

// ─── Guide ─────────────────────────────────────────────────────────────────

function guideEntries(sections: PaperSection[], items: Map<string, SkillItem>): GuideEntry[] {
  const out: GuideEntry[] = [];
  for (const section of sections)
    for (const group of section.groups)
      for (const q of group.questions)
        for (const part of q.parts) {
          const item = items.get(part.itemId)!;
          const answer =
            item.type === "mcq" && typeof item.answer === "number"
              ? `(${item.answer}) ${item.options?.[item.answer - 1] ?? ""}`.trim()
              : String(item.answer);
          out.push({
            number: q.number,
            label: q.parts.length > 1 || part.label ? part.label : undefined,
            itemId: item.id,
            type: item.type,
            marks: item.marks,
            answer,
            accept: item.accept ?? [],
            working: item.working ?? [],
            marking: item.marking ?? [],
            unit: item.unit,
          });
        }
  return out;
}

// ─── The paper ─────────────────────────────────────────────────────────────

const roundTo5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);

export function assemblePaper(bank: PrintBank, request: PaperRequest): Paper {
  const { manifest } = bank;
  const known = new Set(manifest.topics.map((t) => t.id));
  const topics = [...new Set((request.topics ?? []).filter((t) => known.has(t)))].sort();
  const chosen = topics.length ? new Set(topics) : null;
  const blueprint = BLUEPRINTS[manifest.id];
  const rand = seededRandom(hashString([manifest.id, request.length, topics.join(","), request.seed].join("|")));

  // Blocks, cut to the chosen topics.
  const blocks = buildBlocks(bank.items).flatMap((b): Block[] => {
    if (!chosen) return [b];
    if (b.divisible) {
      const items = b.items.filter((i) => chosen.has(i.topic));
      return items.length ? [{ ...b, items }] : [];
    }
    return b.items.some((i) => chosen.has(i.topic)) ? [b] : [];
  });

  const full = request.length === "full";
  const measure: Measure = full ? blockMarks : blockQuestions;
  const plans = planSections(blocks, blueprint);
  const live = plans.filter((p) => p.pool.length);

  // Goals per section: the real paper's marks (full), or a share of ten questions (short).
  const goals = full
    ? live.map((p) => p.section.marks)
    : apportion(
        SHORT_QUESTIONS,
        live.map((p) => p.section.count || p.pool.reduce((s, b) => s + blockQuestions(b), 0)),
      );
  const paperGoal = Math.max(1, goals.reduce((s, g) => s + g, 0));

  // Balance targets: topic shares from the manifest weights, difficulty shares from the bank.
  const pool = [...new Set(live.map((p) => p.pool))].flat();
  const weightOf = new Map(manifest.topics.map((t) => [t.id, Math.max(t.weight, 0.02)]));
  const present = [...new Set(pool.map(blockTopic))];
  const weightSum = present.reduce((s, t) => s + (weightOf.get(t) ?? 0.02), 0);
  const diffTotals = new Map<number, number>();
  for (const b of pool) diffTotals.set(blockDifficulty(b), (diffTotals.get(blockDifficulty(b)) ?? 0) + measure(b));
  const poolSize = [...diffTotals.values()].reduce((s, n) => s + n, 0) || 1;
  const balance: Balance = {
    goal: paperGoal,
    topicShare: new Map(present.map((t) => [t, (weightOf.get(t) ?? 0.02) / weightSum])),
    diffShare: new Map([...diffTotals].map(([d, n]) => [d, n / poolSize])),
    topic: new Map(),
    diff: new Map(),
    total: 0,
  };

  // One candidate list per pool (sections that share a pool share the list).
  const lists = new Map<Block[], Candidate[]>();
  const candidates = live.map((p) => {
    let list = lists.get(p.pool);
    if (!list) {
      list = shuffle(p.pool, rand).map((block) => ({ block, trimOrder: shuffle(block.items, rand) }));
      lists.set(p.pool, list);
    }
    return list;
  });
  const picked = live.map((_, i) => fill(candidates[i], goals[i], measure, balance));

  // Short papers: if a section could not use its share (a passage too long, too few items), top up elsewhere.
  if (!full) {
    let count = picked.flat().reduce((s, b) => s + measure(b), 0);
    let added = true;
    while (count < SHORT_QUESTIONS && added) {
      added = false;
      for (let i = 0; i < live.length && count < SHORT_QUESTIONS; i++) {
        const more = fill(candidates[i], SHORT_QUESTIONS - count, measure, balance, true);
        if (more.length) {
          picked[i].push(...more);
          count += more.reduce((s, b) => s + measure(b), 0);
          added = true;
        }
      }
    }
  }

  // Order, number and lay out.
  const topicIndex = new Map(manifest.topics.map((t, i) => [t.id, i]));
  let number = 0;
  const next = () => ++number;
  const sections: PaperSection[] = [];
  live.forEach((plan, i) => {
    if (!picked[i].length) return;
    const ordered = orderBlocks(picked[i], plan.section.order, topicIndex);
    sections.push({
      id: plan.section.id,
      title: plan.section.title,
      note: plan.section.note,
      marks: ordered.reduce((s, b) => s + blockMarks(b), 0),
      newPage: full && !!plan.section.newPage && sections.length > 0,
      groups: layoutSection(ordered, next, manifest.subject),
    });
  });

  const itemsById = new Map(bank.items.map((i) => [i.id, i]));
  const guide = guideEntries(sections, itemsById);
  const totalMarks = guide.reduce((s, g) => s + g.marks, 0);
  const realMarks = blueprint ? blueprintMarks(blueprint) : null;
  const minutesPerMark = blueprint ? blueprint.minutes / blueprintMarks(blueprint) : FALLBACK_MINUTES_PER_MARK;
  const hasFigures = sections.some((s) =>
    s.groups.some((g) => g.figure || g.questions.some((q) => q.leadFigure || q.parts.some((p) => p.figure))),
  );

  return {
    pack: manifest.id,
    title: manifest.title,
    subject: manifest.subject,
    level: manifest.level,
    language: manifest.language,
    seed: request.seed,
    length: request.length,
    topics,
    name: full ? (blueprint?.name ?? "Practice paper") : "Short practice paper",
    blueprint: blueprint?.reference ?? null,
    minutes: totalMarks ? roundTo5(totalMarks * minutesPerMark) : 0,
    totalMarks,
    questionCount: number,
    target: full ? { marks: realMarks ?? FALLBACK_FULL_MARKS, questions: null } : { marks: null, questions: SHORT_QUESTIONS },
    sections,
    guide,
    attributions: hasFigures ? (manifest.attributions ?? []) : [],
  };
}

/** Every figure path the paper prints. */
export function paperFigures(paper: Paper): string[] {
  const out = new Set<string>();
  for (const s of paper.sections)
    for (const g of s.groups) {
      if (g.figure) out.add(g.figure);
      for (const q of g.questions) {
        if (q.leadFigure) out.add(q.leadFigure);
        for (const p of q.parts) if (p.figure) out.add(p.figure);
      }
    }
  return [...out];
}

/** Topics that have at least one printable item, in manifest order, with how many. */
export function printableTopics(bank: PrintBank): { id: string; title: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const block of buildBlocks(bank.items)) for (const item of block.items) counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
  return bank.manifest.topics.filter((t) => counts.has(t.id)).map((t) => ({ id: t.id, title: t.title, count: counts.get(t.id)! }));
}

export type { Blueprint, BlueprintSection } from "./blueprints.ts";
export type { Block } from "./blocks.ts";
