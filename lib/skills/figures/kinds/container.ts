// container: a clear box with a lid, an animal and its supplies.
// { lid: "holes" | "solid", items: ["food", "water"], animal, label, w, h }
import { drawIcon } from "../icons.ts";
import { ACCENT, INK, PAPER, SHADE, TINT, circle, list, num, path, pd, place, rect, str, text, type Renderer } from "../svg.ts";
import { fit } from "./icon.ts";

export const container: Renderer = (d) => {
  const w = num(d.w, 140);
  const h = num(d.h, 112);
  const lid = str(d.lid, "solid");
  const items = list(d.items).map((x) => str(x));
  const animal = str(d.animal);
  const bx = 8;
  const bw = w - 16;
  const top = 16;
  const label = str(d.label);
  const parts: string[] = [];
  parts.push(rect(bx, top, bw, h - top - 2, { rx: 4, fill: PAPER, stroke: INK, "stroke-width": 2 }));
  parts.push(rect(bx - 4, top - 9, bw + 8, 10, { rx: 3, fill: SHADE, stroke: INK, "stroke-width": 1.8 }));
  if (lid === "holes") for (let i = 0; i < 5; i++) parts.push(circle(bx + 14 + (i * (bw - 28)) / 4, top - 4, 2.4, { fill: PAPER, stroke: INK, "stroke-width": 1.2 }));
  if (animal) {
    const a = fit(drawIcon(animal), bw * 0.7, 40);
    parts.push(place(a, bx + (bw - a.w) / 2, top + 8));
  }
  const floor = h - 4;
  const slots = items.length;
  items.forEach((it, i) => {
    const cx = bx + (bw * (i + 0.5)) / Math.max(1, slots);
    if (it === "water") {
      parts.push(path(pd("M", cx - 18, floor - 14, "L", cx + 18, floor - 14, "L", cx + 14, floor - 2, "L", cx - 14, floor - 2, "Z"), { fill: PAPER, stroke: INK, "stroke-width": 1.5 }));
      parts.push(rect(cx - 16, floor - 12, 32, 6, { fill: TINT, stroke: "none" }));
      parts.push(path(pd("M", cx - 16, floor - 12, "L", cx + 16, floor - 12), { stroke: ACCENT, "stroke-width": 1.3 }));
    } else {
      parts.push(path(pd("M", cx - 16, floor - 4, "Q", cx - 4, floor - 22, cx + 16, floor - 10, "Q", cx, floor - 2, cx - 16, floor - 4, "Z"), { fill: SHADE, stroke: INK, "stroke-width": 1.5 }));
    }
    parts.push(text(cx, floor - 27, it, { size: 12.5 }));
  });
  const lidWords = lid === "holes" ? "a lid with holes" : "a lid without holes";
  if (label) parts.push(text(w / 2, h + 14, label, { size: 15, weight: 700 }));
  return {
    w,
    h: label ? h + 26 : h,
    body: parts.join(""),
    alt: `${label ? `${label}: ` : ""}a container with ${lidWords}${animal ? `, a ${animal}` : ""}${items.length ? `, ${items.join(" and ")}` : ""}`,
  };
};
