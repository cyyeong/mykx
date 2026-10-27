// Living art: cut the parts of a background that should move out of the art itself, so each can move by its
// kind (docs/design/living-scenes.md, "Living art"). For each recipe it asks SAM 3.1 once per part, keeps each
// instance (the biggest few) or their union as a cropped transparent WebP, and writes public/art/living/<art>.json
// with every layer's box in percent of the art. Parts that only light up (water flow, shimmer, glints, neon) are
// saved as white-on-alpha masks. Neon line masks come from the art's own bright, saturated pixels (no model).
// A recipe can also build a plate: the art with the sky filled in behind parts that move a lot (floating islands,
// so nothing ghosts behind them); the plate is drawn first, under every layer.
//
//   node --env-file=.env.local scripts/living-art.ts [art…] [--sheet <dir>]
//
// About $0.0025 per part (SAM 3.1). Every file goes in public/art/manifest.json (AGENTS.md rule 6). Re-running
// replaces an art's layers.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { cutoutFromMasks, maskArea, masksToAlpha, samSegment, type MaskRaster } from "../lib/meta/index.ts";

export type Motion = "sway" | "waver" | "breeze" | "mist" | "haze" | "bob" | "float" | "orbit" | "flow" | "shimmer" | "glint" | "runway" | "neon" | "flicker" | "pulse" | "sky" | "twinkle" | "aurora" | "stream";
const MASK_ONLY: ReadonlySet<Motion> = new Set(["breeze", "flow", "shimmer", "glint", "runway", "neon", "flicker", "pulse", "sky", "twinkle", "aurora", "stream"]);

/** A circle in fractions of the art: centre x of the width, y of the height, radius r of the width. */
interface Circle {
  x: number;
  y: number;
  r: number;
}
type PixelTest = "neon" | "luma" | "chroma" | "cool" | "white" | "warm";

interface Part {
  id: string;
  /** Noun phrases tried in turn until SAM finds something. */
  prompt: string | string[];
  /** "waver" instances wider than tall become "breeze" (a light sweep, no skew), so lawns and island tops stay put. */
  motion: Motion;
  /** Keep up to this many instances as separate layers (each moves on its own); unset: one union layer. */
  each?: number;
  /** Join each instance to the overlapping piece of this earlier part (a chest rides on its island), not a layer of its own. */
  attach?: string;
  /** false: segment only, to limit or exclude pixel layers (a window that bounds the city lights). */
  layer?: boolean;
}
/** A layer found from the art's own pixels where SAM has no word for it (painted nebula, haze, neon tubes). */
interface PixelPart {
  id: string;
  motion: Motion;
  /** neon: bright (use with `below`, where only the lines are bright). luma: bright and soft (clouds, haze).
   *  chroma: colourful (comet trails, ribbons). white: near-white points (stars). warm: lantern and chest glow. */
  test: PixelTest;
  /** Cut a display layer into this many strips across, so the pieces drift on their own. */
  split?: number;
  /** Only look below this fraction of the height (e.g. a floor under the horizon), or above one (a sky). */
  below?: number;
  above?: number;
  /** Only inside, or only outside, a circle (a vortex core and the stars around it). */
  within?: Circle;
  hole?: Circle;
  /** Leave out what these SAM parts cover (the clouds behind the islands are not the islands), or keep only that. */
  exclude?: string[];
  inside?: string[];
  /** Where an orbit layer turns, in percent of the art. */
  center?: { x: number; y: number };
}
interface Recipe {
  art: string;
  src: string;
  parts: Part[];
  pixels?: PixelPart[];
  /** Fill the art in behind these parts from what surrounds them (sigma: fill blur; grow: px added round the parts). */
  plate?: { under: string[]; sigma: number; grow: number };
}

