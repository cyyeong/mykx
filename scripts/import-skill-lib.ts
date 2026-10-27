// Helpers for scripts/import-skill.ts: scrubbing, Markdown section surgery and
// item mapping. Pure functions over text and parsed JSON; nothing here runs
// code that came with a source skill.
import type { Difficulty, ItemType, SkillItem } from "../lib/types.ts";

// Parsed source JSON is untyped data from the founder's skills.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = any;

export type Edit = [string | RegExp, string];

export function applyEdits(text: string, edits: Edit[] | undefined, where: string): string {
  let out = text;
  for (const [find, replace] of edits ?? []) {
    const before = out;
    out = typeof find === "string" ? out.split(find).join(replace) : out.replace(find, replace);
    if (before === out) throw new Error(`${where}: edit did not apply: ${String(find).slice(0, 80)}`);
  }
  return out;
}

// ─── Citations of school papers ─────────────────────────────────────────────

const LONG_SCHOOLS =
  "Nan Hua|Ai Tong|Tao Nan|Red Swastika|Catholic High|Henry Park|Methodist Girls'?|ACS(?:\\s+(?:Junior|Primary))?|ACSJ|ACSP|RGPS|MGS|CHS";
const CODE_TAIL =
  "(?:\\s+20\\d\\d)?(?:\\s+P[12][ABLS]?)?(?:\\s*(?:Q\\s?)?\\d+[a-zA-Z]?(?:\\([a-z]\\))*(?:\\s*[–-]\\s*\\d+[a-z]?)?)?(?:\\s+(?:style|pattern))?";
const SHORT_CODES = "(?:NH|AT|TN|AJ|AP|RS|CH)(?:\\d+[a-z]?(?:[–-]\\d+[a-z]?)?|\\s+P[12][ABLS]?\\s*Q?\\s?\\d+[a-z]?)";
const CITE_SRC = `(?:\\b(?:${LONG_SCHOOLS})${CODE_TAIL}|\\b${SHORT_CODES})`;
const citeRe = (flags = "") => new RegExp(CITE_SRC, flags);

/** ACS(J) / ACS (P) → ACS Junior / ACS Primary, so the parenthesis is not mistaken for a citation group. */
function normaliseSchoolCodes(text: string): string {
  return text.replace(/ACS\s*\(J\)/g, "ACS Junior").replace(/ACS\s*\(P\)/g, "ACS Primary");
}

/** Remove citations inside parentheses: "(Tao Nan Q15: "x" ✗)" → "(e.g. "x" ✗)"; "(NH9, TN8)" → "". */
function scrubParenCitations(text: string): string {
  return text.replace(/\s?\(([^()]*(?:\([a-z]\)[^()]*)*)\)/g, (whole, inner: string) => {
    if (!citeRe().test(inner)) return whole;
    const sep = inner.includes(";") ? ";" : ",";
    const parts = inner.split(sep);
    const kept: string[] = [];
    const trimPunct = (t: string) => t.replace(/^[\s,;:.—–-]+|[\s,;:—–-]+$/g, "").replace(/\s{2,}/g, " ");
    for (const raw of parts) {
      const seg = raw.trim();
      if (!seg) continue;
      const lead = new RegExp(`^(?:see\\s+|e\\.g\\.\\s+|cf\\.\\s+)?${CITE_SRC}\\s*(?:[:–-]\\s*)?`, "i");
      const m = lead.exec(seg);
      if (m) {
        // "School Q5: <worked numbers>" is a school question's answer: drop it.
        // A quoted phrase or an idea stays as an example.
        const rest = trimPunct(seg.slice(m[0].length).replace(citeRe("g"), ""));
        if (rest && /\s/.test(rest) && !/\d/.test(rest)) kept.push(`e.g. ${rest}`);
      } else if (citeRe().test(seg)) {
        const cleaned = trimPunct(seg.replace(citeRe("g"), ""));
        if (cleaned) kept.push(cleaned);
      } else kept.push(seg);
    }
    if (!kept.length) return "";
    const lead = whole.startsWith(" ") ? " " : "";
    return `${lead}(${kept.join(`${sep} `)})`;
  });
}

