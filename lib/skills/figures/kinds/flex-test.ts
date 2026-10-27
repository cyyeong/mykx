// flex_test: a sheet on a table edge is pressed down; d is how far its free end bends. {}
import { INK, SHADE, SOFT, arrow, hatch, line, path, pd, rect, text, type Renderer } from "../svg.ts";

export const flexTest: Renderer = () => {
  const W = 340;
  const H = 150;
  const y = 52;
  const edge = 150;
  const end = 290;
  const drop = 50;
  const parts = [
    rect(14, y + 3, edge - 14, 16, { fill: SHADE, stroke: INK, "stroke-width": 1.8 }),
    hatch(14, y + 3, edge - 14, 16, "/", 8),
    rect(24, y + 19, 12, 70, { fill: SHADE, stroke: INK, "stroke-width": 1.6 }),
    rect(edge - 26, y + 19, 12, 70, { fill: SHADE, stroke: INK, "stroke-width": 1.6 }),
    // straight position (before) and bent sheet (pressed)
    line(edge, y, end + 4, y, { stroke: SOFT, "stroke-width": 1.5, "stroke-dasharray": "5 4" }),
    path(pd("M", 40, y, "L", edge, y, "Q", 232, y + 2, end, y + drop), { fill: "none", stroke: INK, "stroke-width": 3.2 }),
    arrow(end - 14, y - 2, end - 14, y + drop - 14, { head: 9, width: 2.2 }),
    text(end - 14, y - 14, "press", { size: 12.5 }),
    line(end + 4, y + drop, end + 30, y + drop, { stroke: SOFT, "stroke-width": 1.2, "stroke-dasharray": "3 3" }),
    line(end + 4, y, end + 30, y, { stroke: SOFT, "stroke-width": 1.2, "stroke-dasharray": "3 3" }),
    arrow(end + 22, y, end + 22, y + drop, { both: true, head: 7, width: 1.6 }),
    text(end + 32, y + drop / 2, "d", { size: 16, weight: 700, italic: true, anchor: "start" }),
    text(80, y - 12, "sheet", { size: 12.5 }),
    line(80, y - 5, 80, y - 1, { stroke: SOFT, "stroke-width": 1.1 }),
    text(80, y + 104, "table", { size: 12.5, fill: SOFT }),
  ];
  return { w: W, h: H + 8, body: parts.join(""), alt: "A sheet lies on a table with its end sticking out past the edge. The end is pressed down; d is the distance it bends down." };
};
