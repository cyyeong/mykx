// life_cycle: stages joined by arrows in a loop.
// { stages[], icons?[] (per stage, null for none), blank?[] (stage indexes shown as empty boxes),
//   edges?[[from, to]] (default: each stage to the next, last back to first), size?: "small", title?, w?, h? }
import { drawIcon } from "../icons.ts";
import { INK, PAPER, arrow, boxExit, list, num, place, rect, str, text, textWidth, type Renderer } from "../svg.ts";
import { fit } from "./icon.ts";

interface Node {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Stage centres: a triangle for 3, the corners of a rectangle for 4, a ring otherwise (clockwise from the top left). */
function layout(n: number, w: number, h: number, mx: number, my: number): [number, number][] {
  if (n === 3)
    return [
      [w / 2, my],
      [w - mx, h - my],
      [mx, h - my],
    ];
  if (n === 4)
    return [
      [mx, my],
      [w - mx, my],
      [w - mx, h - my],
      [mx, h - my],
    ];
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [w / 2 + Math.cos(a) * (w / 2 - mx), h / 2 + Math.sin(a) * (h / 2 - my)];
  });
}

export const lifeCycle: Renderer = (d) => {
  const stages = list(d.stages).map((s) => str(s));
  const n = stages.length;
  const icons = list(d.icons).map((s) => (typeof s === "string" ? s : ""));
  const blanks = new Set(list(d.blank).map((b) => num(b, -1)));
  const withIcons = icons.some(Boolean);
  const small = str(d.size) === "small";
  const size = small ? 13 : 14;
  const w = num(d.w, withIcons ? 420 : small ? 190 : 340);
  const h = num(d.h, withIcons ? 350 : small ? 120 : 210);
  const iconW = 124;
  const iconH = 86;
  const boxH = size + 14;
  const labelW = Math.max(52, ...stages.map((s) => textWidth(s, size) + 18));
  const nodeH = withIcons ? iconH + 6 + boxH : boxH;
  const nodeW = withIcons ? Math.max(iconW, labelW) : labelW;
  const centres = layout(n, w, h, nodeW / 2 + 4, nodeH / 2 + 4);
  const nodes: Node[] = centres.map(([cx, cy]) => ({ cx, cy, w: nodeW, h: nodeH }));
  const parts: string[] = [];

  const edgeList: [number, number][] = Array.isArray(d.edges)
    ? list(d.edges).map((e) => [num(list(e)[0], 0), num(list(e)[1], 0)])
    : stages.map((_, i) => [i, (i + 1) % n]);
  for (const [a, b] of edgeList) {
    const A = nodes[a];
    const B = nodes[b];
    if (!A || !B || a === b) continue;
    const [sx, sy] = boxExit(A.cx, A.cy, A.w, A.h, B.cx - A.cx, B.cy - A.cy, 5);
    const [ex, ey] = boxExit(B.cx, B.cy, B.w, B.h, A.cx - B.cx, A.cy - B.cy, 5);
    parts.push(arrow(sx, sy, ex, ey, { head: 9, width: 1.9 }));
  }

  const alt: string[] = [];
  nodes.forEach((nd, i) => {
    const iconName = icons[i];
    const isBlank = blanks.has(i) || !stages[i];
    const boxW = isBlank ? Math.max(labelW, 72) : textWidth(stages[i], size, 600) + 18;
    let by = nd.cy - boxH / 2;
    if (withIcons) {
      if (iconName) {
        const art = fit(drawIcon(iconName), iconW, iconH);
        parts.push(place(art, nd.cx - iconW / 2, nd.cy - nodeH / 2));
      }
      by = nd.cy + nodeH / 2 - boxH;
    }
    parts.push(rect(nd.cx - boxW / 2, by, boxW, boxH, { rx: 8, fill: PAPER, stroke: INK, "stroke-width": 1.8 }));
    if (!isBlank) parts.push(text(nd.cx, by + boxH / 2, stages[i], { size, weight: 600 }));
    const pic = iconName ? ` (${drawIcon(iconName).alt})` : "";
    alt.push(isBlank ? `[blank box]${pic}` : `${stages[i]}${pic}`);
  });

  const title = str(d.title);
  if (title) parts.push(text(w / 2, h / 2, title, { size: 15, weight: 700 }));
  const custom = Array.isArray(d.edges);
  const order = custom ? edgeList.map(([a, b]) => `${alt[a]} → ${alt[b]}`).join("; ") : `${alt.join(" → ")} → back to ${alt[0]}`;
  return { w, h, body: parts.join(""), alt: `${title ? `${title}: ` : ""}a life cycle diagram with arrows: ${order}.` };
};
