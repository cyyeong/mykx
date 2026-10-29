// Cuts a generated double door out of its background with SAM 3.1 ("door", every match) and splits it at the seam
// into the left and right leaves the sign-in screen swings open. The door art is generated straight on with the seam
// in the centre, so the split is the middle of the cut-out.
//   node --env-file=.env.local scripts/cut-door.ts art-src/doors/door-sky-3.webp public/art/login/door-sky
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { samCutout } from "../lib/meta/sam.ts";

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error("usage: cut-door.ts <door image> <out prefix>");

const HEIGHT = 1100;
const cut = await samCutout({ image: await sharp(src).png().toBuffer(), prompt: "door", select: "union", paddingPx: 0, featherPx: 1 });
await writeFile(`${src.replace(/\.\w+$/, "")}-cut.png`, cut.png);
const img = sharp(cut.png).resize({ height: HEIGHT });
const { width = 0 } = await img.metadata().then(async () => (await img.clone().toBuffer({ resolveWithObject: true })).info);
const half = Math.round(width / 2);
const full = await img.toBuffer();
for (const [side, left, w] of [["left", 0, half], ["right", half, width - half]] as const) {
  await sharp(full).extract({ left, top: 0, width: w, height: HEIGHT }).webp({ quality: 82, alphaQuality: 90 }).toFile(`${out}-${side}.webp`);
}
console.log(`cut ${cut.width}x${cut.height} (${(cut.coverage * 100).toFixed(1)}% of the frame, ${cut.masks} mask(s)) -> ${width}x${HEIGHT}, leaves ${half} + ${width - half}`);
