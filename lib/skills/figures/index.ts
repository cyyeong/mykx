// Question-bank figures: a trusted renderer that turns a skill item's `figure_spec` (plain JSON
// data describing a diagram) into a static, accessible SVG. Skill packs never ship code that runs
// (AGENTS.md rule 10); this module is myKx's own drawing code and only reads the data.
//
//   renderFigure(item.figure_spec, { id: item.id, title: figureTitle([item]) }) → "<svg …>…</svg>"
//
// Spec shapes in the packs:
//   { stem: [diagram…], options?: [diagram…] }   diagrams carry `kind` (P3) or `type` (P6)
//   { poster: {…} }                              English visual text
//   { scene: { w, h, items } } | { icons: [...] } Chinese picture-word questions
// `options` diagrams are drawn in a 2×2 grid labelled "Diagram 1"… to match options like "Diagram 1".
import { KINDS } from "./kinds/index.ts";
import { FAINT, FONT, INK, PAPER, el, esc, kindOf, list, obj, pill, place, rect, type Ctx, type Drawing, type Spec } from "./svg.ts";

export { figureTitle } from "./title.ts";
export type { Drawing } from "./svg.ts";

export class FigureError extends Error {}

const MAX_W = 420;
/** Small figures sit on a canvas at least this wide, so every figure shows text at about the same size. */
const MIN_W = 320;
const PAD = 12;
const GAP = 18;

/** The stem and option diagrams of a spec, each with a `kind`. */
export function normaliseSpec(spec: unknown): { stem: Spec[]; options: Spec[] } {
  const s = obj(spec);
  const withKind = (d: unknown): Spec => {
    const o = obj(d);
    return { ...o, kind: kindOf(o) };
  };
  if (s.poster) return { stem: [{ ...obj(s.poster), kind: "poster" }], options: [] };
  if (s.scene && !Array.isArray(s.scene)) return { stem: [{ ...obj(s.scene), kind: "picture" }], options: [] };
  if (Array.isArray(s.icons)) return { stem: [{ icons: s.icons, w: s.w, kind: "icon_set" }], options: [] };
  return { stem: list(s.stem).map(withKind), options: list(s.options).map(withKind) };
}

/** Every kind a spec uses, nested ones included (for surveys and tests). */
export function figureKinds(spec: unknown): string[] {
  const out: string[] = [];
  const walk = (d: Spec) => {
    out.push(kindOf(d));
    if (kindOf(d) === "row") for (const it of list(d.items)) walk(obj(it));
  };
  const { stem, options } = normaliseSpec(spec);
  [...stem, ...options].forEach(walk);
  return out;
}

const ctx: Ctx = {
  render(d: Spec): Drawing {
    const kind = kindOf(d);
    const fn = KINDS[kind];
    if (!fn) throw new FigureError(`unknown figure kind "${kind || "(none)"}"`);
    return fn(d, ctx);
  },
};

/** Lay the stem diagrams out in rows (side by side when they fit), then the options grid. */
export function renderDrawing(spec: unknown): Drawing {
  const { stem, options } = normaliseSpec(spec);
  if (!stem.length && !options.length) throw new FigureError("figure_spec has no diagrams");
  const parts: string[] = [];
  const alt: string[] = [];
  let y = 0;
  let width = 0;

  const drawn = stem.map((d) => ctx.render(d));
  // Diagrams share a row when they fit at no less than ~87% size; each row is scaled to fit MAX_W.
  const lines: Drawing[][] = [];
  for (const d of drawn) {
    const last = lines[lines.length - 1];
    const used = last ? last.reduce((s, x) => s + x.w + GAP, 0) : Infinity;
    if (last && used + d.w <= MAX_W * 1.15) last.push(d);
    else lines.push([d]);
  }
  const natural = lines.map((l) => l.reduce((s, d) => s + d.w, 0) + GAP * (l.length - 1));
  const lineScale = natural.map((w) => Math.min(1, MAX_W / w));
  const lineW = natural.map((w, i) => w * lineScale[i]);
  const gridCell = options.length ? options.map((d) => ctx.render(d)) : [];
  const cellW = Math.max(0, ...gridCell.map((c) => c.w));
  const cellH = Math.max(0, ...gridCell.map((c) => c.h));
  const cols = gridCell.length > 1 ? 2 : 1;
  const cs = cellW ? Math.min(1, (MAX_W - GAP * (cols - 1)) / cols / (cellW + 16)) : 1;
  const frameW = (cellW + 16) * cs;
  const gridW = cols * frameW + (cols - 1) * GAP;
  width = Math.max(...lineW, gridW, MIN_W);

  lines.forEach((l, i) => {
    const s = lineScale[i];
    const h = Math.max(...l.map((d) => d.h * s));
    let x = (width - lineW[i]) / 2;
    for (const d of l) {
      parts.push(place(d, x, y + h - d.h * s, s)); // bottom-aligned, so captions line up
      x += (d.w + GAP) * s;
      alt.push(d.alt);
    }
    y += h + GAP;
  });

  if (gridCell.length) {
    const labelH = 30;
    const frameH = labelH + (cellH + 10) * cs;
    const x0 = (width - gridW) / 2;
    gridCell.forEach((c, i) => {
      const fx = x0 + (i % cols) * (frameW + GAP);
      const fy = y + Math.floor(i / cols) * (frameH + GAP);
      parts.push(rect(fx, fy, frameW, frameH, { rx: 10, fill: PAPER, stroke: FAINT, "stroke-width": 1.5 }));
      parts.push(pill(fx + 46, fy + 16, `Diagram ${i + 1}`, { size: 12.5, weight: 700, padY: 4, padX: 8, stroke: INK, strokeWidth: 1.3 }).body);
      parts.push(place(c, fx + (frameW - c.w * cs) / 2, fy + labelH + ((cellH - c.h) * cs) / 2, cs));
      alt.push(`Diagram ${i + 1}: ${c.alt}`);
    });
    y += Math.ceil(gridCell.length / cols) * (frameH + GAP);
  }
  return { w: width, h: y - GAP, body: parts.join(""), alt: alt.join(" ") };
}

export interface FigureMeta {
  /** Item or figure id; used to make the title/desc ids unique on a page. */
  id: string;
  /** Short title in the item's own words. */
  title: string;
}

/** A complete, standalone SVG document for a figure spec. */
export function renderFigure(spec: unknown, meta: FigureMeta): string {
  const d = renderDrawing(spec);
  const W = Math.ceil(d.w + 2 * PAD);
  const H = Math.ceil(d.h + 2 * PAD);
  const id = `fig-${meta.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  const body =
    el("title", { id: `${id}-title` }, esc(meta.title)) +
    el("desc", { id: `${id}-desc` }, esc(d.alt)) +
    rect(0, 0, W, H, { fill: PAPER }) +
    el("g", { transform: `translate(${PAD} ${PAD})`, "stroke-linecap": "round", "stroke-linejoin": "round" }, d.body);
  return (
    el(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: `0 0 ${W} ${H}`,
        width: W,
        height: H,
        role: "img",
        "aria-labelledby": `${id}-title ${id}-desc`,
        "font-family": FONT,
      },
      body,
    ) + "\n"
  );
}
