// flower: a labelled half-section of a flower. { labels: { stigma?, style?, ovary?, ovule?, anther?, filament?, petal?, sepal? } }
// Only the parts named in `labels` get a letter; names are never printed, so the figure tests the reader.
import { INK, PAPER, SHADE, SOFT, circle, ellipse, el, line, obj, path, pd, str, text, type Renderer } from "../svg.ts";

const W = 380;
const H = 280;
const CX = 190;

// Points each label's leader line touches, and which side its letter sits on.
const ANCHORS: Record<string, { px: number; py: number; side: "left" | "right" }> = {
  stigma: { px: CX - 6, py: 66, side: "left" },
  style: { px: CX + 3, py: 110, side: "right" },
  anther: { px: 122, py: 98, side: "left" },
  filament: { px: 243, py: 156, side: "right" },
  ovary: { px: CX + 22, py: 188, side: "right" },
  ovule: { px: CX - 6, py: 196, side: "left" },
  petal: { px: 72, py: 150, side: "left" },
  sepal: { px: 160, py: 232, side: "left" },
};

export const flower: Renderer = (d) => {
  const labels = obj(d.labels);
  const outline = { fill: PAPER, stroke: INK, "stroke-width": 1.8 };
  const parts: string[] = [];
  // stalk, receptacle and sepals
  parts.push(path(pd("M", CX - 6, H - 4, "L", CX - 6, 226, "M", CX + 6, H - 4, "L", CX + 6, 226), { fill: "none", stroke: INK, "stroke-width": 1.8 }));
  parts.push(path(pd("M", CX - 6, 226, "Q", CX - 36, 230, CX - 64, 206, "Q", CX - 34, 214, CX - 20, 212, "Z"), { ...outline, fill: SHADE }));
  parts.push(path(pd("M", CX + 6, 226, "Q", CX + 36, 230, CX + 64, 206, "Q", CX + 34, 214, CX + 20, 212, "Z"), { ...outline, fill: SHADE }));
  parts.push(path(pd("M", CX - 40, 210, "Q", CX, 236, CX + 40, 210, "Z"), outline));
  // petals
  parts.push(path(pd("M", CX - 30, 208, "C", CX - 120, 200, CX - 150, 110, CX - 120, 72, "C", CX - 100, 120, CX - 70, 170, CX - 26, 196, "Z"), outline));
  parts.push(path(pd("M", CX + 30, 208, "C", CX + 120, 200, CX + 150, 110, CX + 120, 72, "C", CX + 100, 120, CX + 70, 170, CX + 26, 196, "Z"), outline));
  // stamens: filament and anther on each side
  for (const s of [-1, 1]) {
    parts.push(path(pd("M", CX + s * 30, 206, "Q", CX + s * 56, 160, CX + s * 66, 106), { fill: "none", stroke: INK, "stroke-width": 2.2 }));
    parts.push(el("ellipse", { cx: CX + s * 68, cy: 96, rx: 7, ry: 13, transform: `rotate(${s * 12} ${CX + s * 68} 96)`, ...outline, fill: SHADE }));
  }
  // pistil: ovary with ovules, style, stigma
  parts.push(path(pd("M", CX - 4, 168, "L", CX - 4, 74, "L", CX + 4, 74, "L", CX + 4, 168), outline));
  parts.push(ellipse(CX, 194, 26, 26, outline));
  for (const [dx, dy] of [[-8, -8], [8, -8], [-8, 7], [8, 7]] as const) parts.push(circle(CX + dx, 194 + dy, 4.5, { fill: SHADE, stroke: INK, "stroke-width": 1.2 }));
  parts.push(path(pd("M", CX - 16, 74, "Q", CX - 14, 56, CX, 62, "Q", CX + 14, 56, CX + 16, 74, "Z"), { ...outline, fill: SHADE }));

  const named = Object.entries(labels).filter(([k]) => k in ANCHORS);
  const sides = { left: [] as [string, string][], right: [] as [string, string][] };
  for (const [part, letter] of named) sides[ANCHORS[part].side].push([part, str(letter)]);
  for (const side of ["left", "right"] as const) {
    for (const [part, letter] of sides[side]) {
      const a = ANCHORS[part];
      const tx = side === "left" ? 18 : W - 18;
      const lx = side === "left" ? tx + 11 : tx - 11;
      parts.push(line(lx, a.py, a.px, a.py, { stroke: SOFT, "stroke-width": 1.2 }), circle(a.px, a.py, 2, { fill: INK }));
      parts.push(text(tx, a.py, letter, { size: 16, weight: 700 }));
    }
  }
  return {
    w: W,
    h: H,
    body: parts.join(""),
    alt: `A cut-open flower with petals, stamens and a pistil. Lettered parts: ${named.map(([, l]) => str(l)).join(", ")}.`,
  };
};
