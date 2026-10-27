// The small text markup that item stems, passages and answers use (lib/types.ts SkillItem.stem):
// **bold**, __underline__, runs of underscores for a blank ("____", "___(1)___"), "| a | b |" tables,
// "- " lists and &nbsp;. Parsed to a tiny tree so the print page can render it with trusted React
// (never as HTML). Pure, no React.

export type Inline =
  | { t: "text"; v: string }
  | { t: "b"; c: Inline[] }
  | { t: "u"; c: Inline[] }
  | { t: "blank"; label?: string }
  | { t: "br" };

export type TextBlock =
  | { t: "p"; c: Inline[] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "ul"; items: Inline[][] };

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
}

/** Paragraphs are separated by a blank line. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Order matters: a numbered blank before a plain blank, and both before underline (which also uses "__").
const INLINE = /(_{2,}\((\d+)\)_{2,})|(_{3,})|\*\*(.+?)\*\*|__([^_\n]+?)__|\n/g;

export function parseInline(text: string): Inline[] {
  const src = decodeEntities(text);
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: src.slice(last, at) });
    if (m[1]) out.push({ t: "blank", label: `(${m[2]})` });
    else if (m[3]) out.push({ t: "blank" });
    else if (m[4] !== undefined) out.push({ t: "b", c: parseInline(m[4]) });
    else if (m[5] !== undefined) out.push({ t: "u", c: parseInline(m[5]) });
    else out.push({ t: "br" });
    last = at + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

const isTableLine = (line: string) => /^\s*\|[\s\S]*\|\s*$/.test(line);
const isRuleRow = (line: string) => /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(line);
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => parseInline(c.trim()));

/**
 * Block structure: paragraphs (single newlines become line breaks), Markdown tables and "- " lists.
 * `linesAsParagraphs` turns every line into its own paragraph (reading passages).
 */
export function parseBlocks(text: string, { linesAsParagraphs = false } = {}): TextBlock[] {
  const blocks: TextBlock[] = [];
  // A table cell may wrap onto the next line ("| Sprinkled\nwith water |"): join until the row closes.
  const lines: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const open = lines.at(-1);
    if (open !== undefined && /^\s*\|/.test(open) && !/\|\s*$/.test(open)) lines[lines.length - 1] = `${open}\n${line}`;
    else lines.push(line);
  }
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join("\n")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    if (isTableLine(line)) {
      flush();
      const rows: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) rows.push(lines[i++]);
      i--;
      const hasRule = rows.length > 1 && isRuleRow(rows[1]);
      const body = rows.filter((r, n) => !(hasRule && n === 1));
      blocks.push({ t: "table", head: hasRule ? cells(body[0]) : [], rows: (hasRule ? body.slice(1) : body).map(cells) });
      continue;
    }
    if (/^\s*[-•]\s+/.test(line)) {
      flush();
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) items.push(parseInline(lines[i++].replace(/^\s*[-•]\s+/, "")));
      i--;
      blocks.push({ t: "ul", items });
      continue;
    }
    if (linesAsParagraphs) {
      flush();
      blocks.push({ t: "p", c: parseInline(line.trim()) });
    } else para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Plain text without markup, for lengths and labels. */
export function plainText(text: string): string {
  return decodeEntities(text)
    .replace(/_{2,}\((\d+)\)_{2,}/g, "($1)")
    .replace(/_{3,}/g, "____")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__([^_\n]+?)__/g, "$1");
}

/** Visual width in Latin-character units: CJK and full-width characters count double. */
export function visualWidth(text: string): number {
  let w = 0;
  for (const ch of plainText(text)) w += /[⺀-鿿豈-﫿＀-￯]/.test(ch) ? 2 : 1;
  return w;
}
