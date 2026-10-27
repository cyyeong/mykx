// flowchart: a yes/no key. { start, steps: [{ q, side, out }], end }
// Each question sends one answer (`side`) right to a lettered box; the other answer goes down.
import { INK, PAPER, arrow, list, obj, pill, rect, str, text, textBlock, wrap, type Renderer } from "../svg.ts";

const flip = (s: string) => (/^yes$/i.test(s) ? "No" : /^no$/i.test(s) ? "Yes" : "");

export const flowchart: Renderer = (d) => {
  const start = str(d.start);
  const steps = list(d.steps).map(obj);
  const end = str(d.end);
  const W = 400;
  const qx = 14;
  const qw = 250;
  const cx = qx + qw / 2;
  const ox = 336;
  const ow = 48;
  const gapY = 38;
  const parts: string[] = [];
  const alt: string[] = [`A flowchart that starts at "${start}".`];

  const s = pill(cx, 20, start, { size: 14, weight: 600, padX: 16, padY: 7, r: 16 });
  parts.push(s.body);
  let y = 20 + s.h / 2;

  steps.forEach((step, i) => {
    const q = str(step.q);
    const side = str(step.side, "Yes");
    const out = str(step.out);
    const lines = wrap(q, qw - 24, 13.5);
    const bh = Math.max(40, lines.length * 18 + 16);
    parts.push(arrow(cx, y, cx, y + gapY));
    if (i > 0) parts.push(text(cx + 8, y + gapY / 2, flip(str(steps[i - 1].side, "Yes")), { size: 12.5, anchor: "start", weight: 600 }));
    y += gapY;
    parts.push(rect(qx, y, qw, bh, { rx: 8, fill: PAPER, stroke: INK, "stroke-width": 1.8 }));
    parts.push(textBlock(cx, y + bh / 2, lines, { size: 13.5 }));
    const my = y + bh / 2;
    parts.push(arrow(qx + qw, my, ox, my));
    parts.push(text((qx + qw + ox) / 2, my - 11, side, { size: 12.5, weight: 600 }));
    parts.push(pill(ox + ow / 2, my, out, { size: 15, weight: 700, minW: ow, padY: 8 }).body);
    alt.push(`"${q}" ${side} → ${out}.`);
    y += bh;
  });

  parts.push(arrow(cx, y, cx, y + gapY));
  if (steps.length) parts.push(text(cx + 8, y + gapY / 2, flip(str(steps[steps.length - 1].side, "Yes")), { size: 12.5, anchor: "start", weight: 600 }));
  y += gapY;
  const e = pill(cx, y + 17, end, { size: 15, weight: 700, minW: ow, padY: 8 });
  parts.push(e.body);
  alt.push(`Otherwise → ${end}.`);
  return { w: W, h: y + e.h + 4, body: parts.join(""), alt: alt.join(" ") };
};
