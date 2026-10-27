// ring_stack: rings on an upright rod, bottom ring first; `gap` is the space below each ring.
// { rings: [{ name, gap }], faces?: [{ ring, face: "top" | "bottom", text }], rod_label, base, w }
import { INK, PAPER, SHADE, SOFT, callout, list, num, obj, rect, spread, str, text, type Renderer } from "../svg.ts";

export const ringStack: Renderer = (d) => {
  const rings = list(d.rings).map(obj);
  const faces = list(d.faces).map(obj);
  const W = Math.max(num(d.w, 280), 280);
  const ringW = 96;
  const ringH = 20;
  const cx = 104;
  const baseH = 14;
  // Heights measured upwards from the top of the base.
  const bottoms: number[] = [];
  let level = 0;
  rings.forEach((r, i) => {
    level += i === 0 ? 0 : num(r.gap, 0);
    bottoms.push(level);
    level += ringH;
  });
  const rodTop = level + 34;
  const H = rodTop + 16 + baseH + 28;
  const baseTop = H - 28 - baseH;
  const Y = (up: number) => baseTop - up;
  const parts: string[] = [];
  parts.push(rect(cx - 6, Y(rodTop), 12, rodTop, { fill: SHADE, stroke: INK, "stroke-width": 1.6 }));
  parts.push(rect(cx - 80, baseTop, 160, baseH, { rx: 2, fill: SHADE, stroke: INK, "stroke-width": 1.8 }));
  const alt: string[] = [];
  rings.forEach((r, i) => {
    const y = Y(bottoms[i] + ringH);
    parts.push(rect(cx - ringW / 2, y, ringW, ringH, { rx: 4, fill: PAPER, stroke: INK, "stroke-width": 2 }));
    parts.push(text(cx - ringW / 2 - 14, y + ringH / 2, str(r.name), { size: 15, weight: 700 }));
    const gap = i === 0 ? 0 : num(r.gap, 0);
    alt.push(i === 0 ? `${str(r.name)} rests on the base` : gap > 0 ? `${str(r.name)} floats above ${str(rings[i - 1].name)} with a gap` : `${str(r.name)} touches ${str(rings[i - 1].name)}`);
  });

  // Labels on the right: the rod, then any named faces, spread so they never overlap.
  const labels: { y: number; px: number; py: number; s: string }[] = [];
  const rodLabel = str(d.rod_label);
  if (rodLabel) labels.push({ y: Y(rodTop - 10), px: cx + 6, py: Y(rodTop - 10), s: rodLabel });
  for (const f of faces) {
    const i = num(f.ring, 0);
    if (i < 0 || i >= rings.length) continue;
    const up = str(f.face) === "bottom" ? bottoms[i] : bottoms[i] + ringH;
    labels.push({ y: Y(up), px: cx + ringW / 2 - 6, py: Y(up), s: str(f.text) });
  }
  const ys = spread(
    labels.map((l) => l.y),
    19,
    10,
    baseTop - 8,
  );
  const lx = cx + ringW / 2 + 40;
  labels.forEach((l, i) => parts.push(callout(lx, ys[i], l.px, l.py, l.s, { size: 12.5, anchor: "start" })));
  const base = str(d.base);
  if (base) parts.push(text(cx, baseTop + baseH + 14, base, { size: 12.5, fill: SOFT }));
  const faceWords = faces.map((f) => `${str(f.text)} is the ${str(f.face)} face of ${str(rings[num(f.ring, 0)]?.name)}`);
  return {
    w: W,
    h: H,
    body: parts.join(""),
    alt: `Rings on a ${rodLabel || "rod"} standing on a ${base || "base"}, from the bottom: ${alt.join("; ")}.${faceWords.length ? ` Labels: ${faceWords.join("; ")}.` : ""}`,
  };
};
