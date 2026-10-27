// picture (Chinese picture-word questions): icons placed on a square canvas in percent.
// { w, h (print size, aspect only), items: [{ type: "icon", id, x, y, w } | { type: "clock", x, y, w, time } |
//   { type: "arrow", x1, y1, x2, y2 }] }
import { drawIcon } from "../icons.ts";
import { arrow, list, num, obj, place, str, type Renderer } from "../svg.ts";

export const picture: Renderer = (d) => {
  const W = 240;
  const H = Math.round((W * num(d.h, 38)) / num(d.w, 38));
  const sx = W / 100;
  const sy = H / 100;
  const parts: string[] = [];
  const alt: string[] = [];
  for (const it of list(d.items).map(obj)) {
    const type = str(it.type);
    if (type === "arrow") {
      parts.push(arrow(num(it.x1, 0) * sx, num(it.y1, 0) * sy, num(it.x2, 0) * sx, num(it.y2, 0) * sy, { head: 12, width: 3 }));
      alt.push("an arrow");
      continue;
    }
    const art = drawIcon(type === "clock" ? "alarm_clock" : str(it.id), it);
    const s = (num(it.w, 50) * sx) / art.w;
    parts.push(place(art, num(it.x, 0) * sx, num(it.y, 0) * sy, s));
    alt.push(art.alt);
  }
  return { w: W, h: H, body: parts.join(""), alt: `A picture: ${alt.join(", ")}.` };
};
