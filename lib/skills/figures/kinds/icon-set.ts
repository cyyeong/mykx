// icon_set (Chinese picture-word questions): { icons: [name…], w }. A sign such as "recycle" is drawn
// as a badge on the object before it (a bag with a recycling sign); other icons sit side by side.
import { drawIcon } from "../icons.ts";
import { list, place, str, type Drawing, type Renderer } from "../svg.ts";

const SIGNS = new Set(["recycle"]);

export const iconSet: Renderer = (d) => {
  const names = list(d.icons).map((n) => str(n)).filter(Boolean);
  const size = 200;
  const groups: { base: Drawing; signs: Drawing[] }[] = [];
  for (const n of names) {
    const art = drawIcon(n);
    if (SIGNS.has(n) && groups.length) groups[groups.length - 1].signs.push(art);
    else groups.push({ base: art, signs: [] });
  }
  const parts: string[] = [];
  const alt: string[] = [];
  groups.forEach((g, i) => {
    const s = size / Math.max(g.base.w, g.base.h);
    const x = i * (size + 20);
    parts.push(place(g.base, x, 0, s));
    g.signs.forEach((sign) => {
      const ss = (size * 0.36) / sign.w;
      parts.push(place(sign, x + size / 2 - (sign.w * ss) / 2, size * 0.62 - (sign.h * ss) / 2, ss));
    });
    alt.push(g.signs.length ? `${g.base.alt} with ${g.signs.map((s) => s.alt).join(" and ")} on it` : g.base.alt);
  });
  return { w: groups.length * (size + 20) - 20, h: size, body: parts.join(""), alt: `A picture of ${alt.join(", ")}.` };
};
