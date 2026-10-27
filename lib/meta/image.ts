// Muse Image edits: POST /v1/images/edits with JSON `images: [{ image_url }]` (reference images).
import { MUSE_IMAGE_MODEL, callSignal, createMetaClient, pickRequestId } from "./client.ts";
import { MetaApiError } from "./errors.ts";
import { assertStandardModel } from "./guard.ts";
import { toImageBytes, toImageUrl } from "./media.ts";
import { type RunFields, startRun } from "./run.ts";
import type { CallOptions, ImageInput, RunInfo } from "./types.ts";

export type ImageOutputFormat = "webp" | "png" | "jpeg";

export interface MuseImageEditRequest {
  prompt: string;
  /** 1–10 reference images; the first is the subject to keep (e.g. kix-base). */
  images: ImageInput | ImageInput[];
  /** `"WxH"`. Sets the aspect ratio only; Meta fixes the output resolution. */
  size?: `${number}x${number}`;
  /** 1–10, default 1. Billed per returned image. */
  n?: number;
  /** Default webp. */
  outputFormat?: ImageOutputFormat;
  /** Planning effort; Meta's default is high. */
  reasoningStrength?: "low" | "high";
  /** Default `muse-image-1.0`. */
  model?: string;
}

export interface MuseImageResult {
  /** Encoded image bytes in `outputFormat`. */
  images: Buffer[];
  mimeType: string;
  revisedPrompt: string | null;
  run: RunInfo;
}

interface ImagesResponse {
  created?: number;
  data?: Array<{ b64_json?: string | null; url?: string | null; revised_prompt?: string | null }>;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
}

const MIME: Record<ImageOutputFormat, string> = { webp: "image/webp", png: "image/png", jpeg: "image/jpeg" };

/** Edits/restyles reference images with a prompt and returns the image bytes. */
export async function museImageEdit(req: MuseImageEditRequest, options: CallOptions = {}): Promise<MuseImageResult> {
  const model = assertStandardModel(req.model ?? MUSE_IMAGE_MODEL);
  const refs = Array.isArray(req.images) ? req.images : [req.images];
  if (refs.length < 1 || refs.length > 10) throw new RangeError("museImageEdit needs 1–10 reference images");
  const n = req.n ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new RangeError("n must be an integer 1–10");
  const outputFormat = req.outputFormat ?? "webp";

  const body = {
    model,
    prompt: req.prompt,
    images: await Promise.all(refs.map(async (ref) => ({ image_url: await toImageUrl(ref) }))),
    n,
    response_format: "b64_json",
    output_format: outputFormat,
    ...(req.size ? { size: req.size } : {}),
    ...(req.reasoningStrength ? { reasoning_strength: req.reasoningStrength } : {}),
  };

  const client = createMetaClient({ maxRetries: options.maxRetries });
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("image_edit", model);
  let fields: RunFields = {};
  try {
    const { data, response } = await client.post<ImagesResponse>("/images/edits", { body, signal }).withResponse();
    fields = {
      requestId: pickRequestId(response.headers),
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
    };
    const items = data.data ?? [];
    const images: Buffer[] = [];
    for (const item of items) {
      if (item.b64_json) images.push(Buffer.from(item.b64_json, "base64"));
      else if (item.url) images.push(await toImageBytes(item.url, signal));
    }
    fields.images = images.length;
    if (images.length === 0) {
      throw new MetaApiError(`image_edit (${model}) returned no images (refused or safety-filtered?)`, {
        status: null,
        code: "no_output",
        run: clock.fail(fields, "no_output: no images returned"),
      });
    }
    return {
      images,
      mimeType: MIME[outputFormat],
      revisedPrompt: items.find((i) => i.revised_prompt)?.revised_prompt ?? null,
      run: clock.finish(fields),
    };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}
