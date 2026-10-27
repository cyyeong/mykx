// Deterministic marking (PRD FR04–05: "mark objective items deterministically; parent/admin
// confirms open-response rubrics before mastery changes").
//
// - mcq: the chosen option number must equal the key.
// - short: normalised text, the `accept` list, sequences ("1, 5, 3"), clock times ("16 05",
//   "5.35 p.m.") and numbers with an optional currency sign or unit, within `tolerance`.
//   Fractions are compared as written ("simplest form" questions must not accept 6/8 for 3/4).
// - open: needs review. A score is taken only from outside (a parent or admin confirms it, or the
//   child self-checks, which never counts as confirmed). Marking never invents one.
// - card: a self-check; never confirmed.
import type { SkillItem } from "../types.ts";
import { clamp } from "./time.ts";

export type MarkStatus = "marked" | "needs_review" | "self_check";

export interface MarkResult {
  status: MarkStatus;
  /** Null until a score exists (open items awaiting review). */
  correct: boolean | null;
  marks: number | null;
  maxMarks: number;
  /** True only when the score may move mastery (deterministic, or confirmed by a parent/admin). */
  confirmed: boolean;
  /** Which rule matched, for the "why was this marked right" trace. */
  rule?: "option" | "exact" | "accept" | "sequence" | "time" | "number";
}

export type MarkableItem = Pick<SkillItem, "type" | "marks" | "answer" | "accept" | "tolerance" | "unit" | "options">;

/** A score that comes from outside marking: a rubric review or the child's own self-check. */
export interface ExternalScore {
  marks: number;
  by: "parent" | "admin" | "self";
}

/** Marks one response. `response` is an option number for mcq, text otherwise. */
export function markItem(item: MarkableItem, response: number | string | null | undefined, external?: ExternalScore): MarkResult {
  const maxMarks = item.marks;
  if (item.type === "mcq") {
    const chosen = typeof response === "number" ? response : Number(String(response ?? "").trim());
    const correct = Number.isInteger(chosen) && chosen === item.answer;
    return { status: "marked", correct, marks: correct ? maxMarks : 0, maxMarks, confirmed: true, rule: "option" };
  }
  if (item.type === "short") {
    const rule = matchShort(item, String(response ?? ""));
    const correct = rule !== null;
    return { status: "marked", correct, marks: correct ? maxMarks : 0, maxMarks, confirmed: true, ...(rule ? { rule } : {}) };
  }
  // open and card: never scored by this code.
  const status: MarkStatus = item.type === "open" ? "needs_review" : "self_check";
  if (!external || !Number.isFinite(external.marks)) {
    return { status, correct: null, marks: null, maxMarks, confirmed: false };
  }
  const marks = clamp(external.marks, 0, maxMarks);
  return {
    status: external.by === "self" ? "self_check" : "marked",
    correct: marks >= maxMarks,
    marks,
    maxMarks,
    confirmed: item.type === "open" && external.by !== "self",
  };
}

// ─── Short answers ──────────────────────────────────────────────────────────

/**
 * Lower-case, NFKC, no Markdown bold, single spaces, no wrapping quotes or trailing full stop.
 * A punctuation-only answer ("." or "!") is kept as it is.
 */
export function normaliseAnswer(s: string): string {
  const base = s
    .normalize("NFKC")
    .replace(/\*\*/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return base.replace(/^["'\s]+|["'\s.!。]+$/gu, "") || base;
}

function matchShort(item: MarkableItem, raw: string): MarkResult["rule"] | null {
  const response = normaliseAnswer(raw);
  if (!response) return null;
  const key = String(item.answer);
  const keys = [key, ...(item.accept ?? [])];
  if (normaliseAnswer(key) === response) return "exact";
  if ((item.accept ?? []).some((a) => normaliseAnswer(a) === response)) return "accept";
  for (const k of keys) {
    const nk = normaliseAnswer(k);
    if (sequenceMatch(nk, response)) return "sequence";
    const t = timeMatch(nk, response);
    if (t !== null) {
      if (t) return "time";
      continue; // a clock-time key is never compared as a plain number
    }
    if (numberMatch(nk, response, item.tolerance ?? 0, item.unit)) return "number";
  }
  return null;
}

const SEQ_SPLIT = /\s*[,、;]\s*|\s+/u;

/** "1, 5, 3, 6" matches "1,5,3,6", "1 5 3 6" and (single-character tokens) "1536". */
function sequenceMatch(key: string, response: string): boolean {
  if (!/[,、;]/u.test(key)) return false;
  const want = key.split(SEQ_SPLIT).filter(Boolean);
  if (want.length < 2) return false;
  const got = response.split(SEQ_SPLIT).filter(Boolean);
  if (got.length === want.length) return got.every((g, i) => g === want[i]);
  if (got.length === 1 && want.every((w) => [...w].length === 1)) return got[0] === want.join("");
  return false;
}

interface ClockTime {
  minutes: number;
  /** "am"/"pm", or null for the 24-hour clock. */
  half: "am" | "pm" | null;
}

function parseTime(s: string): ClockTime | null {
  const m = /^(\d{1,2})\s*[:.\s]?\s*(\d{2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const half = m[3] ? (m[3].startsWith("a") ? "am" : "pm") : null;
  if (min > 59 || h > (half ? 12 : 23)) return null;
  return { minutes: h * 60 + min, half };
}

/** null when the key is not a clock time; else whether the response is the same time, same clock. */
function timeMatch(key: string, response: string): boolean | null {
  // A key is a time if it has am/pm, a colon, or the Singapore 24-hour "16 05" form.
  if (!/(a\.?\s?m\.?|p\.?\s?m\.?)$|^\d{1,2}:\d{2}$|^\d{2} \d{2}$/.test(key)) return null;
  const k = parseTime(key);
  if (!k) return null;
  const r = parseTime(response);
  return r !== null && r.minutes === k.minutes && r.half === k.half;
}

interface Quantity {
  value: number;
  unit: string;
}

/**
 * "$12", "12.50", "1,200 m", "25 cm2", "-3" → value and unit (after normaliseAnswer, so "cm²" is
 * "cm2"). Fractions are not numbers here.
 */
export function parseQuantity(s: string): Quantity | null {
  const m = /^(s?\$)?\s*(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d*\.?\d+)\s*([\p{L}%°][^/]*)?$/u.exec(s.trim());
  if (!m) return null;
  const value = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const unit = (m[1] ? "$" : "") + (m[3] ?? "").trim().replace(/\.$/, "");
  return { value, unit };
}

function numberMatch(key: string, response: string, tolerance: number, unit: string | undefined): boolean {
  const k = parseQuantity(key);
  const r = parseQuantity(response);
  if (!k || !r) return false;
  const want = k.unit || normaliseAnswer(unit ?? "");
  // A missing unit is accepted (the answer box shows it); a different unit is not.
  if (r.unit && want && r.unit.replace(/\s/g, "") !== want.replace(/\s/g, "")) return false;
  return Math.abs(k.value - r.value) <= Math.max(0, tolerance) + 1e-9;
}
