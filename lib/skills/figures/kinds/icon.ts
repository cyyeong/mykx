// icon: one schematic picture, fitted to w×h, with an optional caption.
// { icon, w, h, params?, caption? }
import { drawIcon } from "../icons.ts";
import { num, obj, place, str, text, type Drawing, type Renderer, type Spec } from "../svg.ts";

/** Fit a drawing into a w×h box (centred, aspect kept). */
export function fit(d: Drawing, w: number, h: number): Drawing {
  const s = Math.min(w / d.w, h / d.h);
  return { w, h, body: place(d, (w - d.w * s) / 2, (h - d.h * s) / 2, s), alt: d.alt };
}

/** Specs give icon sizes from the source's print layout; drawn this much larger they stay clear on a phone. */
const ICON_SCALE = 1.3;

export const icon: Renderer = (d: Spec) => {
  const name = str(d.icon) || str(d.id);
  const art = drawIcon(name, obj(d.params));
  const w = num(d.w, art.w) * ICON_SCALE;
  const h = num(d.h, art.h) * ICON_SCALE;
  const fitted = fit(art, w, h);
  const caption = str(d.caption);
  if (!caption) return fitted;
  return {
    w,
    h: h + 24,
    body: fitted.body + text(w / 2, h + 13, caption, { size: 14, weight: 700 }),
    alt: `${caption}: ${art.alt}`,
  };
};