export const RECIPES: Recipe[] = [
  {
    art: "terrarium",
    src: "public/art/scenes/terrarium.webp",
    parts: [
      { id: "fern", prompt: "fern", motion: "sway", each: 6 },
      { id: "grass", prompt: ["reeds", "grass"], motion: "waver", each: 6 },
      { id: "pond", prompt: "pond water", motion: "shimmer" },
      { id: "dew", prompt: "water droplet", motion: "glint" },
    ],
  },
  {
    art: "space",
    src: "public/art/games/space.webp",
    parts: [
      { id: "planet", prompt: "planet", motion: "bob", each: 2 },
    ],
    pixels: [
      { id: "cloud", motion: "haze", test: "luma" },
      { id: "cloudflow", motion: "sky", test: "luma" },
      { id: "comet", motion: "aurora", test: "chroma" },
      { id: "stars", motion: "twinkle", test: "white", split: 3 },
    ],
  },
  {
    art: "neon-arena",
    src: "public/art/games/neon-arena.webp",
    parts: [],
    pixels: [
      { id: "neon", motion: "neon", test: "neon", below: 0.53 },
      { id: "haze", motion: "haze", test: "luma" },
    ],
  },
  {
    art: "quest-map",
    src: "public/art/scenes/quest-map.webp",
    parts: [
      { id: "waterfall", prompt: "waterfall", motion: "flow", each: 3 },
      { id: "cloud", prompt: "cloud", motion: "mist", each: 8 },
      { id: "grass", prompt: "grass", motion: "waver", each: 8 },
      { id: "crystal", prompt: ["crystal tree", "crystals", "gemstone"], motion: "glint" },
      { id: "stones", prompt: "glowing stepping stone", motion: "runway" },
    ],
  },
  {
    art: "treasure-vault",
    src: "public/art/scenes/treasure-vault.webp",
    parts: [
      { id: "island", prompt: ["floating island", "floating rock island"], motion: "float", each: 8 },
      { id: "chest", prompt: "treasure chest", motion: "float", attach: "island" },
    ],
    pixels: [
      { id: "aurora", motion: "haze", test: "cool", above: 0.5, exclude: ["island"] },
      { id: "cloud", motion: "haze", test: "luma", exclude: ["island"] },
      { id: "glow", motion: "flicker", test: "warm", split: 4 },
    ],
    plate: { under: ["island"], sigma: 40, grow: 8 },
  },
  {
    art: "squadron-banner",
    src: "public/art/jets/squadron-banner.webp",
    parts: [
      { id: "jet", prompt: ["toy airplane", "airplane", "jet"], motion: "float", each: 4 },
      { id: "trail", prompt: ["colorful smoke trail", "smoke trail"], motion: "mist", each: 4 },
      { id: "cloud", prompt: "cloud", motion: "mist", each: 6 },
    ],
    plate: { under: ["jet"], sigma: 36, grow: 8 },
  },
  {
    art: "study-room",
    src: "public/art/scenes/study-room.webp",
    parts: [
      { id: "plant", prompt: ["potted plant", "plant"], motion: "sway", each: 5 },
      { id: "window", prompt: "window", motion: "sky", layer: false },
      { id: "sky", prompt: "sky", motion: "sky" },
    ],
    pixels: [{ id: "lights", motion: "flicker", test: "warm", split: 3, inside: ["window"], exclude: ["sky"] }],
  },
  {
    art: "city-twilight",
    src: "public/art/login/city-twilight.webp",
    parts: [
      { id: "plant", prompt: ["lavender plants", "grass"], motion: "waver", each: 4 },
      { id: "water", prompt: ["canal water", "water"], motion: "shimmer" },
      { id: "sky", prompt: "sky", motion: "sky", layer: false },
    ],
    pixels: [
      { id: "aurora", motion: "haze", test: "cool", above: 0.45, inside: ["sky"] },
      { id: "aurorashine", motion: "aurora", test: "cool", above: 0.45, inside: ["sky"] },
      { id: "stars", motion: "twinkle", test: "white", above: 0.45, split: 3, inside: ["sky"] },
      { id: "lights", motion: "flicker", test: "warm", split: 4 },
    ],
  },
  {
    art: "city-neon",
    src: "public/art/login/city-neon.webp",
    parts: [{ id: "sky", prompt: "sky", motion: "sky", layer: false }],
    pixels: [
      { id: "trails", motion: "stream", test: "chroma", below: 0.25 },
      { id: "beams", motion: "haze", test: "luma", above: 0.45, inside: ["sky"] },
      { id: "stars", motion: "twinkle", test: "white", above: 0.4, split: 3, inside: ["sky"] },
      { id: "windows", motion: "flicker", test: "warm", split: 4 },
    ],
  },
  {
    art: "transform-vortex",
    src: "public/art/scenes/transform-vortex.webp",
    parts: [],
    pixels: [
      { id: "stars", motion: "orbit", test: "white", hole: { x: 0.5, y: 0.498, r: 0.1 }, center: { x: 50, y: 49.8 } },
      { id: "core", motion: "pulse", test: "luma", within: { x: 0.5, y: 0.498, r: 0.1 } },
    ],
  },
];

