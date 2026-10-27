// scene: apparatus placed on a grid in units, y measured upwards. { box: [w, h], items: [{ prim, … }], texts?: [{ x, y, text, size }] }
// prims: ground, table, spring, block, arrow, label, testtube, lamp, beaker, thermometer.
import {
  ACCENT,
  INK,
  PAPER,
  SHADE,
  TINT,
  arrow,
  callout,
  circle,
  groundLine,
  hatch,
  line,
  list,
  num,
  obj,
  path,
  pd,
  rect,
  str,
  text,
  textBlock,
  type Renderer,
  type Spec,
} from "../svg.ts";
import { zigzag } from "./spring-set.ts";

const PADX = 16;
const PADY = 8;

export const scene: Renderer = (d) => {
  const box = list(d.box).map((v) => num(v, 0));
  const bw = box[0] || 10;
  const bh = box[1] || 5;
  const S = Math.min(400 / bw, 60);
  const H = bh * S;
  const X = (x: number) => PADX + x * S;
  const Y = (y: number) => PADY + H - y * S;
  const items = list(d.items).map(obj);
  const groundY = items.find((i) => str(i.prim) === "ground");
  const floor = groundY ? num(groundY.y, 0) : 0;
  const back: string[] = [];
  const front: string[] = [];
  const labels: string[] = [];
  const alt: string[] = [];

  for (const it of items) {
    const prim = str(it.prim);
    switch (prim) {
      case "ground":
        back.push(groundLine(X(num(it.x0, 0)), X(num(it.x1, bw)), Y(num(it.y, 0))));
        break;
      case "table": {
        const x = num(it.x, 0);
        const y = num(it.y, 1);
        const w = num(it.w, 4);
        back.push(rect(X(x), Y(y), w * S, 10, { fill: SHADE, stroke: INK, "stroke-width": 1.8 }));
        back.push(rect(X(x) + 10, Y(y) + 10, 10, Y(0) - Y(y) - 10, { fill: SHADE, stroke: INK, "stroke-width": 1.6 }));
        back.push(rect(X(x + w) - 20, Y(y) + 10, 10, Y(0) - Y(y) - 10, { fill: SHADE, stroke: INK, "stroke-width": 1.6 }));
        if (str(it.label)) labels.push(text(X(x + w / 2), Y(y) + 26, str(it.label), { size: 12.5 }));
        alt.push("a table");
        break;
      }
      case "spring": {
        const y0 = num(it.y0, 0);
        const y1 = num(it.y1, 1);
        front.push(zigzag(X(num(it.x, 0)), Y(y1), Y(y0), 10, Math.max(5, Math.round(((y1 - y0) * S) / 13))));
        break;
      }
      case "block": {
        const x = num(it.x, 0);
        const y = num(it.y, 0);
        const w = num(it.w, 1);
        const h = num(it.h, 1);
        const style = str(it.hatch);
        front.push(rect(X(x), Y(y + h), w * S, h * S, { fill: PAPER, stroke: INK, "stroke-width": 1.8 }));
        if (style) front.push(hatch(X(x), Y(y + h), w * S, h * S, style.includes("x") ? "x" : style[0], style.includes(".") ? 6 : 8));
        if (style) front.push(rect(X(x), Y(y + h), w * S, h * S, { fill: "none", stroke: INK, "stroke-width": 1.8 }));
        if (str(it.label)) labels.push(text(X(x + w / 2), Y(y + h / 2), str(it.label), { size: 15, weight: 700 }));
        break;
      }
      case "arrow": {
        const t = str(it.text);
        const x0 = X(num(it.x0, 0));
        const y0 = Y(num(it.y0, 0));
        const x1 = X(num(it.x1, 1));
        const y1 = Y(num(it.y1, 0));
        front.push(arrow(x0, y0, x1, y1, { both: t === "distance", head: 9, width: 2 }));
        if (t) {
          const horizontal = Math.abs(x1 - x0) > Math.abs(y1 - y0);
          labels.push(horizontal ? text((x0 + x1) / 2, (y0 + y1) / 2 - 12, t, { size: 12.5 }) : text(Math.max(x0, x1) + 10, (y0 + y1) / 2, t, { size: 12.5, anchor: "start" }));
        }
        break;
      }
      case "label": {
        const x = X(num(it.x, 0));
        const y = Y(num(it.y, 0));
        labels.push(callout(x, y, X(num(it.tx, 0)), Y(num(it.ty, 0)), str(it.text), { size: 12.5, anchor: "middle" }));
        alt.push(str(it.text));
        break;
      }
      case "testtube":
        front.push(testTube(it, X, Y, S, floor));
        if (str(it.label)) labels.push(text(X(num(it.x, 0)), Y(num(it.y, 0) + num(it.h, 2)) - 16, str(it.label), { size: 12.5 }));
        alt.push(str(it.label) || "a test tube");
        break;
      case "lamp":
        front.push(lamp(it, X, Y, floor));
        if (str(it.label)) labels.push(text(X(num(it.x, 0)) + 6, Y(num(it.y, 0)) - 30, str(it.label), { size: 12.5 }));
        alt.push(str(it.label) || "a lamp");
        break;
      case "beaker": {
        const x = num(it.x, 0);
        const y = num(it.y, 0);
        const w = num(it.w, 2);
        const h = num(it.h, 2);
        const level = Math.max(0, Math.min(1, num(it.level, 0.5)));
        const wy = Y(y + h * level);
        front.push(rect(X(x), wy, w * S, Y(y) - wy, { fill: TINT, stroke: "none" }));
        front.push(line(X(x), wy, X(x + w), wy, { stroke: ACCENT, "stroke-width": 1.6 }));
        front.push(path(pd("M", X(x), Y(y + h), "L", X(x), Y(y), "L", X(x + w), Y(y), "L", X(x + w), Y(y + h)), { fill: "none", stroke: INK, "stroke-width": 2.2 }));
        if (str(it.label)) labels.push(text(X(x + w / 2), Y(floor) + 17, str(it.label), { size: 13, weight: 700 }));
        if (str(it.sublabel)) labels.push(text(X(x + w / 2), Y(floor) + 33, str(it.sublabel), { size: 12 }));
        alt.push([str(it.label), str(it.sublabel)].filter(Boolean).join(", ") || "a beaker of water");
        break;
      }
      case "thermometer": {
        const x = X(num(it.x, 0));
        const y = Y(num(it.y, 0));
        const top = Y(num(it.y, 0) + num(it.h, 1.5));
        front.push(rect(x - 3.5, top, 7, y - top, { rx: 3.5, fill: PAPER, stroke: INK, "stroke-width": 1.4 }));
        front.push(line(x, y, x, y - (y - top) * 0.45, { stroke: ACCENT, "stroke-width": 3 }));
        front.push(circle(x, y + 2, 5.5, { fill: ACCENT, stroke: INK, "stroke-width": 1.3 }));
        if (str(it.label)) labels.push(text(x + 10, top + 6, str(it.label), { size: 12, anchor: "start" }));
        alt.push("a thermometer");
        break;
      }
      default:
        alt.push(prim);
    }
  }
  for (const t of list(d.texts).map(obj)) {
    const size = Math.max(12, num(t.size, 9) * 1.4);
    labels.push(textBlock(X(num(t.x, 0)), Y(num(t.y, 0)), str(t.text).split("\n"), { size }, 1.2));
    alt.push(str(t.text).replace(/\n/g, " "));
  }
  return {
    w: bw * S + 2 * PADX,
    h: H + 2 * PADY + 12,
    body: back.join("") + front.join("") + labels.join(""),
    alt: `A diagram showing ${alt.filter(Boolean).join(", ")}.`,
  };
};

