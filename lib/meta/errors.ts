import { APIConnectionError, APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";
import { ResponsesStreamError } from "@meta-sam/parser";
import type { RunInfo } from "./types.ts";

/** No API key configured, or a bad local setup. Thrown before any request is made. */
export class MetaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaConfigError";
  }
}

/**
 * A model call that failed, timed out or returned unusable output.
 * `run` is the RunInfo to log (ok: false). The message never contains the key.
 */
export class MetaApiError extends Error {
  /** HTTP status when the API answered with an error, otherwise null. */
  readonly status: number | null;
  /** `timeout`, `aborted`, `connection`, `no_output`, `invalid_output`, `no_match`, `response_refusal`, an API error code, or `http_<status>`. */
  readonly code: string;
  readonly run: RunInfo;

  constructor(message: string, init: { status: number | null; code: string; run: RunInfo }) {
    super(message);
    this.name = "MetaApiError";
    this.status = init.status;
    this.code = init.code;
    this.run = init.run;
  }
}

const SECRET_ENV = ["MODEL_API_KEY", "META_API_KEY", "SUPABASE_SECRET_KEY"];

/** Removes any configured secret and any bearer token from a string before it is logged or thrown. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const name of SECRET_ENV) {
    const value = process.env[name]?.trim();
    if (value && value.length >= 8) out = out.split(value).join("[redacted]");
  }
  return out.replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [redacted]");
}

export interface ErrorSummary {
  message: string;
  status: number | null;
  code: string;
}

/** Maps SDK, parser and abort errors to a short, key-free summary. */
export function summarizeError(err: unknown, timedOut: boolean): ErrorSummary {
  if (timedOut) return { message: "timed out", status: null, code: "timeout" };
  if (err instanceof MetaApiError) return { message: err.message, status: err.status, code: err.code };
  if (err instanceof APIUserAbortError) return { message: "aborted by caller", status: null, code: "aborted" };
  if (err instanceof APIConnectionTimeoutError) return { message: "connection timed out", status: null, code: "timeout" };
  if (err instanceof APIConnectionError) {
    return { message: clip(`connection error: ${err.message}`), status: null, code: "connection" };
  }
  if (err instanceof APIError) {
    const status = typeof err.status === "number" ? err.status : null;
    const code = err.code ?? err.type ?? (status ? `http_${status}` : "http");
    return { message: clip(err.message), status, code: String(code) };
  }
  if (err instanceof ResponsesStreamError) return { message: clip(err.message), status: null, code: err.code };
  if (err instanceof Error && err.name === "AbortError") return { message: "aborted by caller", status: null, code: "aborted" };
  const message = err instanceof Error ? err.message : String(err);
  return { message: clip(message), status: null, code: "error" };
}

function clip(text: string): string {
  const clean = redactSecrets(text).replace(/\s+/g, " ").trim();
  return clean.length > 300 ? `${clean.slice(0, 297)}...` : clean;
}