export interface Layer {
  id: string;
  motion: Motion;
  src: string;
  /** Box in percent of the art. */
  x: number;
  y: number;
  w: number;
  h: number;
  mask: boolean;
  /** Turning point for an orbit layer, in percent of the art. */
  ox?: number;
  oy?: number;
}

const pct = (v: number, of: number) => Math.round((v / of) * 10000) / 100;

const ramp = (v: number) => Math.min(1, Math.max(0, v));
const PIXEL_TESTS: Record<PixelTest, (max: number, spread: number, r: number, b: number) => number> = {
  neon: (max) => ramp((max - 120) / 70),
  luma: (max, spread) => ramp((max - 165) / 50) * ramp((95 - spread) / 40),
  chroma: (max, spread) => ramp((max - 150) / 50) * ramp((spread - 60) / 50),
  cool: (max, spread, r, b) => ramp((max - 150) / 50) * ramp((spread - 50) / 50) * ramp((b - r + 40) / 40),
  white: (max, spread) => ramp((max - 190) / 40) * ramp((50 - spread) / 25),
  warm: (_max, _spread, r, b) => ramp((r - 175) / 50) * ramp((r - b - 45) / 45),
};

/** One channel blurred, kept as one channel (sharp turns a blurred grey image back into RGB otherwise). */
const blur1 = (buf: Uint8Array, width: number, height: number, sigma: number) =>
  sharp(buf, { raw: { width, height, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();

/** The art with alpha from a pixel test (soft-edged), full frame. */
async function pixelLayer(png: Buffer, part: PixelPart, excluded: Uint8Array | null): Promise<{ rgba: Buffer; alpha: Buffer }> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const alpha = Buffer.alloc(W * H);
  const below = part.below ?? 0;
  const startRow = Math.round(below * H);
  const from = startRow * W;
  const fadeRows = below > 0 ? H * 0.08 : 0;
  const inside = (c: Circle, i: number) => Math.hypot((i % W) / W - c.x, (Math.floor(i / W) - c.y * H) / W) <= c.r;
  const to = part.above ? Math.round(part.above * H) * W : alpha.length;
  for (let i = from, p = from * 3; i < to; i++, p += 3) {
    if ((part.within && !inside(part.within, i)) || (part.hole && inside(part.hole, i))) continue;
    const max = Math.max(data[p], data[p + 1], data[p + 2]);
    const fade = fadeRows ? ramp((Math.floor(i / W) - startRow) / fadeRows) : 1;
    const keep = excluded ? 1 - excluded[i] / 255 : 1;
    alpha[i] = Math.round(PIXEL_TESTS[part.test](max, max - Math.min(data[p], data[p + 1], data[p + 2]), data[p], data[p + 2]) * fade * keep * 255);
  }
  const soft = await blur1(alpha, W, H, part.test === "neon" ? 0.8 : 3);
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, p = 0; i < soft.length; i++, p += 3) {
    rgba[i * 4] = data[p];
    rgba[i * 4 + 1] = data[p + 1];
    rgba[i * 4 + 2] = data[p + 2];
    rgba[i * 4 + 3] = soft[i];
  }
  return { rgba, alpha: soft };
}

/**
 * The art with the region under `under` filled in from its surroundings (normalised blur: only pixels outside the
 * region feed the fill), so a part can move off its painted spot without a ghost of itself showing behind.
 */
async function buildPlate(png: Buffer, under: Uint8Array, W: number, H: number, sigma: number, grow: number): Promise<Buffer> {
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const grownSoft = await blur1(under, W, H, Math.max(0.5, grow / 2));
  const hole = Buffer.alloc(W * H);
  for (let i = 0; i < hole.length; i++) hole[i] = grownSoft[i] > 12 ? 255 : 0;
  const edge = await blur1(hole, W, H, 2);
  const weight = Buffer.alloc(W * H);
  const premult = Buffer.alloc(W * H * 3);
  for (let i = 0; i < weight.length; i++) {
    weight[i] = 255 - hole[i];
    for (let c = 0; c < 3; c++) premult[i * 3 + c] = Math.round((data[i * 3 + c] * weight[i]) / 255);
  }
  const A = await sharp(premult, { raw: { width: W, height: H, channels: 3 } }).blur(sigma).raw().toBuffer();
  const B = await blur1(weight, W, H, sigma);
  const wide = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).blur(sigma * 2).raw().toBuffer();
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < weight.length; i++) {
    const m = edge[i] / 255;
    for (let c = 0; c < 3; c++) {
      const fill = B[i] > 3 ? Math.min(255, (A[i * 3 + c] * 255) / B[i]) : wide[i * 3 + c];
      out[i * 3 + c] = Math.round(data[i * 3 + c] * (1 - m) + fill * m);
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

/** Keeps the alpha of a cutout and paints it white (masks only need alpha; white compresses best). */
async function whiteMask(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let p = 0; p < data.length; p += 4) data[p] = data[p + 1] = data[p + 2] = 255;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function run(recipe: Recipe, root: string, manifest: Record<string, unknown>[], sheetDir: string | null): Promise<number> {
  const upright = await sharp(readFileSync(join(root, recipe.src))).rotate().png().toBuffer();
  const meta = await sharp(upright).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const outDir = join(root, "public/art/living", recipe.art);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const layers: Layer[] = [];
  /** Full-frame alpha of each part (union of its kept pieces), for exclusions and the plate. */
  const alphas = new Map<string, Uint8Array>();
  const addAlpha = (id: string, a: Uint8Array) => {
    const cur = alphas.get(id) ?? new Uint8Array(W * H);
    for (let i = 0; i < cur.length; i++) if (a[i] > cur[i]) cur[i] = a[i];
    alphas.set(id, cur);
  };
  let calls = 0;

  const save = async (id: string, motion: Motion, png: Buffer, box: { left: number; top: number; right: number; bottom: number }, prompt: string, model: string, center?: { x: number; y: number }) => {
    const mask = MASK_ONLY.has(motion);
    const webp = await sharp(mask ? await whiteMask(png) : png).webp({ quality: 78, alphaQuality: mask ? 70 : 90, effort: 5 }).toBuffer();
    const rel = `public/art/living/${recipe.art}/${id}.webp`;
    writeFileSync(join(root, rel), webp);
    layers.push({ id, motion, src: `/${rel.replace(/^public\//, "")}`, x: pct(box.left, W), y: pct(box.top, H), w: pct(box.right - box.left, W), h: pct(box.bottom - box.top, H), mask, ...(center ? { ox: center.x, oy: center.y } : {}) });
    manifest.push({
      id: `living-${recipe.art}-${id}`,
      path: rel,
      kind: mask ? "mask" : "layer",
      model,
      pack: null,
      prompt,
      refs: [recipe.src],
      route: "scripts/living-art.ts",
      sha256: createHash("sha256").update(webp).digest("hex"),
      size: webp.length,
      created: new Date().toISOString().slice(0, 10),
      note: `Living art: ${motion} layer cut from ${recipe.art}.`,
    });
  };

  // Segment every part first (so a later part can join an earlier one's pieces), then cut the layers.
  const plans: { part: Part; used: string; frame: Awaited<ReturnType<typeof samSegment>>["frame"]; groups: MaskRaster[][] }[] = [];
  for (const part of recipe.parts) {
    let seg: Awaited<ReturnType<typeof samSegment>> | null = null;
    let used = "";
    for (const prompt of [part.prompt].flat()) {
      calls++;
      seg = await samSegment({ image: upright, prompt });
      used = prompt;
      if (seg.masks.length) break;
    }
    if (!seg) continue;
    // Separate instances must be big enough to see move; a union (dew, stepping stones) keeps every small piece.
    const min = part.each ? W * H * 0.0015 : 0;
    const found = seg.masks.filter((m) => maskArea(m) * ((W * H) / ((seg.frame?.width ?? W) * (seg.frame?.height ?? H))) >= min);
    console.log(`${recipe.art}/${part.id} ("${used}"): ${seg.masks.length} found, ${found.length} kept`);
    if (!found.length) continue;
    if (part.attach) {
      const host = plans.find((pl) => pl.part.id === part.attach);
      const overlap = (a: MaskRaster, b: MaskRaster) =>
        Math.max(0, Math.min(a.bounds.right, b.bounds.right) - Math.max(a.bounds.left, b.bounds.left)) * Math.max(0, Math.min(a.bounds.bottom, b.bounds.bottom) - Math.max(a.bounds.top, b.bounds.top));
      let joined = 0;
      for (const m of found) {
        const best = host?.groups.map((g, gi) => ({ gi, o: Math.max(...g.map((h) => overlap(h, m))) })).sort((a, b) => b.o - a.o)[0];
        if (host && best && best.o > 0) {
          host.groups[best.gi].push(m);
          joined++;
        }
      }
      console.log(`  ${joined} joined to ${part.attach}`);
      continue;
    }
    plans.push({
      part,
      used,
      frame: seg.frame,
      groups: part.each ? [...found].sort((a, b) => maskArea(b) - maskArea(a)).slice(0, part.each).map((m) => [m]) : [found],
    });
  }
  for (const { part, used, frame, groups } of plans) {
    if (part.layer === false) {
      for (const group of groups) addAlpha(part.id, masksToAlpha(group, frame ?? { width: W, height: H }, { width: W, height: H }));
      continue;
    }
    for (const [i, group] of groups.entries()) {
      const cut = await cutoutFromMasks(upright, group, frame, { select: "union", featherPx: 1.5, paddingPx: 4, fillHoles: part.motion !== "glint" });
      addAlpha(part.id, masksToAlpha(group, frame ?? { width: W, height: H }, { width: W, height: H }));
      const wide = cut.box.right - cut.box.left > 1.6 * (cut.box.bottom - cut.box.top);
      await save(part.each ? `${part.id}-${i + 1}` : part.id, part.motion === "waver" && wide ? "breeze" : part.motion, cut.png, cut.box, used, "sam-3.1");
    }
  }
  for (const part of recipe.pixels ?? []) {
    let excluded: Uint8Array | null = null;
    for (const id of part.exclude ?? []) {
      const a = alphas.get(id);
      if (!a) continue;
      excluded ??= new Uint8Array(W * H);
      for (let i = 0; i < a.length; i++) if (a[i] > excluded[i]) excluded[i] = a[i];
    }
    if (part.inside) {
      const keep = new Uint8Array(W * H);
      for (const id of part.inside) {
        const a = alphas.get(id);
        if (a) for (let i = 0; i < a.length; i++) if (a[i] > keep[i]) keep[i] = a[i];
      }
      excluded ??= new Uint8Array(W * H);
      for (let i = 0; i < keep.length; i++) excluded[i] = Math.max(excluded[i], 255 - keep[i]);
    }
    const { rgba, alpha } = await pixelLayer(upright, part, excluded);
    addAlpha(part.id, alpha);
    const n = part.split ?? 1;
    // Crop to the rows that hold anything (a floor mask is only the bottom half), so the layer stays small.
    let top = H, bottom = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 4) if (rgba[(y * W + x) * 4 + 3] > 8) { top = Math.min(top, y); bottom = y + 1; break; }
    if (bottom <= top) continue;
    for (let i = 0; i < n; i++) {
      const left = Math.round((W * i) / n), right = Math.round((W * (i + 1)) / n);
      const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
      await save(n > 1 ? `${part.id}-${i + 1}` : part.id, part.motion, png, { left, top, right, bottom }, `${part.test} pixels (threshold, no model)`, "none (sharp threshold)", part.center);
    }
  }

  let plate: string | undefined;
  if (recipe.plate) {
    const under = new Uint8Array(W * H);
    for (const id of recipe.plate.under) {
      const a = alphas.get(id);
      if (a) for (let i = 0; i < a.length; i++) if (a[i] > under[i]) under[i] = a[i];
    }
    const webp = await sharp(await buildPlate(upright, under, W, H, recipe.plate.sigma, recipe.plate.grow)).webp({ quality: 80, effort: 5 }).toBuffer();
    const rel = `public/art/living/${recipe.art}/plate.webp`;
    writeFileSync(join(root, rel), webp);
    plate = `/${rel.replace(/^public\//, "")}`;
    manifest.push({
      id: `living-${recipe.art}-plate`,
      path: rel,
      kind: "plate",
      model: "none (normalised blur fill)",
      pack: null,
      prompt: `${recipe.art} with ${recipe.plate.under.join(", ")} filled in from the surrounding art`,
      refs: [recipe.src],
      route: "scripts/living-art.ts",
      sha256: createHash("sha256").update(webp).digest("hex"),
      size: webp.length,
      created: new Date().toISOString().slice(0, 10),
      note: `Living art: base plate for ${recipe.art}, drawn under the moving layers.`,
    });
  }

  writeFileSync(join(root, "public/art/living", `${recipe.art}.json`), JSON.stringify({ art: recipe.art, src: recipe.src, width: W, height: H, ...(plate ? { plate } : {}), layers }, null, 2) + "\n");

  if (sheetDir) {
    const scale = 900 / W;
    const tint: Record<Motion, string> = { twinkle: "#FFFFFF", aurora: "#7FFFD4", stream: "#FF1493", sky: "#87CEEB", float: "#FF8C00", orbit: "#E0FFFF", flicker: "#FFB347", pulse: "#FFFFFF", sway: "#3CB371", waver: "#9ACD32", breeze: "#ADFF2F", haze: "#D8BFD8", mist: "#B0C4DE", bob: "#FFA500", flow: "#00BFFF", shimmer: "#40E0D0", glint: "#FFD700", runway: "#FF69B4", neon: "#FF00FF" };
    const overlays = await Promise.all(
      layers.map(async (l) => {
        const w = Math.max(1, Math.round((l.w / 100) * W * scale)), h = Math.max(1, Math.round((l.h / 100) * H * scale));
        const alpha = await sharp(join(root, "public", l.src)).resize(w, h).extractChannel(3).toBuffer();
        const fill = await sharp({ create: { width: w, height: h, channels: 3, background: tint[l.motion] } }).joinChannel(await sharp(alpha).linear(0.55, 0).toBuffer()).png().toBuffer();
        return { input: fill, left: Math.round((l.x / 100) * W * scale), top: Math.round((l.y / 100) * H * scale) };
      }),
    );
    mkdirSync(sheetDir, { recursive: true });
    await sharp(upright).resize(900).composite(overlays).jpeg({ quality: 80 }).toFile(join(sheetDir, `living-${recipe.art}.jpg`));
  }
  console.log(`${recipe.art}: ${layers.length} layers`);
  return calls;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const sheetAt = args.indexOf("--sheet");
  const sheetDir = sheetAt > -1 ? args[sheetAt + 1] : null;
  const wanted = args.filter((a, i) => !a.startsWith("--") && (sheetAt < 0 || i !== sheetAt + 1));
  const root = join(import.meta.dirname, "..");
  const manifestPath = join(root, "public/art/manifest.json");
  const recipes = RECIPES.filter((r) => !wanted.length || wanted.includes(r.art));
  const kept = (JSON.parse(readFileSync(manifestPath, "utf8")) as { id: string }[]).filter((e) => !recipes.some((r) => e.id.startsWith(`living-${r.art}-`)));
  const added: Record<string, unknown>[] = [];
  let calls = 0;
  for (const r of recipes) calls += await run(r, root, added, sheetDir);
  writeFileSync(manifestPath, JSON.stringify([...kept, ...added], null, 2) + "\n");
  console.log(`${added.length} files, ${calls} SAM calls (≈ $${(calls * 0.0025).toFixed(4)}).`);
}
