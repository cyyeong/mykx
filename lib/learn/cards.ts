// Chinese word cards in the question player (founder, 29 Oct). A card in the pack is a character or word with its
// pinyin and meaning; it has no question of its own, and a self-report ("I knew it") may never count as mastery
// evidence (rule 5). So code turns each card into a question it can mark:
//
//   recognise  the word is shown; the kid picks its meaning from four, the other three are meanings of other
//              cards in the same deck (same lesson first). Marked like any multiple choice.
//   write      the pinyin and meaning are shown (and the card's picture); the kid types the word in characters
//              (a pinyin keyboard). Marked by exact match, spaces ignored. Writing it on paper instead is a
//              self-check: the player shows the word ("Show me"), which is recorded as revealed, so it is practice
//              and never mastery evidence.
//
// Everything is deterministic: the same card and deck always give the same options in the same order, so the
// server rebuilds the question to mark it and the answer never reaches the browser. Pure.
import { normaliseAnswer, type MarkableItem } from "../domain/marking.ts";
import type { SkillItem } from "../types.ts";

export type CardMode = "meaning" | "write";

export interface CardQuestion {
  mode: CardMode;
  /** The question line ("What does this word mean?"). */
  prompt: string;
  /** What the card shows big: the word (meaning mode) or its pinyin (write mode). */
  show: string;
  /** The meaning, with any characters of the word taken out (write mode only). */
  meaning: string | null;
  /** Meaning options (meaning mode); empty for write mode. */
  options: string[];
  /** The item the server marks with (mcq for meaning, short for write). Never sent to the browser. */
  markable: MarkableItem;
}

const CJK = /[㐀-鿿豈-﫿]/u;

/** FNV-1a, for deterministic option choice and order. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The card's meaning without any Chinese in it (examples like "(斗牛, 斗争)" would give the word away). */
export function cleanMeaning(item: Pick<SkillItem, "card" | "answer">): string {
  const raw = item.card?.meaning ?? String(item.answer).split(/\s+[—-]\s+/).slice(1).join(" — ");
  const noExamples = raw.replace(/\([^)]*\)|（[^）]*）/gu, (m) => (CJK.test(m) ? "" : m));
  const parts = noExamples
    .split(/[;；]/u)
    .map((p) => p.trim())
    .filter((p) => p && !CJK.test(p));
  return parts.join("; ").replace(/\s+/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

function pinyinOf(item: Pick<SkillItem, "card" | "answer">): string {
  return item.card?.pinyin ?? String(item.answer).split(/\s+[—-]\s+/)[0] ?? "";
}

/** The card's mode: write cards ask for the characters; every other card asks for the meaning. */
export function cardMode(item: Pick<SkillItem, "subskill">): CardMode {
  return item.subskill === "write" ? "write" : "meaning";
}

/**
 * The question for one card. `deck` is the pack's other cards (the distractors come from it). A card whose
 * meaning can't be shown without its own characters falls back to the write mode's pinyin prompt.
 */
export function cardQuestion(item: SkillItem, deck: readonly SkillItem[]): CardQuestion {
  const meaning = cleanMeaning(item);
  const mode: CardMode = cardMode(item) === "write" || !meaning ? "write" : "meaning";
  if (mode === "write") {
    return {
      mode,
      prompt: "Type this word in Chinese characters.",
      show: pinyinOf(item),
      meaning: meaning || null,
      options: [],
      markable: { type: "short", marks: item.marks, answer: item.stem.replace(/\s+/g, "") },
    };
  }
  const want = normaliseAnswer(meaning);
  const seen = new Set([want]);
  const pool = deck
    .filter((c) => c.type === "card" && c.id !== item.id && c.stem !== item.stem)
    .map((c) => ({ c, text: cleanMeaning(c) }))
    .filter((x) => x.text)
    // Same lesson first, then the rest; a hash of the pair breaks ties so the choice is stable.
    .sort((a, b) => {
      const la = a.c.card?.lesson === item.card?.lesson ? 0 : 1;
      const lb = b.c.card?.lesson === item.card?.lesson ? 0 : 1;
      return la - lb || hash(`${item.id}|${a.c.id}`) - hash(`${item.id}|${b.c.id}`);
    });
  const distractors: string[] = [];
  for (const { text } of pool) {
    const key = normaliseAnswer(text);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(text);
    if (distractors.length === 3) break;
  }
  const options = [meaning, ...distractors].sort((a, b) => hash(`${item.id}#${a}`) - hash(`${item.id}#${b}`));
  return {
    mode,
    prompt: "What does this word mean?",
    show: item.stem,
    meaning: null,
    options,
    markable: { type: "mcq", marks: item.marks, answer: options.indexOf(meaning) + 1, options },
  };
}

/** A typed word for a write card: spaces and full-width spaces never matter. */
export function cardResponse(mode: CardMode, response: number | string | null): number | string | null {
  if (mode === "write" && typeof response === "string") return response.replace(/[\s　]+/gu, "");
  return response;
}
