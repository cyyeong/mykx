// strength_test: a strip across two supports, loaded with bricks. { mode: "bridge", bricks, label }
import { INK, PAPER, SHADE, SOFT, callout, line, num, rect, str, text, type Renderer } from "../svg.ts";

export const strengthTest: Renderer = (d) => {
  const bricks = Math.max(0, Math.round(num(d.bricks, 3)));
  const label = str(d.label, "material");
  const W = 340;
  const strip = 112;
  const parts: string[] = [];
  parts.push(rect(40, strip + 8, 44, 58, { fill: SHADE, stroke: INK, "stroke-width": 1.8 }));
  parts.push(rect(236, strip + 8, 44, 58, { fill: SHADE, stroke: INK, "stroke-width": 1.8 }));
  parts.push(rect(30, strip, 260, 8, { fill: PAPER, stroke: INK, "stroke-width": 2 }));
  for (let i = 0; i < bricks; i++) {
    const y = strip - 20 * (i + 1);
    parts.push(rect(136, y, 48, 20, { rx: 1.5, fill: SHADE, stroke: INK, "stroke-width": 1.6 }));
    parts.push(line(160, y + (i % 2 ? 0 : 10), 160, y + (i % 2 ? 10 : 20), { stroke: INK, "stroke-width": 1 }));
  }
  if (bricks) parts.push(callout(112, strip - 10 * bricks, 136, strip - 10 * bricks, "bricks", { anchor: "end" }));
  parts.push(callout(160, strip + 40, 160, strip + 8, `strip of ${label}`, { anchor: "middle" }));
  parts.push(text(62, strip + 80, "support", { size: 12.5, fill: SOFT }));
  parts.push(text(258, strip + 80, "support", { size: 12.5, fill: SOFT }));
  return {
    w: W - 20,
    h: strip + 90,
    body: parts.join(""),
    alt: `A strip of ${label} rests across two supports with ${bricks} ${bricks === 1 ? "brick" : "bricks"} stacked on its middle.`,
  };
};
