// row: diagrams side by side, each with a bold caption under it. { items: [diagram…], captions[], gap }
import { list, num, obj, place, str, text, type Renderer } from "../svg.ts";

export const row: Renderer = (d, ctx) => {
  const items = list(d.items).map((x) => ctx.render(obj(x)));
  const captions = list(d.captions).map((c) => str(c));
  const gap = num(d.gap, 24);
  const hasCaps = captions.some(Boolean);
  const h = Math.max(0, ...items.map((i) => i.h));
  let x = 0;
  const parts: string[] = [];
  const alt: string[] = [];
  items.forEach((it, i) => {
    parts.push(place(it, x, h - it.h));
    if (captions[i]) parts.push(text(x + it.w / 2, h + 14, captions[i], { size: 15, weight: 700 }));
    alt.push(captions[i] ? `${captions[i]}: ${it.alt}` : it.alt);
    x += it.w + gap;
  });
  return { w: Math.max(0, x - gap), h: h + (hasCaps ? 26 : 0), body: parts.join(""), alt: alt.join(" ") };
};
