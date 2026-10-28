// How a living tile shows one stage of a critter's life-cycle sheet (four stages left to right): the background size
// and position, and where an eye found on the plain quarter tile (public/art/living/critters.json) lands on it.
// Even sheets zoom a little into their quarter so a neighbour never peeks in; uneven ones use measured frames.
// Shared by the Critter Lab and Word Garden. Pure.
import type { Critter } from "./catalog.ts";

/** Each tile zooms a little into its own quarter of the sheet (per critter), so a neighbouring stage never peeks in. */
const zx = (z: number, i: number) => (z === 1 ? (i / 3) * 100 : ((z * (i + 0.5) - 0.5) / (4 * z - 1)) * 100);
/** An eye found on the unzoomed tile (critters.json), moved onto the zoomed one. */
const zoomed = (z: number, v: number) => z * (v - 50) + 50;

/** A stage's crop of the sheet: the background size and position, and where an eye found on the plain quarter tile
 *  (critters.json) lands on it. Even sheets zoom into their quarter; uneven ones use measured frames. */
export function stageCrop(critter: Pick<Critter, "zoom" | "frames">, i: number) {
  const frame = critter.frames?.[i];
  if (frame) {
    const [c, w] = frame;
    const left = c - w / 2;
    const k = 25 / w;
    return {
      size: (100 / w) * 100,
      pos: (left / (100 - w)) * 100,
      x: (v: number) => ((i * 25 + v / 4 - left) / w) * 100,
      y: (v: number) => (v - 50) * k + 50,
      scale: k,
    };
  }
  const z = critter.zoom ?? 1.12;
  return { size: 400 * z, pos: zx(z, i), x: (v: number) => zoomed(z, v), y: (v: number) => zoomed(z, v), scale: z };
}

