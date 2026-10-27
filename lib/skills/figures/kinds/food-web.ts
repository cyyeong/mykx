// food_web: organisms at (x, y) (y upwards) with arrows from food to feeder.
// { nodes: { name: [x, y] }, edges: [[from, to]] }
import { arrow, boxExit, list, num, obj, pill, str, textWidth, type Renderer } from "../svg.ts";

export const foodWeb: Renderer = (d) => {
  const nodes = Object.entries(obj(d.nodes)).map(([name, p]) => ({ name, x: num(list(p)[0], 0), y: num(list(p)[1], 0) }));
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const [xmin, xmax, ymin, ymax] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const size = 13.5;
  const pad = Math.max(...nodes.map((n) => textWidth(n.name, size) / 2 + 12));
  const W = 420;
  const H = 190;
  const X = (x: number) => pad + ((x - xmin) / (xmax - xmin || 1)) * (W - 2 * pad);
  const Y = (y: number) => 22 + ((ymax - y) / (ymax - ymin || 1)) * (H - 44);
  const at = new Map(nodes.map((n) => [n.name, { cx: X(n.x), cy: Y(n.y), w: textWidth(n.name, size) + 18, h: size + 12 }]));
  const parts: string[] = [];
  const eats: string[] = [];
  for (const e of list(d.edges)) {
    const [a, b] = list(e).map((v) => str(v));
    const A = at.get(a);
    const B = at.get(b);
    if (!A || !B) continue;
    const [sx, sy] = boxExit(A.cx, A.cy, A.w, A.h, B.cx - A.cx, B.cy - A.cy, 3);
    const [ex, ey] = boxExit(B.cx, B.cy, B.w, B.h, A.cx - B.cx, A.cy - B.cy, 3);
    parts.push(arrow(sx, sy, ex, ey, { head: 9, width: 1.8 }));
    eats.push(`${a} → ${b}`);
  }
  for (const n of nodes) {
    const p = at.get(n.name);
    if (p) parts.push(pill(p.cx, p.cy, n.name, { size, padY: 6, padX: 9 }).body);
  }
  return { w: W, h: H, body: parts.join(""), alt: `A food web (arrows point from the food to the animal that eats it): ${eats.join(", ")}.` };
};
