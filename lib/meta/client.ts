// Server-side Meta Model API client (OpenAI SDK pointed at api.meta.ai).
// Plain module (no `server-only`) so Node scripts can import it too. Never import it from a
// client component: it reads the API key from the environment.
import OpenAI from "openai";
import { MetaConfigError } from "./errors.ts";
import type { CallOptions } from "./types.ts";

export const META_BASE_URL = "https://api.meta.ai/v1";
export const DEFAULT_SPARK_MODEL = "muse-spark-1.3";
export const MUSE_IMAGE_MODEL = "muse-image-1.0";
export const SAM_MODEL = "sam-3.1";

/** Response headers checked, in order, for a request id. Meta's docs don't name one yet. */
export const REQUEST_ID_HEADERS = ["x-request-id", "request-id", "x-fb-request-id", "x-fb-trace-id"] as const;

function readKey(): string | undefined {
  return process.env.MODEL_API_KEY?.trim() || process.env.META_API_KEY?.trim() || undefined;
}

/** The key for hand-built requests (multipart endpoints the SDK doesn't cover). Never log it. */
export function requireMetaKey(): string {
  const apiKey = readKey();
  if (!apiKey) throw new MetaConfigError("No Meta API key: set MODEL_API_KEY (or META_API_KEY) to a Standard-mode key.");
  return apiKey;
}

/** True when `MODEL_API_KEY` (or `META_API_KEY`) is set and non-empty. */
export function hasMetaApiKey(): boolean {
  return readKey() !== undefined;
}

/** A fresh SDK client. The key is read from the environment on every call, never cached or logged. */
export function createMetaClient(options: { maxRetries?: number } = {}): OpenAI {
  const apiKey = readKey();
  if (!apiKey) {
    throw new MetaConfigError("No Meta API key: set MODEL_API_KEY (or META_API_KEY) to a Standard-mode key.");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.META_API_BASE_URL?.trim() || META_BASE_URL,
    maxRetries: options.maxRetries ?? 2,
    // Ignore any OPENAI_* org/project env so no OpenAI headers ride along.
    organization: null,
    project: null,
    logLevel: "warn",
  });
}

/** The first request-id-like header present, or null. */
export function pickRequestId(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  for (const name of REQUEST_ID_HEADERS) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

/** Combines the caller's signal with an optional timeout. `timedOut()` tells the two apart. */
export function callSignal(options: CallOptions = {}): { signal: AbortSignal | undefined; timedOut: () => boolean } {
  const signals: AbortSignal[] = [];
  if (options.signal) signals.push(options.signal);
  let timeout: AbortSignal | undefined;
  if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
    timeout = AbortSignal.timeout(options.timeoutMs);
    signals.push(timeout);
  }
  const signal = signals.length === 0 ? undefined : signals.length === 1 ? signals[0] : AbortSignal.any(signals);
  return { signal, timedOut: () => timeout?.aborted === true };
}
