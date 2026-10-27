// float_tank: equal blocks in a tank of water, each floating or sunk. { objects: [{ label, level: "float" | "sink" }] }
import { ACCENT, INK, PAPER, TINT, line, list, obj, path, pd, rect, str, text, type Renderer } from "../svg.ts";

export const floatTank: Renderer = (d) => {
  const objects = list(d.objects).map(obj);
  const n = Math.max(1, objects.length);
  const W = 380;
  const H = 176;
  const tx = 18;
  const tw = W - 36;
  const top = 18;
  const bottom = H - 6;
  const surface = 64;
  const size = 42;
  const parts: string[] = [];
  parts.push(rect(tx, surface, tw, bottom - surface, { fill: TINT, stroke: "none" }));
  parts.push(line(tx, surface, tx + tw, surface, { stroke: ACCENT, "stroke-width": 1.8 }));
  const alt: string[] = [];
  objects.forEach((o, i) => {
    const cx = tx + (tw * (i + 0.5)) / n;
    const floats = str(o.level) !== "sink";
    const y = floats ? surface - size * 0.4 : bottom - size - 2;
    parts.push(rect(cx - size / 2, y, size, size, { rx: 3, fill: PAPER, stroke: INK, "stroke-width": 2 }));
    parts.push(text(cx, y + size / 2, str(o.label), { size: 16, weight: 700 }));
    alt.push(`${str(o.label)} ${floats ? "floats" : "sinks to the bottom"}`);
  });
  parts.push(path(pd("M", tx, top, "L", tx, bottom, "L", tx + tw, bottom, "L", tx + tw, top), { fill: "none", stroke: INK, "stroke-width": 2.4 }));
  parts.push(text(tx + tw - 6, surface + 14, "water", { size: 12, anchor: "end", fill: ACCENT }));
  return { w: W, h: H, body: parts.join(""), alt: `A tank of water with ${n} blocks of the same size: ${alt.join("; ")}.` };
};
