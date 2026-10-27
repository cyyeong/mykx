// Critter eyes for blinking: finds each eye on a life-cycle sprite sheet (4 stages in a row) with SAM 3.1 and writes
// public/art/living/critters.json with, per stage, the eye boxes in percent of a stage tile and the skin colour
// just above each eye (the eyelid's colour). A tile shows one cell at background-size 400% auto, centred
// vertically, with aspect ratio 172 / 150 (the Critter Lab board's .cl-tile).
//
//   node --env-file=.env.local scripts/critter-eyes.ts      (about $0.0025 per sheet)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { samSegment } from "../lib/meta/index.ts";

const SHEETS = { frog: "public/art/critters/frog-life-cycle.webp", mealworm: "public/art/critters/mealworm-life-cycle.webp" };
const TILE_ASPECT = 172 / 150;
const r1 = (v: number) => Math.round(v * 10) / 10;

if (import.meta.main) {
  const root = join(import.meta.dirname, "..");
  const out: Record<string, { stage: number; x: number; y: number; w: number; h: number; lid: string }[]> = {};
  for (const [id, src] of Object.entries(SHEETS)) {
    const png = await sharp(readFileSync(join(root, src))).png().toBuffer();
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height;
    const seg = await samSegment({ image: png, prompt: "eye" });
    const sx = W / (seg.frame?.width ?? W), sy = H / (seg.frame?.height ?? H);
    const bgH = 4 / (W / H); // sheet height in tile widths at background-size 400% auto
    const tileH = 1 / TILE_ASPECT;
    out[id] = seg.masks
      .map((m) => ({ left: m.bounds.left * sx, top: m.bounds.top * sy, right: m.bounds.right * sx, bottom: m.bounds.bottom * sy }))
      .filter((b) => b.right - b.left < W / 16) // eyes, not whole critters
      .map((b) => {
        const stage = Math.min(3, Math.floor(((b.left + b.right) / 2 / W) * 4));
        // Skin round the eye (a ring, skipping the cream background and the dark pupil): the eyelid colour.
        let rr = 0, gg = 0, bb = 0, n = 0;
        const pad = Math.max(3, Math.round((b.right - b.left) * 0.45));
        for (let y = Math.max(0, Math.round(b.top) - pad); y < Math.min(H, Math.round(b.bottom) + pad); y++)
          for (let x = Math.max(0, Math.round(b.left) - pad); x < Math.min(W, Math.round(b.right) + pad); x++) {
            if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) continue;
            const p = (y * W + x) * 3;
            const max = Math.max(data[p], data[p + 1], data[p + 2]), min = Math.min(data[p], data[p + 1], data[p + 2]);
            if ((max > 228 && max - min < 30) || max < 40) continue;
            rr += data[p]; gg += data[p + 1]; bb += data[p + 2]; n++;
          }
        if (n < 12) return null;
        const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
        const toTileY = (y: number) => ((y / H) * bgH - (bgH - tileH) / 2) / tileH;
        return {
          stage,
          x: r1(((b.left / W) * 4 - stage) * 100),
          y: r1(toTileY(b.top) * 100),
          w: r1(((b.right - b.left) / W) * 4 * 100),
          h: r1((toTileY(b.bottom) - toTileY(b.top)) * 100),
          lid: `#${hex(rr)}${hex(gg)}${hex(bb)}`,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null && e.x >= 0 && e.x + e.w <= 100)
      .sort((a, b) => a.stage - b.stage || a.x - b.x);
    console.log(`${id}: ${out[id].length} eyes`, out[id].map((e) => `s${e.stage}@${e.x},${e.y} ${e.lid}`).join(" "));
  }
  writeFileSync(join(root, "public/art/living/critters.json"), JSON.stringify(out, null, 2) + "\n");
}
