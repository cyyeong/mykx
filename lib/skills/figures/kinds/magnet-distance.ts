// magnet_distance: a magnet slid towards an object on a table; the gap when it is first attracted.
// { object, magnet_label }
import { SOFT, arrow, groundLine, line, str, text, type Renderer } from "../svg.ts";
import { barMagnet, clip } from "./magnet-parts.ts";

export const magnetDistance: Renderer = (d) => {
  const object = str(d.object, "steel clip");
  const name = str(d.magnet_label);
  const W = 360;
  const table = 104;
  const m0 = 24;
  const m1 = 128;
  const c0 = 262;
  const parts = [
    groundLine(10, W - 10, table, "below"),
    barMagnet(m0, table - 26, m1 - m0, 26, { labels: ["", ""] }),
    text((m0 + m1) / 2, table + 22, name ? `magnet ${name}` : "magnet", { size: 13, weight: 600 }),
    arrow(m0 + 10, table - 44, m1 - 6, table - 44, { head: 8, width: 1.8 }),
    text((m0 + m1) / 2, table - 58, "moved slowly", { size: 12 }),
    clip(c0 + 16, table - 6, 1.1),
    text(c0 + 16, table + 22, object, { size: 13 }),
    line(m1, table - 30, m1, table - 76, { stroke: SOFT, "stroke-width": 1.1, "stroke-dasharray": "3 3" }),
    line(c0, table - 14, c0, table - 76, { stroke: SOFT, "stroke-width": 1.1, "stroke-dasharray": "3 3" }),
    arrow(m1, table - 70, c0, table - 70, { both: true, head: 7, width: 1.5 }),
    text((m1 + c0) / 2, table - 84, "distance", { size: 12.5, weight: 600 }),
  ];
  return {
    w: W,
    h: table + 34,
    body: parts.join(""),
    alt: `A bar magnet${name ? ` (${name})` : ""} on a table is moved slowly towards a ${object}; the distance between them is marked.`,
  };
};
