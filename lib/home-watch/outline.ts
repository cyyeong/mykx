// Server only: Who's who (GUARDIAN §2.5). SAM 3.1 finds the children in a flagged frame and code draws each mask as
// an outline in that kid's colour (left to right, matching the Home Reader's people order). Adults aren't outlined
// or named. If SAM fails, the frame is kept as it was.
import sharp from "sharp";
import { samSegment } from "../meta/sam.ts";
import { PACK_COLOUR, type SeenPerson } from "./home-watch.ts";

export { PACK_COLOUR };

const UNKNOWN = "#FFB020";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** A 640 px WebP of the frame, with each child SAM finds outlined; `outlined` is how many it drew. */
export async function outlineChildren(bytes: Uint8Array, people: readonly SeenPerson[], colourOf: (nickname: string) => string | undefined): Promise<{ webp: Buffer; outlined: number }> {
  const png = await sharp(bytes).resize({ width: 640, withoutEnlargement: true }).png().toBuffer();
  const plain = async () => ({ webp: await sharp(png).webp({ quality: 76 }).toBuffer(), outlined: 0 });
  try {
    const { width: W = 0, height: H = 0 } = await sharp(png).metadata();
    const res = await samSegment({ image: new Uint8Array(png), prompt: "child" });
    const masks = [...res.masks].sort((a, b) => a.bounds.left - b.bounds.left).slice(0, 6);
    if (!masks.length || !W || !H) return plain();
    const children = people.filter((p) => p.who === "child");
    const fx = res.frame ? W / res.frame.width : 1;
    const fy = res.frame ? H / res.frame.height : 1;
    const rgba = Buffer.alloc(W * H * 4);
    masks.forEach((m, i) => {
      const [r, g, b] = rgb(colourOf(children[i]?.likely ?? "") ?? UNKNOWN);
      const bw = m.bounds.right - m.bounds.left;
      const bh = m.bounds.bottom - m.bounds.top;
      const inside = (x: number, y: number) => {
        const ox = x / fx - m.bounds.left;
        const oy = y / fy - m.bounds.top;
        if (ox < 0 || oy < 0 || ox >= bw || oy >= bh) return false;
        return m.raster[Math.floor((oy / bh) * m.height) * m.width + Math.floor((ox / bw) * m.width)] === 1;
      };
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!inside(x, y)) continue;
          const edge = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2);
          const k = (y * W + x) * 4;
          rgba[k] = r;
          rgba[k + 1] = g;
          rgba[k + 2] = b;
          rgba[k + 3] = edge ? 255 : 64;
        }
    });
    const overlay = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
    return { webp: await sharp(png).composite([{ input: overlay }]).webp({ quality: 76 }).toBuffer(), outlined: masks.length };
  } catch {
    return plain();
  }
}
