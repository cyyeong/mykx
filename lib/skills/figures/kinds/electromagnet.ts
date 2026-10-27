// electromagnet: wire coiled round an iron core, batteries, a switch and the clips it holds.
// { turns, cells, switch: "open" | "closed", clips, core? (label, default "iron nail") }
import { INK, PAPER, SHADE, circle, ellipse, line, num, path, pd, rect, str, text, type Renderer } from "../svg.ts";
import { clip } from "./magnet-parts.ts";

export const electromagnet: Renderer = (d) => {
  const turns = Math.max(1, Math.round(num(d.turns, 10)));
  const cells = Math.max(1, Math.round(num(d.cells, 1)));
  const closed = str(d.switch, "closed") !== "open";
  const clips = Math.max(0, Math.round(num(d.clips, 0)));
  const core = str(d.core, "iron nail");
  const W = 226;
  const top = 34;
  const ny = 122;
  const c0 = 70;
  const c1 = 150;
  const wire = { stroke: INK, "stroke-width": 1.8, fill: "none" };
  const parts: string[] = [];

  // Wires: left side down to the start of the coil, right side down to its end.
  parts.push(path(pd("M", c0, ny - 13, "L", 20, ny - 13, "L", 20, top, "L", 30, top), wire));
  const cellW = 30;
  const cellGap = 6;
  const bx = 30;
  for (let i = 0; i < cells; i++) {
    const x = bx + i * (cellW + cellGap);
    parts.push(rect(x, top - 8, cellW, 16, { rx: 2.5, fill: PAPER, stroke: INK, "stroke-width": 1.6 }));
    parts.push(rect(x + cellW, top - 4, 3, 8, { fill: INK }));
    parts.push(text(x + cellW - 7, top, "+", { size: 10 }));
    if (i < cells - 1) parts.push(line(x + cellW + 3, top, x + cellW + cellGap, top, wire));
  }
  const bEnd = bx + cells * (cellW + cellGap) - cellGap + 3;
  const s0 = Math.max(bEnd + 10, 114);
  const s1 = s0 + 26;
  parts.push(line(bEnd, top, s0, top, wire));
  parts.push(circle(s0, top, 2.6, { fill: INK }));
  parts.push(circle(s1, top, 2.6, { fill: INK }));
  parts.push(closed ? line(s0, top, s1, top, { stroke: INK, "stroke-width": 2.6 }) : line(s0, top, s1 - 3, top - 15, { stroke: INK, "stroke-width": 2.6 }));
  parts.push(text((s0 + s1) / 2, top - 23, "switch", { size: 13 }));
  const right = Math.max(c1, s1 + 10);
  parts.push(path(pd("M", s1, top, "L", right, top, "L", right, ny - 13, "L", c1, ny - 13), wire));

  // Iron core with its head on the left and point on the right.
  parts.push(rect(50, ny - 9, 3.5, 18, { fill: INK }));
  parts.push(path(pd("M", 53.5, ny - 4, "L", 194, ny - 4, "L", 208, ny, "L", 194, ny + 4, "L", 53.5, ny + 4, "Z"), { fill: SHADE, stroke: INK, "stroke-width": 1.6 }));
  // Coil: one loop per turn (capped so it stays readable).
  const loops = Math.min(turns, 24);
  const sp = (c1 - c0) / loops;
  for (let i = 0; i < loops; i++) parts.push(ellipse(c0 + sp * (i + 0.5), ny, Math.max(1.6, sp * 0.42), 13, { fill: "none", stroke: INK, "stroke-width": 1.3 }));
  parts.push(text((c0 + c1) / 2, ny - 35, `${turns} turns`, { size: 14, weight: 700 }));
  parts.push(text(40, ny + 28, core, { size: 13.5, anchor: "start" }));

  // Clips hang from the point, three to a row.
  for (let i = 0; i < clips; i++) {
    const r = Math.floor(i / 3);
    const k = i % 3;
    parts.push(clip(186 + k * 15, ny + 22 + r * 30, 0.9, true));
  }
  const rows = Math.ceil(clips / 3);
  return {
    w: W,
    h: Math.max(ny + 40, ny + 12 + rows * 30),
    body: parts.join(""),
    alt: `An electromagnet: wire coiled ${turns} turns round an ${core}, ${cells} ${cells === 1 ? "battery" : "batteries"}, switch ${closed ? "closed" : "open"}, ${clips} ${clips === 1 ? "clip" : "clips"} attracted.`,
  };
};
