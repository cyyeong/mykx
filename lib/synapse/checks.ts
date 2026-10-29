// The code checks behind a fix (docs/prd/SYNAPSE.md §5.2). A model proposes; these decide whether the proposal is
// even allowed. Any failed check makes the confidence 0. Pure functions.
import type { PackFiles } from "../skills/versions.ts";
import { holdsName } from "./deid.ts";
import type { ItemSnapshot, Review } from "./types.ts";

type Item = Record<string, unknown> & { id: string };
export type Check = { name: string; ok: boolean; note: string };

const FIELD = /^(stem|passage|options\.\d{1,2}|working\.\d{1,2}|hints\.\d{1,2})$/;
/** Words that would loosen a guardrail: a caution may only narrow what an agent does. */
const LOOSENING = /\b(reveal|give (?:away|out) the answer|tell (?:them|the (?:child|learner)) the answer|ignore|skip (?:the )?(?:check|guard|rule)|disregard|override|bypass|no need to|don't check|do not check)\b/i;

export const isScoringFix = (type: Review["fix"]["type"]) => type === "item-accept" || type === "item-answer";

/** A text field of an item by path (stem, passage, options.N, working.N, hints.N), or null. */
export function readField(item: Partial<Item>, field: string): string | null {
  if (!FIELD.test(field)) return null;
  const [key, n] = field.split(".");
  const v = item[key];
  if (n === undefined) return typeof v === "string" ? v : null;
  return Array.isArray(v) && typeof v[Number(n)] === "string" ? (v[Number(n)] as string) : null;
}

const count = (hay: string, needle: string) => (needle ? hay.split(needle).length - 1 : 0);

function distance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const numbersIn = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).join("|");

/** Checks a proposed fix against the item and the family's names. */
export function checkFix(review: Review, item: ItemSnapshot | null, names: readonly string[]): Check[] {
  const f = review.fix;
  const out: Check[] = [];
  const texts = [f.before, f.after, f.when, f.check, review.kidNote].filter((x): x is string => Boolean(x));
  out.push({ name: "No names", ok: !texts.some((t) => holdsName(t, names)), note: "the fix and the kid's note carry no family name" });
  if (f.type === "item-text") {
    const value = item && f.field ? readField(item as unknown as Item, f.field) : null;
    out.push({ name: "Field exists", ok: value !== null, note: f.field ?? "no field" });
    out.push({ name: "Text found once", ok: value !== null && !!f.before && count(value, f.before) === 1, note: "the words to change appear exactly once" });
    const safe = !!f.before && !!f.after && numbersIn(f.before) === numbersIn(f.after) && distance(f.before, f.after) <= Math.max(3, Math.ceil(f.before.length * 0.25));
    out.push({ name: "Small, safe edit", ok: safe, note: "no number changes; a small edit" });
  } else if (f.type === "item-accept") {
    const short = item?.type === "short" || item?.type === "open";
    out.push({ name: "Answer type", ok: short, note: "extra answers only for short and written items" });
    out.push({ name: "New answer", ok: !!f.after && !(item?.accept ?? []).includes(f.after.trim()) && String(item?.answer ?? "") !== f.after.trim(), note: "not already accepted" });
    out.push({ name: "In the worked solution", ok: !!f.after && workedHas(item, f.after), note: "the worked solution supports it" });
  } else if (f.type === "item-answer") {
    const n = Number(f.after);
    const ok = item?.type === "mcq" ? Number.isInteger(n) && n >= 1 && n <= (item.options?.length ?? 0) && n !== item.answer : !!f.after?.trim();
    out.push({ name: "Valid answer", ok, note: item?.type === "mcq" ? "a different option number" : "an answer is given" });
    out.push({ name: "In the worked solution", ok: !!f.after && workedHas(item, item?.type === "mcq" ? (item.options?.[n - 1] ?? "") : f.after), note: "the worked solution supports it" });
  } else if (f.type === "caution") {
    const len = (f.when?.length ?? 0) + (f.check?.length ?? 0);
    out.push({ name: "When … check …", ok: !!f.when?.trim() && !!f.check?.trim(), note: "the fixed form" });
    out.push({ name: "Short", ok: len > 0 && len <= 200, note: `${len} characters (200 at most)` });
    out.push({ name: "Only narrows", ok: !LOOSENING.test(`${f.when ?? ""} ${f.check ?? ""}`), note: "no words that loosen a guardrail" });
  }
  return out;
}

function workedHas(item: ItemSnapshot | null, answer: string): boolean {
  const a = answer.trim().toLowerCase();
  if (!a || !item) return false;
  return [...(item.working ?? []), String(item.answer)].some((w) => w.toLowerCase().includes(a));
}

/** The pack files with the fix applied to one item, or why it can't be. */
export function applyItemFix(files: PackFiles, itemId: string, review: Review): { ok: true; files: PackFiles; path: string } | { ok: false; reason: string } {
  const f = review.fix;
  for (const [path, text] of Object.entries(files)) {
    if (!path.startsWith("items/")) continue;
    let list: unknown;
    try {
      list = JSON.parse(text);
    } catch {
      continue;
    }
    if (!Array.isArray(list)) continue;
    const i = list.findIndex((x) => x && typeof x === "object" && (x as Item).id === itemId);
    if (i < 0) continue;
    const item = { ...(list[i] as Item) };
    if (f.type === "item-text") {
      const value = f.field ? readField(item, f.field) : null;
      if (value === null || !f.before || f.after === null || count(value, f.before) !== 1) return { ok: false, reason: "text-not-found" };
      const next = value.replace(f.before, f.after);
      const [key, n] = f.field!.split(".");
      if (n === undefined) item[key] = next;
      else item[key] = (item[key] as string[]).map((v, j) => (j === Number(n) ? next : v));
    } else if (f.type === "item-accept") {
      if (!f.after) return { ok: false, reason: "no-answer" };
      item.accept = [...((item.accept as string[] | undefined) ?? []), f.after.trim()];
    } else if (f.type === "item-answer") {
      if (!f.after) return { ok: false, reason: "no-answer" };
      item.answer = item.type === "mcq" ? Number(f.after) : f.after.trim();
    } else {
      return { ok: false, reason: "not-an-item-fix" };
    }
    const next = [...list];
    next[i] = item;
    return { ok: true, files: { ...files, [path]: `${JSON.stringify(next, null, 2)}\n` }, path };
  }
  return { ok: false, reason: "item-not-found" };
}

/** The item as the reviewer reads it. */
export function snapshotItem(item: Record<string, unknown>, packId: string): ItemSnapshot {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : null);
  return {
    id: String(item.id),
    packId,
    type: String(item.type),
    stem: String(item.stem ?? ""),
    passage: typeof item.passage === "string" ? item.passage : null,
    options: arr(item.options),
    answer: (item.answer as number | string) ?? "",
    accept: arr(item.accept),
    working: arr(item.working),
    hints: arr(item.hints),
    figure: typeof item.figure === "string" ? item.figure : null,
  };
}
