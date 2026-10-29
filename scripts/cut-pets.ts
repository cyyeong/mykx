// Cuts the Pets lab's art out of its plain backgrounds with SAM 3.1 and publishes it to public/art/pets, with a
// manifest entry for each file (rule 6). Sources are Muse Image renders in art-src/pets (gen-image.mjs; the stage
// sprites are edits of the life-cycle sheets in public/art/critters, so they match the Critter Lab). Each sprite
// tries its nouns in turn; "union" keeps every match of every noun (a hatching chick and its shell, a cloud of flies).
// Where SAM finds nothing, or less than `min` of the frame (one oat of a heap), the plain background is flood-filled
// away from the edges instead (no model), and the manifest says so.
//   node --env-file=.env.local scripts/cut-pets.ts [name …]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { cutoutFromMasks, samSegment } from "../lib/meta/sam.ts";
import type { MaskRaster } from "../lib/meta/mask.ts";

type Cut = { name: string; nouns: string[]; union?: boolean; min?: number };

const SPRITES: Cut[] = [
  { name: "frog-0", nouns: ["frogspawn", "jelly", "eggs"], union: true },
  { name: "frog-1", nouns: ["tadpole"] },
  { name: "frog-2", nouns: ["frog"] },
  { name: "frog-3", nouns: ["frog"] },
  { name: "mealworm-0", nouns: ["eggs", "egg"], union: true },
  { name: "mealworm-1", nouns: ["larva", "worm", "caterpillar"] },
  { name: "mealworm-2", nouns: ["pupa", "larva", "grub", "worm"] },
  { name: "mealworm-3", nouns: ["beetle"] },
  { name: "butterfly-0", nouns: ["leaf", "eggs"], union: true, min: 0.1 },
  { name: "butterfly-1", nouns: ["caterpillar"] },
  { name: "butterfly-2", nouns: ["chrysalis", "twig"], union: true, min: 0.06 },
  { name: "butterfly-3", nouns: ["butterfly"] },
  { name: "chicken-0", nouns: ["egg"] },
  { name: "chicken-1", nouns: ["chick", "eggshell", "egg"], union: true },
  { name: "chicken-2", nouns: ["chick"] },
  { name: "chicken-3", nouns: ["chicken", "hen"] },
  { name: "food-algae", nouns: ["algae", "plant"] },
  { name: "food-lettuce", nouns: ["lettuce", "leaf"] },
  { name: "food-flies", nouns: ["fly", "insect"], union: true },
  { name: "food-cricket", nouns: ["cricket", "insect"] },
  { name: "food-bran", nouns: ["oats", "pile"], min: 0.08 },
  { name: "food-carrot", nouns: ["carrot slice", "carrot"] },
  { name: "food-apple", nouns: ["apple slice", "apple"] },
  { name: "food-leaves", nouns: ["leaves", "plant"], min: 0.08 },
  { name: "food-flower", nouns: ["flower"] },
  { name: "food-crumbs", nouns: ["crumbs", "pile"] },
  { name: "food-corn", nouns: ["corn", "pile"] },
  { name: "food-greens", nouns: ["kale", "leaves", "lettuce"], min: 0.08 },
];
/** Habitats: the chosen render of each pair, published as a background with an 800 px variant. */
const HABITATS: Record<string, string> = { pond: "hab-pond-1", tub: "hab-tub-1", garden: "hab-garden-2", coop: "hab-coop-1" };

