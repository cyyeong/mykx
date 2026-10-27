// germination: dishes of seeds on cotton wool. { dishes: [{ label, water: boolean, cover?: "dark", note }] }
import { ACCENT, DARK_SHADE, INK, PAPER, SHADE, SOFT, TINT, el, list, obj, path, pd, rect, str, text, textBlock, wrap, type Renderer } from "../svg.ts";

export const germination: Renderer = (d) => {
  const dishes = list(d.dishes).map(obj);
  const n = Math.max(1, dishes.length);
  const cell = n > 2 ? 106 : 150;
  const W = n * cell;
  const parts: string[] = [];
  const alt: string[] = [];
  let maxNote = 1;
  const notes = dishes.map((dish) => wrap(str(dish.note), cell - 12, 12));
  for (const l of notes) maxNote = Math.max(maxNote, l.length);
  dishes.forEach((dish, i) => {
    const cx = cell * (i + 0.5);
    const wet = dish.water === true;
    const dark = str(dish.cover) === "dark";
    const dy = 74;
    if (dark) {
      parts.push(rect(cx - 44, 26, 88, 70, { rx: 6, fill: DARK_SHADE, stroke: INK, "stroke-width": 1.6 }));
      parts.push(text(cx, 36, "dark", { size: 11, fill: INK }));
    }
    parts.push(text(cx, 12, str(dish.label), { size: 15, weight: 700 }));
    // dish (side view) with cotton wool and three seeds
    parts.push(path(pd("M", cx - 36, dy - 8, "L", cx - 32, dy + 8, "L", cx + 32, dy + 8, "L", cx + 36, dy - 8), { fill: wet ? TINT : PAPER, stroke: INK, "stroke-width": 1.8 }));
    let wool = pd("M", cx - 33, dy - 2);
    for (let k = 0; k < 6; k++) wool += " " + pd("Q", cx - 33 + k * 11 + 5.5, dy - 12, cx - 33 + (k + 1) * 11, dy - 2);
    parts.push(path(wool + " Z", { fill: PAPER, stroke: INK, "stroke-width": 1.3 }));
    for (const sx of [-16, 0, 16]) parts.push(el("ellipse", { cx: cx + sx, cy: dy - 12, rx: 5.5, ry: 3.6, fill: SHADE, stroke: INK, "stroke-width": 1.2 }));
    if (wet) parts.push(path(pd("M", cx - 31, dy + 2, "L", cx + 31, dy + 2), { stroke: ACCENT, "stroke-width": 1.2 }));
    parts.push(textBlock(cx, 112 + (notes[i].length * 15) / 2, notes[i], { size: 12, fill: SOFT }, 1.25));
    alt.push(`${str(dish.label)}: ${str(dish.note)}`);
  });
  return {
    w: W,
    h: 116 + maxNote * 15,
    body: parts.join(""),
    alt: `Dishes of seeds on cotton wool. ${alt.join("; ")}.`,
  };
};
