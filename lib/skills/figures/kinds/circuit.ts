// circuit: a circuit diagram with standard symbols.
// { battery: { cells }, series: [{ switch, closed } | { bulb } | { box }], parallel?: [[{ bulb }…]…] }
// The battery and series parts sit on the main loop; each parallel branch is its own rung.
import { INK, PAPER, circle, line, list, num, obj, rect, str, text, textWidth, type Renderer, type Spec } from "../svg.ts";

type Comp = { kind: "battery"; cells: number } | { kind: "switch"; label: string; closed: boolean } | { kind: "bulb"; label: string } | { kind: "box"; label: string };

function toComp(c: Spec): Comp {
  if ("switch" in c) return { kind: "switch", label: str(c.switch), closed: c.closed !== false };
  if ("bulb" in c) return { kind: "bulb", label: str(c.bulb) };
  if ("box" in c) return { kind: "box", label: str(c.box) };
  return { kind: "box", label: str(Object.values(c)[0]) };
}

const width = (c: Comp) => (c.kind === "battery" ? c.cells * 16 : c.kind === "switch" ? 40 : c.kind === "bulb" ? 28 : Math.max(84, textWidth(c.label, 12) + 18));
const WIRE = { stroke: INK, "stroke-width": 1.8 };

function drawComp(c: Comp, x: number, y: number, labelBelow: boolean): string {
  const ly = labelBelow ? y + 26 : y - 26;
  switch (c.kind) {
    case "battery": {
      let out = "";
      for (let i = 0; i < c.cells; i++) {
        const a = x + i * 16 + 2;
        out += line(a, y - 15, a, y + 15, { stroke: INK, "stroke-width": 1.8 }) + line(a + 7, y - 8, a + 7, y + 8, { stroke: INK, "stroke-width": 4.5 });
        out += line(i === 0 ? x : a - 7, y, a, y, WIRE);
        if (i < c.cells - 1) out += line(a + 7, y, a + 14, y, WIRE);
      }
      return out + line(x + c.cells * 16 - 5, y, x + c.cells * 16, y, WIRE);
    }
    case "switch": {
      const lever = c.closed ? line(x + 5, y, x + 35, y, { stroke: INK, "stroke-width": 2.4 }) : line(x + 5, y, x + 33, y - 15, { stroke: INK, "stroke-width": 2.4 });
      return line(x, y, x + 5, y, WIRE) + line(x + 35, y, x + 40, y, WIRE) + lever + circle(x + 5, y, 2.8, { fill: INK }) + circle(x + 35, y, 2.8, { fill: INK }) + (c.label ? text(x + 20, ly, c.label, { size: 13.5, weight: 700 }) : "");
    }
    case "bulb": {
      const cx = x + 14;
      const k = 12 * Math.SQRT1_2;
      return (
        circle(cx, y, 12, { fill: PAPER, stroke: INK, "stroke-width": 1.8 }) +
        line(cx - k, y - k, cx + k, y + k, { stroke: INK, "stroke-width": 1.4 }) +
        line(cx - k, y + k, cx + k, y - k, { stroke: INK, "stroke-width": 1.4 }) +
        (c.label ? text(cx, ly, c.label, { size: 13.5, weight: 700 }) : "")
      );
    }
    case "box": {
      const w = width(c);
      return rect(x, y - 15, w, 30, { rx: 5, fill: PAPER, stroke: INK, "stroke-width": 1.8 }) + text(x + w / 2, y, c.label, { size: 12 });
    }
  }
}

/** Components spread evenly along a horizontal wire from xa to xb. */
function wireRow(comps: Comp[], xa: number, xb: number, y: number, labelBelow: boolean): string {
  const total = comps.reduce((s, c) => s + width(c), 0);
  const gap = (xb - xa - total) / (comps.length + 1);
  let x = xa;
  let out = "";
  for (const c of comps) {
    out += line(x, y, x + gap, y, WIRE);
    x += gap;
    out += drawComp(c, x, y, labelBelow);
    x += width(c);
  }
  return out + line(x, y, xb, y, WIRE);
}

const describe = (c: Comp) =>
  c.kind === "battery" ? `a battery of ${c.cells} ${c.cells === 1 ? "cell" : "cells"}` : c.kind === "switch" ? `switch ${c.label} (${c.closed ? "closed" : "open"})` : c.kind === "bulb" ? `bulb ${c.label}` : `a ${c.label}`;

export const circuit: Renderer = (d) => {
  const battery: Comp = { kind: "battery", cells: Math.max(1, Math.round(num(obj(d.battery).cells, 1))) };
  const series = list(d.series).map(obj).map(toComp);
  const branches = list(d.parallel).map((b) => list(b).map(obj).map(toComp));
  const main = [battery, ...series];
  const W = 380;
  const xl = 30;
  const xr = W - 30;
  const top = 44;
  const parts: string[] = [];
  let H: number;
  if (branches.length) {
    parts.push(wireRow(main, xl, xr, top, false));
    const rows = branches.map((_, i) => top + 76 * (i + 1));
    const last = rows[rows.length - 1];
    parts.push(line(xl, top, xl, last, WIRE), line(xr, top, xr, last, WIRE));
    branches.forEach((b, i) => {
      parts.push(wireRow(b, xl, xr, rows[i], true));
      if (i < branches.length - 1) parts.push(circle(xl, rows[i], 3.4, { fill: INK }), circle(xr, rows[i], 3.4, { fill: INK }));
    });
    H = last + 40;
  } else {
    const k = Math.ceil(main.length / 2);
    const bottom = top + 112;
    parts.push(wireRow(main.slice(0, k), xl, xr, top, false));
    if (main.length > k) parts.push(wireRow(main.slice(k).reverse(), xl, xr, bottom, true));
    else parts.push(line(xl, bottom, xr, bottom, WIRE));
    parts.push(line(xl, top, xl, bottom, WIRE), line(xr, top, xr, bottom, WIRE));
    H = bottom + 40;
  }
  const alt = `A circuit with ${main.map(describe).join(", ")} in the main loop${branches.length ? `, and ${branches.length} parallel branches: ${branches.map((b) => b.map(describe).join(" and ")).join("; ")}` : ""}.`;
  return { w: W, h: H, body: parts.join(""), alt };
};
