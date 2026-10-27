// magnets (P6): a magnet, bars and clips placed in units, y upwards, plus labelled arrows.
// { box: [w, h], items: [{ kind: "magnet" | "bar" | "clip", x, y, w?, poles?, ends?, hatch?, label }],
//   arrows?: [{ x0, y0, x1, y1, text }] }
import { INK, PAPER, arrow, groundLine, hatch, list, num, obj, rect, str, text, type Renderer } from "../svg.ts";
import { barMagnet, clip } from "./magnet-parts.ts";

export const magnets: Renderer = (d) => {
  const box = list(d.box).map((v) => num(v, 0));
  const bw = box[0] || 9;
  const bh = box[1] || 3;
  const S = Math.min(420 / bw, 60);
  const PAD = 14;
  const H = bh * S;
  const X = (x: number) => PAD + x * S;
  const Y = (y: number) => PAD + H - y * S;
  const items = list(d.items).map(obj);
  const thick = 0.55 * S;
  const floor = Math.min(...items.map((i) => num(i.y, 1)));
  const parts: string[] = [];
  const labels: string[] = [];
  const alt: string[] = [];
  parts.push(groundLine(X(0.1), X(bw - 0.1), Y(floor)));
  for (const it of items) {
    const x = num(it.x, 0);
    const y = num(it.y, 0);
    const w = num(it.w, 2);
    const label = str(it.label);
    const kind = str(it.kind);
    if (kind === "magnet") {
      const poles = list(it.poles).map((p) => str(p));
      parts.push(barMagnet(X(x), Y(y) - thick, w * S, thick, { labels: poles }));
      alt.push(`${label || "a magnet"} with its ${poles[0] ?? "?"} pole on the left and ${poles[1] ?? "?"} pole on the right`);
    } else if (kind === "bar") {
      parts.push(rect(X(x), Y(y) - thick, w * S, thick, { fill: PAPER, stroke: INK, "stroke-width": 2 }));
      if (str(it.hatch)) parts.push(hatch(X(x), Y(y) - thick, w * S, thick, str(it.hatch)[0], 8));
      parts.push(rect(X(x), Y(y) - thick, w * S, thick, { fill: "none", stroke: INK, "stroke-width": 2 }));
      const ends = list(it.ends).map((e) => str(e));
      if (ends[0]) labels.push(text(X(x) + 2, Y(y) - thick - 12, ends[0], { size: 14, weight: 700 }));
      if (ends[1]) labels.push(text(X(x + w) - 2, Y(y) - thick - 12, ends[1], { size: 14, weight: 700 }));
      alt.push(`${label || "a bar"}${ends.length ? ` with ends ${ends.join(" and ")}` : ""}`);
    } else if (kind === "clip") {
      parts.push(clip(X(x), Y(floor) - 9, 1.3));
      alt.push(label || "a clip");
    }
    if (label) labels.push(text(X(x + (kind === "clip" ? 0 : w / 2)), Y(floor) + 20, label, { size: 12.5 }));
  }
  for (const a of list(d.arrows).map(obj)) {
    const x0 = X(num(a.x0, 0));
    const y0 = Y(num(a.y0, 0));
    const x1 = X(num(a.x1, 0));
    const y1 = Y(num(a.y1, 0));
    parts.push(arrow(x0, y0, x1, y1, { head: 9, width: 2 }));
    if (str(a.text)) labels.push(text((x0 + x1) / 2, Math.min(y0, y1) - 12, str(a.text), { size: 12.5 }));
    alt.push(`an arrow labelled "${str(a.text)}" pointing ${x1 < x0 ? "left" : "right"}`);
  }
  return { w: bw * S + 2 * PAD, h: H + 2 * PAD + 14, body: parts.join("") + labels.join(""), alt: `On a table: ${alt.join("; ")}.` };
};
