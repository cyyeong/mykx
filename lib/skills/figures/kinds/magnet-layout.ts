// magnet_layout: magnets placed by coordinates (y measured upwards from the bottom, as in the source).
// { w, h, magnets: [{ type: "bar", x, y, len, thick, vertical?, labels[2], parts? } |
//                   { type: "u", x, y, w, h, arm, open, labels[2] }], notes?: [{ x, y, text, anchor }] }
// Bar labels are [left, right], or [top, bottom] when vertical; "[]" is an empty answer box.
import { list, num, obj, str, text, type Renderer } from "../svg.ts";
import { barMagnet, uMagnet } from "./magnet-parts.ts";

const PAD = 12;

export const magnetLayout: Renderer = (d) => {
  const W = num(d.w, 280);
  const H = num(d.h, 160);
  const parts: string[] = [];
  const alt: string[] = [];
  for (const m of list(d.magnets).map(obj)) {
    const x = num(m.x, 0);
    const y = num(m.y, 0);
    const labels = list(m.labels).map((l) => str(l));
    const named = labels.map((l) => (l === "[]" ? "an empty box" : l || "unlabelled"));
    if (str(m.type) === "u") {
      const w = num(m.w, 100);
      const h = num(m.h, 100);
      const open = str(m.open) === "up" ? "up" : "down";
      parts.push(uMagnet(PAD + x, PAD + H - y - h, w, h, num(m.arm, 20), open, labels));
      alt.push(`a U-shaped magnet with its ends pointing ${open}, ends ${named.join(" and ")}`);
    } else {
      const len = num(m.len, 100);
      const thick = num(m.thick, 26);
      const vertical = m.vertical === true;
      const partsNames = list(m.parts).map((p) => str(p));
      parts.push(barMagnet(PAD + x, PAD + H - y - (vertical ? len : thick), len, thick, { vertical, labels, parts: partsNames }));
      alt.push(
        partsNames.length
          ? `a bar magnet divided into equal parts ${partsNames.join(", ")}`
          : `a ${vertical ? "standing" : "lying"} bar magnet with ends ${named.join(vertical ? " (top) and " : " (left) and ")}${vertical ? " (bottom)" : " (right)"}`,
      );
    }
  }
  for (const n of list(d.notes).map(obj)) {
    const anchor = str(n.anchor) === "end" ? "end" : str(n.anchor) === "start" ? "start" : "middle";
    parts.push(text(PAD + num(n.x, 0), PAD + H - num(n.y, 0), str(n.text), { size: 13.5, anchor, weight: 600 }));
  }
  return { w: W + 2 * PAD, h: H + 2 * PAD, body: parts.join(""), alt: `Magnets: ${alt.join("; ")}.` };
};
