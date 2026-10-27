// poster: a print-style event poster for visual-text comprehension. Every word comes from the spec.
// { theme, accent, presenter, badge ("LINE1|LINE2"), corner_icon, title, tagline, facts: [{ icon, label, value }],
//   art: [{ kind, … }], art_right: [{ kind, … }], banner, boxes: [{ title, sub, icon, body }],
//   wide_box: { title, body }, footer: [] }
import { drawIcon, type IconTheme } from "../icons.ts";
import { FONT_SCALE, INK, PAPER, SHADE, SOFT, circle, list, num, obj, place, rect, str, text, textWidth, wrap, type Drawing, type Renderer, type Spec } from "../svg.ts";
import { fit } from "./icon.ts";

const W = 360;
const M = 14;
/** Baseline-to-baseline step for a font size. */
const step = (size: number, lh = 1.3) => size * FONT_SCALE * lh;
const hex = (v: unknown, dflt: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : dflt);

function artGroup(items: Spec[], th: IconTheme, maxH: number): Drawing {
  const drawn = items.map((it) => {
    const art = drawIcon(str(it.kind), it, th);
    const s = Math.min(1, (maxH * (str(it.kind) === "person" ? 1 : 0.55)) / art.h) * Math.min(1.2, num(it.scale, 1) / 1.5);
    return { art, w: art.w * s, h: art.h * s, s, lift: str(it.kind) === "moon" || str(it.kind) === "kite" ? maxH * 0.25 : 0 };
  });
  let x = 0;
  const body = drawn
    .map((d) => {
      const out = place(d.art, x, maxH - d.h - d.lift, d.s);
      x += d.w + 6;
      return out;
    })
    .join("");
  return { w: Math.max(0, x - 6), h: maxH, body, alt: drawn.map((d) => d.art.alt).join(", ") };
}

