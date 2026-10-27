// spring_set: identical springs hanging from a ceiling, each stretched by a load.
// { springs: [{ label, length (relative), load }] }
import { INK, PAPER, groundLine, list, num, obj, path, pd, rect, str, text, type Renderer } from "../svg.ts";

/** A vertical zigzag spring from y0 down to y1 at x. */
export function zigzag(x: number, y0: number, y1: number, half = 9, coils = 8): string {
  const lead = 6;
  const step = (y1 - y0 - 2 * lead) / (coils * 2);
  let d = pd("M", x, y0, "L", x, y0 + lead);
  for (let i = 0; i < coils * 2; i++) d += " " + pd("L", x + (i % 2 ? -half : half), y0 + lead + step * (i + 0.5));
  d += " " + pd("L", x, y1 - lead, "L", x, y1);
  return path(d, { fill: "none", stroke: INK, "stroke-width": 1.8 });
}

export const springSet: Renderer = (d) => {
  const springs = list(d.springs).map(obj);
  const n = Math.max(1, springs.length);
  const W = 60 + n * 100;
  const ceil = 20;
  const unit = 38;
  const parts = [groundLine(20, W - 20, ceil, "above")];
  let bottom = 0;
  const alt: string[] = [];
  springs.forEach((s, i) => {
    const x = 80 + i * 100;
    const len = num(s.length, 2) * unit;
    parts.push(zigzag(x, ceil, ceil + len, 9, Math.max(5, Math.round(len / 14))));
    parts.push(rect(x - 23, ceil + len, 46, 34, { rx: 3, fill: PAPER, stroke: INK, "stroke-width": 2 }));
    parts.push(text(x, ceil + len + 17, str(s.load), { size: 15, weight: 700 }));
    parts.push(text(x - 26, ceil + 28, str(s.label), { size: 15, weight: 700 }));
    bottom = Math.max(bottom, ceil + len + 34);
    alt.push(`spring ${str(s.label)} holds load ${str(s.load)} and is ${num(s.length, 2)} units long`);
  });
  return { w: W, h: bottom + 6, body: parts.join(""), alt: `Identical springs hanging from a ceiling: ${alt.join("; ")}.` };
};