function testTube(it: Spec, X: (x: number) => number, Y: (y: number) => number, S: number, floor: number): string {
  const x = num(it.x, 0);
  const y = num(it.y, 0);
  const h = num(it.h, 2);
  const r = 0.28 * S;
  const cx = X(x);
  const top = Y(y + h);
  const bot = Y(y);
  const level = Math.max(0, Math.min(1, num(it.level, 0.8)));
  const wy = bot - (bot - top) * level;
  const tube = pd("M", cx - r, top, "L", cx - r, bot - r, "A", r, r, 0, 0, 0, cx + r, bot - r, "L", cx + r, top);
  let out = path(pd("M", cx - r, wy, "L", cx - r, bot - r, "A", r, r, 0, 0, 0, cx + r, bot - r, "L", cx + r, wy, "Z"), { fill: TINT, stroke: "none" });
  out += line(cx - r, wy, cx + r, wy, { stroke: ACCENT, "stroke-width": 1.4 });
  if (it.plant === true) {
    const p0 = bot - 6;
    const p1 = wy + (bot - wy) * 0.35;
    out += path(pd("M", cx, p0, "Q", cx - 3, (p0 + p1) / 2, cx + 1, p1), { fill: "none", stroke: INK, "stroke-width": 1.5 });
    for (let k = 0; k < 5; k++) {
      const yy = p0 - ((p0 - p1) * (k + 0.6)) / 5.5;
      const side = k % 2 ? 1 : -1;
      out += path(pd("M", cx, yy, "q", side * 6, -3, side * 8, -9), { fill: "none", stroke: INK, "stroke-width": 1.3 });
    }
  }
  if (it.bubbles === true) for (const [dx, dy] of [[3, 0.12], [-4, 0.22], [2, 0.32]] as const) out += circle(cx + dx, wy + (bot - wy) * dy, 2.2, { fill: PAPER, stroke: INK, "stroke-width": 1 });
  out += path(tube, { fill: "none", stroke: INK, "stroke-width": 2 });
  if (bot < Y(floor) - 6) {
    // a simple rack holds the tube above the bench
    const ry = bot - (bot - top) * 0.3;
    out += rect(cx - r - 14, ry - 4, 2 * r + 28, 8, { rx: 2, fill: SHADE, stroke: INK, "stroke-width": 1.4 });
    out += line(cx - r - 10, ry + 4, cx - r - 10, Y(floor), { stroke: INK, "stroke-width": 1.8 }) + line(cx + r + 10, ry + 4, cx + r + 10, Y(floor), { stroke: INK, "stroke-width": 1.8 });
  }
  return out;
}

function lamp(it: Spec, X: (x: number) => number, Y: (y: number) => number, floor: number): string {
  const x = X(num(it.x, 0));
  const y = Y(num(it.y, 0));
  const left = str(it.facing, "left") === "left";
  const dir = left ? -1 : 1;
  let out = line(x + 12 * -dir, y, x + 12 * -dir, Y(floor), { stroke: INK, "stroke-width": 2.4 });
  out += rect(x + 12 * -dir - 18, Y(floor) - 6, 36, 6, { rx: 2, fill: SHADE, stroke: INK, "stroke-width": 1.4 });
  out += path(pd("M", x + 14 * -dir, y - 9, "L", x + 14 * dir, y - 18, "L", x + 14 * dir, y + 18, "L", x + 14 * -dir, y + 9, "Z"), { fill: SHADE, stroke: INK, "stroke-width": 1.8 });
  if (it.on !== false)
    for (const k of [-1, 0, 1]) out += line(x + 20 * dir, y + k * 12, x + 34 * dir, y + k * 18, { stroke: INK, "stroke-width": 1.4 });
  return out;
}
