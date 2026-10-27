// magnets_table: bar magnets lying end to end on a table. { magnets: [{ name, labels[2] }], hold?: index held in place }
import { SOFT, groundLine, list, num, obj, str, text, type Renderer } from "../svg.ts";
import { barMagnet } from "./magnet-parts.ts";

export const magnetsTable: Renderer = (d) => {
  const magnets = list(d.magnets).map(obj);
  const hold = typeof d.hold === "number" ? num(d.hold, -1) : -1;
  const n = Math.max(1, magnets.length);
  const len = 110;
  const gap = 46;
  const W = n * len + (n - 1) * gap + 40;
  const table = 62;
  const parts = [groundLine(6, W - 6, table, "below")];
  const alt: string[] = [];
  magnets.forEach((m, i) => {
    const x = 20 + i * (len + gap);
    const labels = list(m.labels).map((l) => str(l));
    parts.push(barMagnet(x, table - 28, len, 28, { labels }));
    parts.push(text(x + len / 2, table + 22, `magnet ${str(m.name)}`, { size: 13, weight: 600 }));
    if (i === hold) parts.push(text(x + len / 2, table + 40, "(held in place)", { size: 12, fill: SOFT }));
    alt.push(`magnet ${str(m.name)} with ${labels[0] || "?"} on the left and ${labels[1] || "?"} on the right${i === hold ? ", held in place" : ""}`);
  });
  return { w: W, h: table + (hold >= 0 ? 50 : 32), body: parts.join(""), alt: `Bar magnets on a table, left to right: ${alt.join("; ")}.` };
};
