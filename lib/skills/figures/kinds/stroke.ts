// stroke: making a magnet by stroking. { mode: "one_way" | "both_ways", times, object }
// One way: the magnet slides along in one direction, then is lifted back to the start (dashed).
// Both ways: the magnet slides back and forth.
import { DARK_SHADE, INK, PAPER, SHADE, arrow, arrowHead, el, path, pd, rect, str, text, type Renderer } from "../svg.ts";

function objectShape(name: string, x0: number, x1: number, y: number): string {
  if (/needle|nail/.test(name))
    return (
      path(pd("M", x0, y - 3.5, "L", x1 - 14, y - 3.5, "L", x1, y, "L", x1 - 14, y + 3.5, "L", x0, y + 3.5, "Z"), { fill: SHADE, stroke: INK, "stroke-width": 1.6 }) +
      el("ellipse", { cx: x0 + 7, cy: y, rx: 4, ry: 1.6, fill: PAPER, stroke: INK, "stroke-width": 1 })
    );
  if (/wire/.test(name)) return rect(x0, y - 2.5, x1 - x0, 5, { rx: 2.5, fill: DARK_SHADE, stroke: INK, "stroke-width": 1.4 });
  return rect(x0, y - 5, x1 - x0, 10, { rx: 2, fill: SHADE, stroke: INK, "stroke-width": 1.6 });
}

export const stroke: Renderer = (d) => {
  const both = str(d.mode) === "both_ways";
  const times = str(d.times);
  const object = str(d.object, "steel needle");
  const W = 200;
  const H = 132;
  const oy = 100;
  const parts: string[] = [];
  // magnet standing on the left end of the object
  parts.push(rect(28, 42, 22, 54, { fill: SHADE, stroke: INK, "stroke-width": 1.6 }));
  parts.push(el("text", { x: 0, y: 0, transform: "translate(43.5 69) rotate(-90)", "font-size": 12, "text-anchor": "middle", fill: INK, stroke: "none" }, "magnet"));
  parts.push(objectShape(object, 20, 182, oy));
  if (both) {
    parts.push(arrow(58, 74, 180, 74, { both: true, head: 9, width: 2 }));
  } else {
    parts.push(arrow(58, 74, 180, 74, { head: 9, width: 2 }));
    parts.push(path(pd("M", 182, 64, "Q", 120, -4, 56, 40), { fill: "none", stroke: INK, "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    parts.push(arrowHead(56, 40, Math.atan2(44, -64), 8));
  }
  parts.push(text(14, H - 12, object, { size: 13.5, anchor: "start" }));
  parts.push(text(W - 10, H - 12, times, { size: 13.5, anchor: "end", weight: 700 }));
  return {
    w: W,
    h: H,
    body: parts.join(""),
    alt: `A magnet stroked along a ${object} ${both ? "back and forth in both directions" : "in one direction only, lifted back to the start each time"}, ${times}.`,
  };
};
