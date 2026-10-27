// Sidekick Studio transform (server only): Muse Image restyles Kix for the child's world, then
// SAM 3.1 cuts it out: the body ("plush toy") and each accessory in parallel, unioned when they
// touch the body. Any failure or the deadline returns a fallback; the demo never waits on it.
import { join } from "node:path";
import sharp from "sharp";
import type { PackId } from "@/components/theme/packs";
import { type MaskRaster, type RunInfo, cutoutFromMasks, maskArea, museImageEdit, samSegment } from "@/lib/meta";
import { buildTransformPrompt } from "./prompt";

export const TRANSFORM_DEADLINE_MS = 35_000;
const KIX_BASE = join(process.cwd(), "public/art/kix/kix-base.webp");

export type TransformResult =
  | { ok: true; webp: Buffer; ms: { edit: number; cutout: number; total: number }; accessoriesFound: string[]; runs: RunInfo[] }
  | { ok: false; reason: string; runs: RunInfo[] };

type Box = MaskRaster["bounds"];

/** True when `a` overlaps `b` grown by `margin` × b's width. */
export function touches(a: Box, b: Box, margin = 0.05): boolean {
  const m = margin * (b.right - b.left);
  return a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;
}

/** The biggest mask: the edit sometimes adds a smaller copy of Kix, and we want the main one. */
export function largestMask(masks: readonly MaskRaster[]): MaskRaster | null {
  return masks.reduce<MaskRaster | null>((best, m) => (!best || maskArea(m) > maskArea(best) ? m : best), null);
}

export async function runTransform(
  pack: PackId,
  interests: readonly string[],
  deadlineMs = TRANSFORM_DEADLINE_MS,
): Promise<TransformResult> {
  const t0 = Date.now();
  const left = () => deadlineMs - (Date.now() - t0);
  const runs: RunInfo[] = [];
  const { prompt, bodyNoun, accessoryNouns } = buildTransformPrompt(pack, interests);
  try {
    const edit = await museImageEdit(
      { prompt, images: KIX_BASE, size: "1024x1024", n: 1, outputFormat: "png", reasoningStrength: "low" },
      { timeoutMs: Math.max(5_000, left() - 6_000), maxRetries: 0 },
    );
    runs.push(edit.run);
    const tEdit = Date.now() - t0;
    const png = await sharp(edit.images[0]).png().toBuffer();

    const nouns = [bodyNoun, ...accessoryNouns];
    const found = await Promise.allSettled(nouns.map((noun) => samSegment({ image: png, prompt: noun }, { timeoutMs: Math.max(3_000, left()), maxRetries: 0 })));
    for (const r of found) if (r.status === "fulfilled") runs.push(r.value.run);

    const bodyResult = found[0];
    const body = bodyResult.status === "fulfilled" ? largestMask(bodyResult.value.masks) : null;
    if (!body || bodyResult.status !== "fulfilled") return { ok: false, reason: "SAM found no Kix in the image", runs };

    const accessoriesFound: string[] = [];
    const extras = found.slice(1).flatMap((r, i) => {
      if (r.status !== "fulfilled") return [];
      const near = r.value.masks.filter((m) => touches(m.bounds, body.bounds));
      if (near.length) accessoriesFound.push(accessoryNouns[i]);
      return near;
    });
    const cut = await cutoutFromMasks(png, [body, ...extras], bodyResult.value.frame, { select: "union", featherPx: 1, paddingPx: 12 });
    const webp = await sharp(cut.png).resize({ width: 800, height: 800, fit: "inside" }).webp({ quality: 88, alphaQuality: 90 }).toBuffer();
    const total = Date.now() - t0;
    return { ok: true, webp, ms: { edit: tEdit, cutout: total - tEdit, total }, accessoriesFound, runs };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: Date.now() - t0 >= deadlineMs ? `deadline: ${reason}` : reason, runs };
  }
}
