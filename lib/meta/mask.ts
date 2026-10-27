// Pure mask helpers: SAM rasters -> full-frame alpha -> RGBA. No I/O, unit-tested.
import type { PixelBox } from "./types.ts";

/** One decoded SAM mask. The raster covers `bounds` (frame pixels); both API examples have raster size == box size. */
export interface MaskRaster {
  objectId?: string;
  bounds: PixelBox;
  /** Raster width and height (the `data=H,W` of the mask token). */
  width: number;
  height: number;
  /** Row-major 0/1 values, `width * height` long (from `decodeMaskToRaster`). */
  raster: Uint8Array;
  confidence?: number | null;
}

export interface Size {
  width: number;
  height: number;
}

/** "best": highest confidence, then largest area. "union": every mask. */
export function selectMasks(masks: readonly MaskRaster[], mode: "best" | "union" = "best"): MaskRaster[] {
  if (mode === "union" || masks.length <= 1) return [...masks];
  let best = masks[0];
  for (const m of masks.slice(1)) {
    const a = m.confidence ?? -1;
    const b = best.confidence ?? -1;
    if (a > b || (a === b && maskArea(m) > maskArea(best))) best = m;
  }
  return [best];
}

export function maskArea(mask: MaskRaster): number {
  let n = 0;
  for (const v of mask.raster) n += v ? 1 : 0;
  return n;
}

/**
 * Paints masks into a single-channel alpha plane (0 or 255) of size `out`.
 * `frame` is the size SAM saw (the box `w`/`h`); when `out` differs, coordinates are scaled.
 * A raster smaller or larger than its box is scaled into the box (nearest neighbour).
 */
export function masksToAlpha(masks: readonly MaskRaster[], frame: Size, out: Size = frame): Uint8Array {
  const alpha = new Uint8Array(out.width * out.height);
  const sx = out.width / frame.width;
  const sy = out.height / frame.height;
  for (const mask of masks) {
    if (mask.raster.length !== mask.width * mask.height) {
      throw new RangeError(`mask raster has ${mask.raster.length} values, expected ${mask.width}x${mask.height}`);
    }
    const { left, top, right, bottom } = mask.bounds;
    const boxW = right - left;
    const boxH = bottom - top;
    if (boxW <= 0 || boxH <= 0) continue;
    const x0 = clamp(Math.floor(left * sx), 0, out.width);
    const x1 = clamp(Math.ceil(right * sx), 0, out.width);
    const y0 = clamp(Math.floor(top * sy), 0, out.height);
    const y1 = clamp(Math.ceil(bottom * sy), 0, out.height);
    for (let oy = y0; oy < y1; oy++) {
      const fy = (oy + 0.5) / sy; // pixel centre in frame space
      const ry = Math.floor(((fy - top) * mask.height) / boxH);
      if (ry < 0 || ry >= mask.height) continue;
      const rowOffset = ry * mask.width;
      for (let ox = x0; ox < x1; ox++) {
        const fx = (ox + 0.5) / sx;
        const rx = Math.floor(((fx - left) * mask.width) / boxW);
        if (rx < 0 || rx >= mask.width) continue;
        if (mask.raster[rowOffset + rx]) alpha[oy * out.width + ox] = 255;
      }
    }
  }
  return alpha;
}

/** New RGBA buffer whose alpha is the source alpha multiplied by `alpha` (0–255). */
export function applyAlpha(rgba: Uint8Array, alpha: Uint8Array): Uint8Array {
  if (rgba.length !== alpha.length * 4) throw new RangeError("rgba must have 4 bytes per alpha value");
  const out = new Uint8Array(rgba);
  for (let i = 0; i < alpha.length; i++) {
    out[i * 4 + 3] = Math.round((rgba[i * 4 + 3] * alpha[i]) / 255);
  }
  return out;
}

/** Tight box around alpha > 0, grown by `padding` and clamped to the image; null when empty. */
export function alphaBox(alpha: Uint8Array, size: Size, padding = 0): PixelBox | null {
  let left = size.width;
  let top = size.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < size.height; y++) {
    const row = y * size.width;
    for (let x = 0; x < size.width; x++) {
      if (alpha[row + x] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  return {
    left: Math.max(0, left - padding),
    top: Math.max(0, top - padding),
    right: Math.min(size.width, right + 1 + padding),
    bottom: Math.min(size.height, bottom + 1 + padding),
  };
}

/**
 * Fills background regions the subject fully encloses (holes), so thin accessories SAM leaves out
 * (a leaf scarf across the body) don't punch holes through a sticker. Background connected to the
 * image border stays transparent. Returns a new plane.
 */
export function fillHoles(alpha: Uint8Array, size: Size): Uint8Array {
  const { width, height } = size;
  if (alpha.length !== width * height) throw new RangeError("alpha must be width * height long");
  const outside = new Uint8Array(alpha.length);
  const stack: number[] = [];
  const push = (i: number) => {
    if (alpha[i] === 0 && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < alpha.length - width) push(i + width);
  }
  const out = new Uint8Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) out[i] = alpha[i] || outside[i] ? alpha[i] : 255;
  return out;
}

/** Fraction of pixels with alpha > 0. */
export function alphaCoverage(alpha: Uint8Array): number {
  if (alpha.length === 0) return 0;
  let n = 0;
  for (const v of alpha) n += v ? 1 : 0;
  return n / alpha.length;
}

/** Frame size (`w`, `h`) from the first box token in SAM's raw output text, or null. */
export function frameSizeFromRawOutput(raw: string): Size | null {
  const token = /<\|box;([^|]*)\|>/.exec(raw);
  if (!token) return null;
  const fields = new Map(
    token[1].split(";").map((pair) => {
      const [k, v] = pair.split("=");
      return [k?.trim(), v?.trim()] as const;
    }),
  );
  const width = Number(fields.get("w"));
  const height = Number(fields.get("h"));
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? { width, height } : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
