// Shared types for the Meta Model API client. Type-only module.

export type MetaOperation = "chat" | "chat_stream" | "structured" | "image_edit" | "sam_segment" | "transcribe";

/**
 * One model call, shaped to become a `model_runs` row.
 * Holds no prompt, output or key, so it is safe to log and show in "under the hood".
 */
export interface RunInfo {
  provider: "meta";
  operation: MetaOperation;
  model: string;
  /** Request id from the HTTP response headers, when the API sends one. */
  requestId: string | null;
  /** Id from the response body (`chatcmpl-…`, `resp_…`), when present. */
  responseId: string | null;
  /** ISO timestamp taken just before the request was sent. */
  startedAt: string;
  /** Request start to last byte, in milliseconds. */
  latencyMs: number;
  /** Request start to first text delta (streams only). */
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  /** Images returned (Muse Image) or segmented (SAM 3.1). */
  images: number | null;
  /** Billed audio seconds (Muse Voice Transcribe, whole seconds rounded down). */
  audioSeconds: number | null;
  /** Estimate from the price table in `pricing.ts`; null when the model is unpriced or usage is missing. */
  costUsd: number | null;
  ok: boolean;
  /** Short, key-free error summary when `ok` is false. */
  error: string | null;
}

/** Options every call accepts. */
export interface CallOptions {
  /** Caller-owned cancellation (e.g. the route handler's `request.signal`). */
  signal?: AbortSignal;
  /** Abort after this many milliseconds. Combined with `signal` when both are given. */
  timeoutMs?: number;
  /** SDK-level retries on 408/409/429/5xx and connection errors. Default 2. */
  maxRetries?: number;
}

/** An image given by file path, `data:` URL, `https:` URL, or raw bytes. */
export type ImageInput = string | Uint8Array;

/** Half-open pixel box: `right` and `bottom` are exclusive. */
export interface PixelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
