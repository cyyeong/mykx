// SAM 3.1 via the Responses API (streamed), parsed with @meta-sam/parser, cut out with sharp.
import { decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import sharp from "sharp";
import { SAM_MODEL, callSignal, createMetaClient, pickRequestId } from "./client.ts";
import { MetaApiError } from "./errors.ts";
import { assertStandardModel } from "./guard.ts";
import { type MaskRaster, type Size, alphaBox, alphaCoverage, applyAlpha, fillHoles, frameSizeFromRawOutput, masksToAlpha, selectMasks } from "./mask.ts";
import { toImageBytes, toImageUrl } from "./media.ts";
import { type RunFields, startRun } from "./run.ts";
import type { CallOptions, ImageInput, PixelBox, RunInfo } from "./types.ts";

export interface SamSegmentRequest {
  image: ImageInput;
  /** A short, common noun phrase naming one concept, e.g. "plush toy". Not a command or question. */
  prompt: string;
  /** Ask for per-mask confidence (`metadata.include_confidence`). Default true. */
  includeConfidence?: boolean;
  /** `metadata.mask_encoding`. Unset uses the API default (lossless). */
  maskEncoding?: "lossless" | "one_bit";
  /** Default `sam-3.1`. */
  model?: string;
}

export interface SamSegmentResult {
  masks: MaskRaster[];
  /** The frame size SAM reported (box `w`/`h`), or null when nothing matched. */
  frame: Size | null;
  /** Parser outcome: `completed`, or `incomplete:<reason>`. */
  outcome: string;
  run: RunInfo;
}

export interface CutoutOptions {
  /** "best" keeps the most confident (then largest) match; "union" keeps all. Default "best". */
  select?: "best" | "union";
  /** Edge softening in pixels (Gaussian). Default 1; 0 for a hard edge. */
  featherPx?: number;
  /** Transparent margin kept around the subject when cropping. Default 8. */
  paddingPx?: number;
  /** Crop to the subject. Default true; false keeps the full frame. */
  crop?: boolean;
  /** Fill holes the subject encloses (e.g. a scarf SAM left out). Default true. */
  fillHoles?: boolean;
}

export interface CutoutResult {
  /** Transparent PNG bytes. */
  png: Buffer;
  width: number;
  height: number;
  /** Crop box in source-image pixels. */
  box: PixelBox;
  /** Fraction of the source image covered by the chosen mask(s), before feathering. */
  coverage: number;
}

interface SamEvent {
  readonly type: string;
  readonly response?: { id?: string; usage?: Record<string, unknown> | null } | null;
}

/** Segments one image with a text prompt. Zero matches is a successful call with `masks: []`. */
export async function samSegment(req: SamSegmentRequest, options: CallOptions = {}): Promise<SamSegmentResult> {
  const model = assertStandardModel(req.model ?? SAM_MODEL);
  const metadata: Record<string, string> = {};
  if (req.includeConfidence !== false) metadata.include_confidence = "true";
  if (req.maskEncoding) metadata.mask_encoding = req.maskEncoding;
  const body = {
    model,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: req.prompt },
          { type: "input_image", image_url: await toImageUrl(req.image) },
        ],
      },
    ],
    stream: true,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };

  const client = createMetaClient({ maxRetries: options.maxRetries });
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("sam_segment", model);
  const fields: RunFields = { images: 1 };
  try {
    const { data: stream, response } = await client
      .post<AsyncIterable<SamEvent>>("/responses", { body, stream: true, signal })
      .withResponse();
    fields.requestId = pickRequestId(response.headers);

    async function* tap(): AsyncGenerator<SamEvent> {
      for await (const event of stream) {
        if (event.response) {
          fields.responseId ??= event.response.id ?? null;
          const usage = event.response.usage;
          if (usage) {
            if (typeof usage.input_tokens === "number") fields.inputTokens = usage.input_tokens;
            if (typeof usage.output_tokens === "number") fields.outputTokens = usage.output_tokens;
          }
        }
        yield event;
      }
    }

    const result = await parseImageStream(tap()).finalResult;
    const masks: MaskRaster[] = recordsOfKind(result.records, "mask").map((record) => ({
      objectId: record.objectId,
      bounds: { ...record.bounds },
      width: record.mask.width,
      height: record.mask.height,
      raster: decodeMaskToRaster(record.mask),
      confidence: record.confidence ?? null,
    }));
    const { outcome } = result;
    return {
      masks,
      frame: frameSizeFromRawOutput(result.rawOutput),
      outcome: outcome.status === "completed" ? "completed" : `incomplete:${outcome.reason}`,
      run: clock.finish(fields),
    };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}

/**
 * Applies masks as the alpha channel of `image` and returns a transparent PNG (offline; no API call).
 * `frame` is the size SAM saw; pass null when it is the image's own size.
 */
export async function cutoutFromMasks(
  image: Uint8Array,
  masks: readonly MaskRaster[],
  frame: Size | null,
  options: CutoutOptions = {},
): Promise<CutoutResult> {
  const { data, info } = await sharp(image).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const size = { width: info.width, height: info.height };
  const chosen = selectMasks(masks, options.select ?? "best");
  const painted = masksToAlpha(chosen, frame ?? size, size);
  const hard = options.fillHoles === false ? painted : fillHoles(painted, size);
  const coverage = alphaCoverage(hard);
  const box = options.crop === false ? { left: 0, top: 0, right: size.width, bottom: size.height } : alphaBox(hard, size, options.paddingPx ?? 8);
  if (!box || coverage === 0) throw new RangeError("mask is empty: nothing to cut out");

  const featherPx = options.featherPx ?? 1;
  const alpha =
    featherPx > 0
      ? new Uint8Array(
          await sharp(hard, { raw: { width: size.width, height: size.height, channels: 1 } })
            .blur(Math.max(0.3, featherPx * 0.6))
            .extractChannel(0)
            .raw()
            .toBuffer(),
        )
      : hard;

  const rgba = applyAlpha(data, alpha);
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const png = await sharp(rgba, { raw: { width: size.width, height: size.height, channels: 4 } })
    .extract({ left: box.left, top: box.top, width, height })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, width, height, box, coverage };
}

/**
 * Image + noun phrase -> transparent PNG of the matched subject.
 * The image is normalised to an upright PNG before it is sent, so SAM's frame matches the pixels.
 * Throws MetaApiError with code `no_match` when SAM finds nothing.
 */
export async function samCutout(
  req: SamSegmentRequest & CutoutOptions,
  options: CallOptions = {},
): Promise<CutoutResult & { masks: number; run: RunInfo }> {
  const source = await toImageBytes(req.image, options.signal);
  const upright = await sharp(source).rotate().png().toBuffer();
  const seg = await samSegment({ ...req, image: upright }, options);
  if (seg.masks.length === 0) {
    throw new MetaApiError(`SAM found no "${req.prompt}" in the image (${seg.outcome})`, {
      status: null,
      code: "no_match",
      run: { ...seg.run, ok: false, error: `no_match: ${seg.outcome}` },
    });
  }
  const cut = await cutoutFromMasks(upright, seg.masks, seg.frame, req);
  return { ...cut, masks: seg.masks.length, run: seg.run };
}