const root = join(import.meta.dirname, "..");
const SRC = join(root, "art-src/pets");
const OUT = "public/art/pets";
const sources = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8")) as { id: string; prompt: string; refs?: string[] }[];
const sourceOf = (name: string) => sources.find((s) => s.id === name || s.id === `${name}-1`) ?? null;
/** Removes a plain background: pixels joined to the border whose colour is close to the corners' become clear. */
async function floodCut(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const at = (x: number, y: number) => (y * W + x) * 3;
  const corners = [at(2, 2), at(W - 3, 2), at(2, H - 3), at(W - 3, H - 3)];
  const bg = [0, 1, 2].map((c) => corners.reduce((s, i) => s + data[i + c], 0) / corners.length);
  const near = (i: number) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) < 22;
  const clear = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (clear[p] || !near(p * 3)) continue;
    clear[p] = 1;
    const x = p % W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (p >= W) stack.push(p - W);
    if (p < W * (H - 1)) stack.push(p + W);
  }
  const alpha = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = clear[p] ? 0 : 255;
  let [x0, y0, x1, y1] = [W, H, 0, 0];
  for (let p = 0; p < W * H; p++) {
    if (clear[p]) continue;
    const x = p % W;
    const y = (p - x) / W;
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  const soft = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).blur(1).toColourspace("b-w").raw().toBuffer();
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    rgba[p * 4] = data[p * 3];
    rgba[p * 4 + 1] = data[p * 3 + 1];
    rgba[p * 4 + 2] = data[p * 3 + 2];
    rgba[p * 4 + 3] = soft[p];
  }
  const pad = 6;
  const left = Math.max(0, x0 - pad);
  const top = Math.max(0, y0 - pad);
  return sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left, top, width: Math.min(W, x1 + pad + 1) - left, height: Math.min(H, y1 + pad + 1) - top })
    .png()
    .toBuffer();
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const today = new Date().toISOString().slice(0, 10);
const entries: Record<string, unknown>[] = [];
const wanted = process.argv.slice(2);
let calls = 0;

for (const cut of SPRITES.filter((c) => !wanted.length || wanted.includes(c.name))) {
  const png = await sharp(join(SRC, `${cut.name}.webp`)).png().toBuffer();
  const masks: MaskRaster[] = [];
  let frame = null;
  let used = "";
  for (const noun of cut.nouns) {
    const seg = await samSegment({ image: png, prompt: noun });
    calls++;
    if (!seg.masks.length) continue;
    masks.push(...seg.masks);
    frame ??= seg.frame;
    used = used ? `${used} + ${noun}` : noun;
    if (!cut.union) break;
  }
  let cutPng: Buffer;
  let by: string;
  const out = masks.length ? await cutoutFromMasks(png, masks, frame, { select: cut.union ? "union" : "best", featherPx: 1, paddingPx: 6 }) : null;
  if (out && out.coverage >= (cut.min ?? 0.03)) {
    cutPng = out.png;
    by = `sam-3.1 ("${used}"${cut.union ? ", union" : ""})`;
  } else {
    cutPng = await floodCut(png);
    by = `none (plain background flood-filled; sam-3.1 ${out ? `found only ${(out.coverage * 100).toFixed(1)}%` : "found nothing"})`;
  }
  const webp = await sharp(cutPng).resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 84, alphaQuality: 90 }).toBuffer();
  const path = `${OUT}/${cut.name}.webp`;
  writeFileSync(join(root, path), webp);
  const src = sourceOf(cut.name);
  entries.push({ id: `pets-${cut.name}`, path, kind: "sprite", model: "muse-image-1.0", pack: "terrarium", prompt: src?.prompt ?? "", refs: src?.refs ?? [], route: "api-script (gen-image.mjs)", sha256: sha(webp), size: webp.length, created: today, cut_by: by, source: `art-src/pets/${cut.name}.webp` });
  console.log(`${cut.name}: ${by}`);
}

if (!wanted.length || wanted.includes("habitats")) {
  for (const [id, name] of Object.entries(HABITATS)) {
    const src = join(SRC, `${name}.webp`);
    const big = await sharp(src).resize(1600).webp({ quality: 78 }).toBuffer();
    const small = await sharp(src).resize(800).webp({ quality: 76 }).toBuffer();
    const path = `${OUT}/hab-${id}.webp`;
    writeFileSync(join(root, path), big);
    writeFileSync(join(root, `${OUT}/hab-${id}-800.webp`), small);
    const s = sourceOf(name);
    entries.push({ id: `pets-hab-${id}`, path, variants: [`${OUT}/hab-${id}-800.webp`], kind: "background", model: "muse-image-1.0", pack: "terrarium", prompt: s?.prompt ?? "", refs: [], route: "api-script (gen-image.mjs)", sha256: sha(big), size: big.length, created: today, source: `art-src/pets/${name}.webp` });
  }
}

const manifestPath = join(root, "public/art/manifest.json");
const ids = new Set(entries.map((e) => e.id));
const manifest = (JSON.parse(readFileSync(manifestPath, "utf8")) as { id: string }[]).filter((e) => !ids.has(e.id));
writeFileSync(manifestPath, JSON.stringify([...manifest, ...entries], null, 2) + "\n");
console.log(`${entries.length} files, ${calls} SAM calls (≈ $${(calls * 0.0025).toFixed(4)}).`);
