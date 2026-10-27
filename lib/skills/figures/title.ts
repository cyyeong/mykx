// A figure's accessible title, taken from the item's own words.

interface TitleSource {
  stem: string;
  passage?: string;
}

const clean = (s: string) =>
  s
    .replace(/\*\*/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/_{2,}/g, "…")
    .replace(/\s+/g, " ")
    .trim();

function clip(s: string, max = 220): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trim()}…`;
}

/**
 * The opening of the item that the figure belongs to: a poster's own heading lines, or the
 * stem's first paragraph (with the next one when the first is only "Study the diagram."),
 * skipping tables, part questions and the Chinese picture-question instruction.
 */
export function figureTitle(items: TitleSource[]): string {
  const first = items[0];
  if (!first) return "Figure";
  if (first.passage) {
    const lines = first.passage.split("\n").map(clean).filter(Boolean);
    return clip(lines.slice(0, 2).join(" "));
  }
  const paras = first.stem
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("|"));
  const shared = items.length > 1 ? paras.filter((p) => !/^\([a-z]\)/.test(p)) : paras;
  const useful = shared.filter((p) => !/^根据图意/.test(p));
  const pick = useful.length ? useful : shared.length ? shared : paras;
  let title = clean(pick[0] ?? "Figure");
  if (title.length < 40 && pick[1]) title = `${title} ${clean(pick[1])}`;
  return clip(title);
}
