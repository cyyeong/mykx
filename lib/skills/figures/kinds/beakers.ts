// beakers: identical beakers with water at different levels. { beakers: [{ label, level (0–1 of height), caption }] }
import { ACCENT, INK, TINT, line, list, num, obj, path, pd, rect, str, text, type Renderer } from "../svg.ts";

export const beakers: Renderer = (d) => {
  const items = list(d.beakers).map(obj);
  const n = Math.max(1, items.length);
  const bw = 72;
  const bh = 104;
  const gap = 46;
  const W = n * bw + (n - 1) * gap + 20;
  const top = 10;
  const parts: string[] = [];
  const alt: string[] = [];
  items.forEach((b, i) => {
    const x = 10 + i * (bw + gap);
    const level = Math.max(0, Math.min(1, num(b.level, 0.5)));
    const wy = top + bh * (1 - level);
    parts.push(rect(x, wy, bw, top + bh - wy, { fill: TINT, stroke: "none" }));
    parts.push(line(x, wy, x + bw, wy, { stroke: ACCENT, "stroke-width": 1.8 }));
    parts.push(path(pd("M", x - 5, top - 4, "L", x, top + 2, "L", x, top + bh, "L", x + bw, top + bh, "L", x + bw, top), { fill: "none", stroke: INK, "stroke-width": 2.2 }));
    const cap = str(b.caption) || `beaker ${str(b.label)}`;
    parts.push(text(x + bw / 2, top + bh + 16, cap, { size: 13 }));
    alt.push(`${cap}: water ${Math.round(level * 100)}% of the way up`);
  });
  return { w: W, h: top + bh + 28, body: parts.join(""), alt: `Identical beakers: ${alt.join("; ")}.` };
};
