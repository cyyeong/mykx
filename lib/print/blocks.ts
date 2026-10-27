// Selection units for printable papers. Items that only make sense together stay together:
// - passage: items that share a reading passage or poster (cloze, editing, visual text, comprehension);
// - multipart: "(a)", "(b)", "(c)" parts of one question (ids ending in a part letter, e.g. "…-b1a", "…-b1b");
// - linked: an item that says "Refer to the same set-up" goes with the one before it;
// - bank: consecutive multiple-choice items that share one word box of five or more options.
// Pure, no I/O.
import type { ItemType, SkillItem } from "../types.ts";

export type BlockKind = "single" | "multipart" | "passage" | "bank" | "linked";

export interface Block {
  /** The first item's id. */
  key: string;
  kind: BlockKind;
  /** In pack order. */
  items: SkillItem[];
  /**
   * Whether a paper may take only some of the items: comprehension and visual-text questions stand alone,
   * and a word box still works with fewer blanks. Cloze and editing passages (numbered blanks) and
   * multi-part or linked questions are all-or-nothing.
   */
  divisible: boolean;
  /** Position of the first item in the pack, for "pack order". */
  source: number;
}

/** Only reviewed items are printed (never drafts or retired ones), and never flashcards. */
export function isPrintable(item: SkillItem): boolean {
  return item.status === "reviewed" && item.type !== "card";
}

const PART_ID = /^(.*\d)[a-h]$/;
const LINKED = /^(refer to|using) the (same|above|previous)\b/i;
const sameOptions = (a: SkillItem, b: SkillItem) =>
  !!a.options && !!b.options && a.options.length === b.options.length && a.options.every((o, i) => o === b.options![i]);
const isBankable = (item: SkillItem) => item.type === "mcq" && !item.passage && (item.options?.length ?? 0) >= 5;

export function buildBlocks(items: readonly SkillItem[]): Block[] {
  const blocks: Block[] = [];
  const byPassage = new Map<string, Block>();
  const byBase = new Map<string, Block>();
  items.filter(isPrintable).forEach((item, source) => {
    if (item.passage) {
      const key = item.passage.trim();
      const found = byPassage.get(key);
      if (found) return void found.items.push(item);
      const block: Block = { key: item.id, kind: "passage", items: [item], divisible: !/\(\d+\)/.test(item.passage), source };
      byPassage.set(key, block);
      return void blocks.push(block);
    }
    const base = PART_ID.exec(item.id)?.[1];
    if (base) {
      const found = byBase.get(base);
      if (found) {
        found.items.push(item);
        found.kind = "multipart";
        return;
      }
      const block: Block = { key: item.id, kind: "single", items: [item], divisible: false, source };
      byBase.set(base, block);
      return void blocks.push(block);
    }
    const prev = blocks.at(-1);
    if (prev && LINKED.test(item.stem.trim()) && (prev.kind === "single" || prev.kind === "linked") && !prev.items[0].passage) {
      prev.items.push(item);
      prev.kind = "linked";
      return;
    }
    if (
      prev &&
      isBankable(item) &&
      (prev.kind === "single" || prev.kind === "bank") &&
      isBankable(prev.items[0]) &&
      sameOptions(prev.items[0], item) &&
      prev.items[0].topic === item.topic
    ) {
      prev.items.push(item);
      prev.kind = "bank";
      prev.divisible = true;
      return;
    }
    blocks.push({ key: item.id, kind: "single", items: [item], divisible: false, source });
  });
  return blocks;
}

export const blockMarks = (b: Pick<Block, "items">) => b.items.reduce((s, i) => s + i.marks, 0);
/** Numbered questions the block adds: a multi-part question is one number. */
export const blockQuestions = (b: Pick<Block, "items" | "kind">) => (b.kind === "multipart" ? 1 : b.items.length);
export const blockTopic = (b: Pick<Block, "items">) => b.items[0].topic;
export const blockDifficulty = (b: Pick<Block, "items">) => Math.round(b.items.reduce((s, i) => s + i.difficulty, 0) / b.items.length);
export const allOfType = (b: Pick<Block, "items">, ...types: ItemType[]) => b.items.every((i) => types.includes(i.type));
export const someOfType = (b: Pick<Block, "items">, ...types: ItemType[]) => b.items.some((i) => types.includes(i.type));
/** Topic id equals the prefix, or sits under it ("reading" matches "reading.visual"). */
export const inTopic = (b: Pick<Block, "items">, prefix: string) =>
  b.items.some((i) => i.topic === prefix || i.topic.startsWith(`${prefix}.`));