export const poster: Renderer = (d) => {
  const th: IconTheme = { main: hex(d.theme, INK), tint: hex(d.accent, SHADE) };
  const icon = (name: string, x: number, y: number, size: number) => place(fit(drawIcon(`poster_${name}`, {}, th), 24, 24), x, y, size / 24);
  const parts: string[] = [];
  const words: string[] = [];

  // Header: presenter, title, tagline, badge, key facts.
  const presenter = str(d.presenter);
  let y = 22;
  if (str(d.corner_icon)) parts.push(icon(str(d.corner_icon), M, y - 9, 18));
  parts.push(text(M + (str(d.corner_icon) ? 24 : 0), y, presenter, { size: 12.5, anchor: "start", weight: 600 }));
  const badge = str(d.badge).split("|").filter(Boolean);
  const textW = W - 2 * M - (badge.length ? 80 : 0);
  y += 16;
  const titleLines = wrap(str(d.title), textW, 25, 800);
  titleLines.forEach((l) => {
    y += step(25, 1.15);
    parts.push(text(M, y - step(25, 0.55), l, { size: 25, weight: 800, anchor: "start", fill: th.main }));
  });
  const tag = wrap(str(d.tagline), textW, 13);
  y += 4;
  tag.forEach((l) => {
    y += step(13);
    parts.push(text(M, y - step(13, 0.5), l, { size: 13, italic: true, anchor: "start" }));
  });
  if (badge.length) {
    const bx = W - M - 36;
    const by = 72;
    parts.push(circle(bx, by, 36, { fill: th.main, stroke: "none" }));
    badge.forEach((b, i) => parts.push(text(bx, by + (i - (badge.length - 1) / 2) * step(12.5, 1.25), b, { size: i === 0 ? 12 : 13, weight: 800, fill: PAPER })));
    y = Math.max(y, by + 36);
  }
  y += 18;
  for (const f of list(d.facts).map(obj)) {
    const label = `${str(f.label)}:`;
    parts.push(icon(str(f.icon), M, y - 9, 18));
    parts.push(text(M + 25, y, label, { size: 13, weight: 700, anchor: "start" }));
    parts.push(text(M + 25 + textWidth(label, 13, 700) + 5, y, str(f.value), { size: 13, anchor: "start" }));
    words.push(`${label} ${str(f.value)}`);
    y += step(13, 1.6);
  }
  const headerH = y;
  parts.unshift(rect(1, 1, W - 2, headerH, { rx: 13, fill: th.tint, stroke: "none" }) + rect(1, 16, W - 2, headerH - 15, { fill: th.tint, stroke: "none" }));

  // Art and the section banner.
  const artH = 92;
  const left = artGroup(list(d.art).map(obj), th, artH);
  const right = artGroup(list(d.art_right).map(obj), th, artH);
  const ay = headerH + 10;
  parts.push(place(left, M + 4, ay));
  parts.push(place(right, W - M - 4 - right.w, ay));
  const banner = str(d.banner);
  if (banner) {
    const bw = textWidth(banner, 16, 800) + 36;
    parts.push(rect(W / 2 - bw / 2, ay + artH / 2 - 16, bw, 32, { rx: 16, fill: th.main, stroke: "none" }));
    parts.push(text(W / 2, ay + artH / 2, banner, { size: 16, weight: 800, fill: PAPER }));
  }
  y = ay + artH + 12;

  // Activity boxes.
  const inner = W - 2 * M;
  for (const b of list(d.boxes).map(obj)) {
    const body = wrap(str(b.body), inner - 58, 12.5);
    const h = 64 + (body.length - 1) * step(12.5) + 12;
    parts.push(rect(M, y, inner, h, { rx: 10, fill: PAPER, stroke: th.main, "stroke-width": 1.6 }));
    parts.push(icon(str(b.icon), M + 10, y + 12, 28));
    parts.push(text(M + 48, y + 20, str(b.title), { size: 14.5, weight: 800, anchor: "start", fill: th.main }));
    parts.push(text(M + 48, y + 41, str(b.sub), { size: 12.5, weight: 600, anchor: "start", fill: SOFT }));
    body.forEach((l, i) => parts.push(text(M + 48, y + 64 + i * step(12.5), l, { size: 12.5, anchor: "start" })));
    words.push(`${str(b.title)} (${str(b.sub)})`);
    y += h + 8;
  }

  // Tickets / registration box.
  const wide = obj(d.wide_box);
  if (str(wide.title) || str(wide.body)) {
    const tl = wrap(str(wide.title), inner - 24, 13.5, 800);
    const bl = wrap(str(wide.body), inner - 24, 12.5);
    const h = 8 + tl.length * step(13.5, 1.25) + bl.length * step(12.5) + 12;
    parts.push(rect(M, y, inner, h, { rx: 10, fill: th.tint, stroke: th.main, "stroke-width": 1.6 }));
    tl.forEach((l, i) => parts.push(text(M + 12, y + 8 + step(13.5, 1.25) * (i + 0.5), l, { size: 13.5, weight: 800, anchor: "start" })));
    bl.forEach((l, i) => parts.push(text(M + 12, y + 12 + tl.length * step(13.5, 1.25) + step(12.5) * (i + 0.5), l, { size: 12.5, anchor: "start" })));
    y += h + 10;
  }
  for (const f of list(d.footer).map((x) => str(x))) {
    for (const l of wrap(f, inner, 12)) {
      y += step(12);
      parts.push(text(W / 2, y - step(12, 0.4), l, { size: 12, fill: SOFT }));
    }
  }
  const H = y + 12;
  parts.push(rect(1, 1, W - 2, H - 2, { rx: 14, fill: "none", stroke: th.main, "stroke-width": 2 }));
  return {
    w: W,
    h: H,
    body: parts.join(""),
    alt: `A poster: ${presenter} ${str(d.title)}. ${words.join(". ")}.`,
  };
};