/**
 * Drop worked examples that are labelled with a school paper ("**RGPS Q21(b).** …",
 * "Example (Red Swastika 2026 P1 Q24): …", "Tao Nan 2026 Q27: …"), together with
 * the diagram and working that follow, up to the next heading, rule, list, table or bold label.
 */
export function dropCitedExamples(text: string): string {
  const lines = normaliseSchoolCodes(text).split("\n");
  const out: string[] = [];
  const LIST = /^\s*(?:[-*]|\d+\.)\s+/;
  // "**Wire problems (School Q25).** 13 × 5 rectangle → …": a school question worked through.
  const boldLabelWithCite = new RegExp(`^\\s*\\*\\*[^*]{0,40}\\(\\s*${CITE_SRC}[^)]*\\)[.:]?\\*\\*`);
  const paragraphNumbers = (from: number) => {
    let n = 0;
    for (let j = from; j < lines.length && lines[j].trim() !== ""; j++) n += (lines[j].match(/\d+/g) ?? []).length;
    return n;
  };
  let mode: "keep" | "drop-item" | "drop-example" = "keep";
  let fenced = false;
  let afterBlank = true;
  lines.forEach((line, i) => {
    const isFence = /^\s*```/.test(line);
    if (!fenced) {
      const listItem = LIST.test(line);
      const content = line.replace(LIST, "");
      const heading = /^(#|---)/.test(line);
      // A paragraph that only mentions a paper (not as its label) is a fresh, generic tip.
      const freshThing = afterBlank && (listItem || /^\s*(\||> |\*\*)/.test(line) || (citeRe().test(line) && !isCitedLabel(content)));
      if (heading) mode = "keep";
      else if (mode === "drop-item" && (listItem || line.trim() === "")) mode = "keep";
      else if (mode === "drop-example" && freshThing) mode = "keep";
      if (mode === "keep" && line.trim() && (isCitedLabel(content) || (boldLabelWithCite.test(line) && paragraphNumbers(i) >= 4))) {
        mode = listItem ? "drop-item" : "drop-example";
      }
    }
    if (isFence) fenced = !fenced;
    if (line.trim() === "" && !fenced) afterBlank = true;
    else if (line.trim() !== "") afterBlank = false;
    if (mode === "keep") out.push(line);
  });
  return out.join("\n");
}

function isCitedLabel(line: string): boolean {
  const head = line.slice(0, 90);
  const m = citeRe().exec(head);
  if (!m) return false;
  const before = head.slice(0, m.index);
  return /^[\s*>_-]*(?:\*\*)?(?:Example|Worked(?: example)?|Model reasoning pattern|Model)?\s*\(?\s*$/i.test(before);
}

/** Replace citations that survive outside parentheses. */
function scrubLooseCitations(text: string): string {
  return text
    .replace(new RegExp(`\\b(?:${LONG_SCHOOLS})'s\\b`, "g"), "one school's")
    .replace(citeRe("g"), (m) => (/^(?:NH|AT|TN|AJ|AP|RS|CH)/.test(m) ? "" : "one school"));
}

// ─── Names, traits, pronouns ────────────────────────────────────────────────

export interface NameScrub {
  /** Real names → replacement in method text ("the learner"). */
  names: string[];
  /** Real or possibly real names in item stories → fictional substitutes. */
  itemNames: Record<string, string>;
}

function scrubNamesInMethod(text: string, names: string[]): string {
  let out = text;
  for (const name of names) {
    out = out
      .replace(new RegExp(`\\bAgent ${name}\\b`, "g"), "the agent")
      .replace(new RegExp(`\\b${name}[’']s\\b`, "g"), "the learner's")
      .replace(new RegExp(`\\b${name}\\b`, "gi"), "the learner");
  }
  return out;
}

function scrubNamesInItem(text: string, itemNames: Record<string, string>): string {
  let out = text;
  for (const [name, sub] of Object.entries(itemNames)) {
    out = out.replace(new RegExp(`\\bAgent ${name}\\b`, "g"), `Agent ${sub}`).replace(new RegExp(`\\b${name}\\b`, "g"), sub);
  }
  return out;
}

const OBJECT_FOLLOWERS = new Set(
  "to a an the and or but so if that what why how when where which who with back in on at for from into up down out off over again now first something anything one two three it this these those yourself say do write try feel see think explain know name tell read answer draw work use practise retry choose pick look learn keep stay find start stop be get give make".split(
    " ",
  ),
);

/** Turn coaching text about one child into text about any learner. Opt-in per file. */
export function neutralisePronouns(text: string, pronoun: "he" | "she"): string {
  const subj = pronoun === "he" ? "he" : "she";
  const refl = pronoun === "he" ? "himself" : "herself";
  let out = text
    .replace(new RegExp(`\\b${subj}['’]ll\\b`, "gi"), (m) => cap(m, "the learner will"))
    .replace(new RegExp(`\\b${subj}['’]s\\b`, "gi"), (m) => cap(m, "the learner is"))
    .replace(new RegExp(`\\b${subj}['’]d\\b`, "gi"), (m) => cap(m, "the learner would"))
    .replace(new RegExp(`\\b${refl}\\b`, "gi"), (m) => cap(m, "themselves"))
    .replace(new RegExp(`\\b${subj}\\b`, "gi"), (m) => cap(m, "the learner"));
  if (pronoun === "he") {
    out = out.replace(/\bhim\b/gi, (m) => cap(m, "the learner")).replace(/\bhis\b/gi, (m) => cap(m, "their"));
  } else {
    // "her" is object or possessive; decide from the next word.
    out = out.replace(/\bher\b(\s+)?([A-Za-z’']+|[^A-Za-z\s])?/gi, (m, sp: string | undefined, next: string | undefined) => {
      const word = (next ?? "").toLowerCase();
      const isObject = !next || !sp || OBJECT_FOLLOWERS.has(word) || /^[^a-z]/i.test(next);
      return cap(m, isObject ? "the learner" : "their") + (sp ?? "") + (next ?? "");
    });
  }
  return out;
}

function cap(original: string, replacement: string): string {
  return /^[A-Z]/.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

/** Sentence-initial "the learner" → "The learner". */
function fixCapitals(text: string): string {
  return text
    .replace(/(^|[.!?]\s+|\n\n|\n\s*(?:[-*>]|\d+\.)\s+|\*\*|\|\s*|#\s+)(the learner|their|the agent)\b/g, (_m, pre: string, w: string) => pre + w[0].toUpperCase() + w.slice(1))
    .replace(/\bthe learner['’]s\b/g, "the learner's");
}

// ─── Script references ──────────────────────────────────────────────────────

/** Drop fenced code blocks and inline code that run the source skill's scripts. */
function scrubScriptRefs(text: string): string {
  return text
    .replace(/```[a-z]*\n[\s\S]*?```/g, (block) => (/python|\.py\b|tracker\.py|--profile|pdftoppm/.test(block) ? "" : block))
    .replace(/\s?\(?`[^`\n]*(?:\.py\b|python3?\b|--profile|pdftoppm)[^`\n]*`\)?/g, "")
    .replace(/[ \t]+\n/g, "\n");
}

// ─── Markdown structure ─────────────────────────────────────────────────────

/** Split into blank-line-separated blocks, keeping fenced code blocks whole. */
export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^```/.test(line.trim())) fenced = !fenced;
    if (!fenced && line.trim() === "") {
      if (current.length) blocks.push(current.join("\n"));
      current = [];
    } else current.push(line);
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

interface Heading {
  line: number;
  level: number;
  text: string;
}

function headings(lines: string[]): Heading[] {
  const out: Heading[] = [];
  let fenced = false;
  lines.forEach((line, i) => {
    if (/^```/.test(line.trim())) fenced = !fenced;
    const m = !fenced && /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) out.push({ line: i, level: m[1].length, text: m[2].trim() });
  });
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[`*_]/g, "").trim();

/** Line span [start, end) of the section whose heading starts with `prefix`. */
function sectionSpan(lines: string[], prefix: string): [number, number, Heading] | null {
  const hs = headings(lines);
  const h = hs.find((x) => x.level > 1 && norm(x.text).startsWith(norm(prefix)));
  if (!h) return null;
  const next = hs.find((x) => x.line > h.line && x.level <= h.level);
  return [h.line, next ? next.line : lines.length, h];
}

export function dropSections(text: string, prefixes: string[] | undefined, where: string): string {
  let lines = text.split("\n");
  for (const p of prefixes ?? []) {
    const span = sectionSpan(lines, p);
    if (!span) throw new Error(`${where}: no section "${p}" to drop`);
    lines = [...lines.slice(0, span[0]), ...lines.slice(span[1])];
  }
  return lines.join("\n");
}

export function replaceSections(text: string, map: Record<string, string> | undefined, where: string): string {
  let lines = text.split("\n");
  for (const [p, body] of Object.entries(map ?? {})) {
    const span = sectionSpan(lines, p);
    if (!span) throw new Error(`${where}: no section "${p}" to replace`);
    lines = [...lines.slice(0, span[0] + 1), "", ...body.trim().split("\n"), "", ...lines.slice(span[1])];
  }
  return lines.join("\n");
}

/** Body of one section (without its heading). */
export function sectionBody(text: string, prefix: string, where: string): string {
  const lines = text.split("\n");
  const span = sectionSpan(lines, prefix);
  if (!span) throw new Error(`${where}: no section "${prefix}"`);
  return lines.slice(span[0] + 1, span[1]).join("\n").trim();
}

/** Remove table columns by header name (first matching table row decides). */
export function dropTableColumns(text: string, headers: string[] | undefined): string {
  if (!headers?.length) return text;
  const lines = text.split("\n");
  let drop: number[] = [];
  return lines
    .map((line) => {
      if (!line.trim().startsWith("|")) {
        drop = [];
        return line;
      }
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
      if (!drop.length && cells.some((c) => headers.some((h) => norm(c) === norm(h)))) {
        drop = cells.map((c, i) => (headers.some((h) => norm(c) === norm(h)) ? i : -1)).filter((i) => i >= 0);
      }
      if (!drop.length) return line;
      return "| " + cells.filter((_, i) => !drop.includes(i)).map((c) => c.trim()).join(" | ") + " |";
    })
    .join("\n");
}

export function sectionTitles(text: string): string[] {
  return headings(text.split("\n"))
    .filter((h) => h.level === 2)
    .map((h) => h.text);
}

// ─── The scrub ──────────────────────────────────────────────────────────────

export interface ScrubOptions {
  names: string[];
  /** Topic tag renames in backticks, e.g. lifecycle_animals → cycles.animal. */
  tagMap?: Record<string, string>;
  pronoun?: "he" | "she";
  /** Pack-wide text replacements applied after the generic scrub. */
  post?: Edit[];
}

const TRAIT_REWRITES: Edit[] = [
  [/\bADHD learner\b/g, "learner who finds long sessions hard"],
  [/\ban ADHD\b/g, "a"],
  [/\bfor a forgetful learner\b/gi, "for any learner"],
  [/\bforgetful-friendly\b/gi, "memory-friendly"],
  [/\ba forgetful learner\b/gi, "a learner"],
];

export function scrubMethodText(text: string, opts: ScrubOptions): string {
  let out = normaliseSchoolCodes(text).replace(new RegExp(`\\b(?:${LONG_SCHOOLS})['’]s\\b`, "g"), "one school's");
  out = scrubParenCitations(out);
  out = scrubLooseCitations(out);
  out = scrubScriptRefs(out);
  out = scrubNamesInMethod(out, opts.names);
  if (opts.pronoun) out = neutralisePronouns(out, opts.pronoun);
  for (const [find, rep] of TRAIT_REWRITES) out = out.replace(find, rep);
  for (const [from, to] of Object.entries(opts.tagMap ?? {})) out = out.replace(new RegExp("`" + from + "`", "g"), "`" + to + "`");
  for (const [find, rep] of opts.post ?? []) out = typeof find === "string" ? out.split(find).join(rep) : out.replace(find, rep);
  out = fixCapitals(out);
  return tidy(out);
}

export function tidy(text: string): string {
  // Leave fenced code (diagrams, worked layouts) exactly as written.
  const parts = text.split(/(```[^\n]*\n[\s\S]*?```)/g);
  const cleaned = parts
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/[ \t]+$/gm, "")
            .replace(/ {2,}(?=\S)/g, (m, offset: number, s: string) => (s[offset - 1] === "\n" || offset === 0 ? m : " "))
            .replace(/ +([.,;!?])(?=\s|$)/g, "$1")
            .replace(/ \(\s*\)/g, ""),
    )
    .join("");
  return cleaned.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function scrubItemText(text: string, names: NameScrub): string {
  let out = normaliseSchoolCodes(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?b>/gi, "**")
    .replace(/<\/?i>/gi, "*")
    .replace(/<[^>]+>/g, "");
  out = scrubParenCitations(out);
  out = scrubNamesInItem(out, names.itemNames);
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

// ─── Items ──────────────────────────────────────────────────────────────────

export function mdTable(table: { header?: string[]; rows: string[][] }): string {
  const rows = table.rows.map((r) => r.map((c) => (c === "[]" ? "?" : String(c))));
  const header = table.header ?? rows[0].map(() => "");
  const line = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, "/")).join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

export function clampDifficulty(d: unknown, fallback: Difficulty): Difficulty {
  const n = Math.round(Number(d));
  return n >= 1 && n <= 5 ? (n as Difficulty) : fallback;
}

export function itemId(prefix: string, set: string, qid: string): string {
  return `${prefix}-${set}-${qid}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/g, "");
}

export function classifyOpen(answer: string, marks: number, hasCer: boolean): ItemType {
  if (hasCer || marks >= 2) return "open";
  return answer.length <= 40 ? "short" : "open";
}

/** Letter answers ("B") or option text → 1-based option number. */
export function optionNumber(answer: unknown, options: string[]): number | null {
  if (typeof answer === "number") return answer;
  if (typeof answer === "string") {
    if (/^[A-F]$/.test(answer)) return answer.charCodeAt(0) - 64;
    if (/^\d$/.test(answer)) return Number(answer);
    const i = options.findIndex((o) => o.trim() === answer.trim());
    if (i >= 0) return i + 1;
  }
  return null;
}

export function letterKeysToNumbers(d: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!d) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) out[/^[A-F]$/.test(k) ? String(k.charCodeAt(0) - 64) : k] = v;
  return out;
}

/** Remove empty optional fields so the JSON stays readable. */
export function compact(item: SkillItem): SkillItem {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return out as unknown as SkillItem;
}

/** Deep-map every string in a value. */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out as T;
  }
  return value;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Strip example numbers and surfaces from an archetype description. */
export function generalisePattern(text: string): string {
  let t = text.replace(/\*\*/g, "").replace(/\s*\([^)]*\d[^)]*\)/g, "");
  for (const sep of [":", " — ", " → ", ";", " – "]) {
    const i = t.indexOf(sep);
    if (i > 0 && /\d/.test(t.slice(i))) t = t.slice(0, i);
  }
  return t.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
}
