// The child's "Why do you think so?" reason (FR10), checked in code. A reason counts toward the explanation
// stars only when it is a real attempt: at least three words that use the question's own ideas (the worked
// steps, the right answer, its keywords and marking points). "because i am monk" does not count; "adult frogs lay
// eggs again" does. Deterministic and transparent (rule 5): the same words always give the same verdict. Kix's
// spoken feedback on the reason (/api/kix/reason) is narration only and never changes this.
import type { SkillItem } from "../types.ts";

export type ReasonQuality = "none" | "short" | "off-topic" | "on-topic";

export interface ReasonCheck {
  quality: ReasonQuality;
  /** The question's ideas the reason used (stemmed words), for "you used 'eggs'". */
  used: string[];
}

const STOP = new Set(
  "a an the is are am was were be been being i me my you your he she it its we they them their this that these those there here and or but so because if then than as at by for from in into of on to with without about not no yes do does did done have has had can could will would should may might must just very really also only some any all each every more most much many other same such what which who whom whose when where why how think thought know knew say said like get got make made one two three first last".split(" "),
);

/** Lower-case word stems: plurals and simple endings trimmed, so "eggs" meets "egg" and "lays" meets "lay". */
export function stems(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 4 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -1) : w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .map((w) => (w.length > 5 && w.endsWith("ing") ? w.slice(0, -3) : w.length > 4 && w.endsWith("ed") ? w.slice(0, -2) : w));
}

function ideasOf(item: Pick<SkillItem, "working" | "keywords" | "marking" | "options" | "answer" | "type">): Set<string> {
  const right = item.type === "mcq" && typeof item.answer === "number" ? (item.options?.[item.answer - 1] ?? "") : String(item.answer);
  const lines = [...(item.working ?? []).filter((w) => !/^(common error|watch out|check)\b/i.test(w)), ...(item.keywords ?? []), ...(item.marking ?? []), right];
  return new Set(lines.flatMap(stems));
}

export function checkReason(item: Pick<SkillItem, "working" | "keywords" | "marking" | "options" | "answer" | "type">, text: string | null): ReasonCheck {
  const said = (text ?? "").trim();
  if (!said) return { quality: "none", used: [] };
  if ((said.match(/[\p{L}\p{N}]+/gu) ?? []).length < 3) return { quality: "short", used: [] };
  const ideas = ideasOf(item);
  const used = [...new Set(stems(said).filter((w) => ideas.has(w)))];
  return { quality: used.length ? "on-topic" : "off-topic", used };
}

/** A model reason for the answer, from the item's worked steps (claim, evidence, reasoning), at most three lines. */
export function modelReason(item: Pick<SkillItem, "working">): string | null {
  const lines = (item.working ?? []).filter((w) => !/^(common error|watch out|check|draw the model)\b/i.test(w));
  return lines.length ? lines.slice(0, 3).join(" ") : null;
}
