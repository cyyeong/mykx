// Meta Model API client for myKx. Server-side only (route handlers and Node scripts).
// See .agents/skills/meta-model-api/SKILL.md.
export {
  DEFAULT_SPARK_MODEL,
  META_BASE_URL,
  MUSE_IMAGE_MODEL,
  REQUEST_ID_HEADERS,
  SAM_MODEL,
  callSignal,
  createMetaClient,
  hasMetaApiKey,
  pickRequestId,
} from "./client.ts";
export { MetaApiError, MetaConfigError, redactSecrets } from "./errors.ts";
export { ContributorModelError, assertStandardModel } from "./guard.ts";
export { museImageEdit } from "./image.ts";
export type { ImageOutputFormat, MuseImageEditRequest, MuseImageResult } from "./image.ts";
export { alphaBox, alphaCoverage, applyAlpha, maskArea, masksToAlpha, selectMasks } from "./mask.ts";
export type { MaskRaster, Size } from "./mask.ts";
export { bytesToDataUrl, sniffImageMime, toImageBytes, toImageUrl } from "./media.ts";
export { PRICES, estimateCostUsd } from "./pricing.ts";
export type { ModelPrice, UsageForCost } from "./pricing.ts";
export { cutoutFromMasks, samCutout, samSegment } from "./sam.ts";
export type { CutoutOptions, CutoutResult, SamSegmentRequest, SamSegmentResult } from "./sam.ts";
export { SchemaBuildError, jsonSchemaResponseFormat, parseStructuredText, zodToJsonSchema } from "./schema.ts";
export type { JsonSchema, JsonSchemaResponseFormat, StructuredParse } from "./schema.ts";
export { sparkChat, sparkStream, sparkStructured } from "./spark.ts";
export type {
  SparkChatResult,
  SparkMessage,
  SparkReasoningEffort,
  SparkRequest,
  SparkStream,
  SparkStructuredRequest,
  SparkStructuredResult,
} from "./spark.ts";
export type { CallOptions, ImageInput, MetaOperation, PixelBox, RunInfo } from "./types.ts";
