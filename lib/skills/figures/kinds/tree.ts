// tree: a classification chart. { root, width, children: [{ label, children: [{ label, items[] }] }] }
import { INK, PAPER, line, list, num, obj, pill, rect, str, text, type Renderer } from "../svg.ts";

export const tree: Renderer = (d) => {
  const W = num(d.width, 340);
  const root = str(d.root);
  const groups = list(d.children).map(obj);
  const n = Math.max(1, groups.length);
  const gap = 18;
  const colW = (W - gap * (n - 1)) / n;
  const conn = { stroke: INK, "stroke-width": 1.6 };
  const parts: string[] = [];
  const alt: string[] = [`A classification chart. ${root} are sorted into ${groups.length} groups.`];

  const r = pill(W / 2, 20, root, { size: 14, weight: 600, padX: 14, padY: 7 });
  parts.push(r.body);
  const barY = 20 + r.h / 2 + 14;
  const centres = groups.map((_, i) => colW / 2 + i * (colW + gap));
  parts.push(line(W / 2, 20 + r.h / 2, W / 2, barY, conn));
  if (n > 1) parts.push(line(centres[0], barY, centres[n - 1], barY, conn));

  let bottom = barY;
  groups.forEach((g, i) => {
    const cx = centres[i];
    let y = barY;
    const label = str(g.label);
    const kids = list(g.children).map(obj);
    if (label) {
      parts.push(line(cx, y, cx, y + 14, conn));
      const h = pill(cx, y + 14 + 15, label, { size: 14, weight: 700, minW: colW * 0.72, padY: 8 });
      parts.push(h.body);
      y += 14 + h.h;
    }
    const names: string[] = [];
    for (const k of kids) {
      const items = list(k.items).map((x) => str(x));
      const kLabel = str(k.label);
      const rows = (kLabel ? [kLabel] : []).concat(items);
      const bh = rows.length * 20 + 14;
      parts.push(line(cx, y, cx, y + 14, conn));
      y += 14;
      parts.push(rect(cx - colW / 2 + 6, y, colW - 12, bh, { rx: 8, fill: PAPER, stroke: INK, "stroke-width": 1.6 }));
      rows.forEach((row, j) => parts.push(text(cx, y + 7 + 20 * (j + 0.5), row, { size: 13.5, weight: kLabel && j === 0 ? 700 : 400 })));
      y += bh;
      names.push(...items);
    }
    alt.push(`${label || "Group"}: ${names.join(", ")}.`);
    bottom = Math.max(bottom, y);
  });
  return { w: W, h: bottom + 2, body: parts.join(""), alt: alt.join(" ") };
};
