import { MetaApiError, summarizeError } from "./errors.ts";
import { estimateCostUsd } from "./pricing.ts";
import type { MetaOperation, RunInfo } from "./types.ts";

export interface RunFields {
  requestId?: string | null;
  responseId?: string | null;
  firstTokenMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  images?: number | null;
  audioSeconds?: number | null;
}

/** Who made a call: the route and, for child data, the household and kid (ids only). */
export interface RunContext {
  route: string;
  householdId: string | null;
  profileId: string | null;
}

/** Server code registers this to log every finished call (lib/runs/log.ts writes `model_runs`). The context is
 *  read when the call starts, so a stream that ends later is still credited to its route. */
export interface RunHooks {
  context(): RunContext | undefined;
  emit(run: RunInfo, context: RunContext | undefined): void;
}

let hooks: RunHooks | null = null;

export function setRunHooks(next: RunHooks | null): void {
  hooks = next;
}

export interface RunClock {
  /** Milliseconds since the run started. */
  elapsed(): number;
  finish(fields: RunFields): RunInfo;
  fail(fields: RunFields, error: string): RunInfo;
  /** Wraps any error as a MetaApiError carrying a failed RunInfo. */
  toError(err: unknown, fields: RunFields, timedOut: boolean): MetaApiError;
}

export function startRun(operation: MetaOperation, model: string): RunClock {
  const t0 = performance.now();
  const startedAt = new Date().toISOString();
  const elapsed = () => Math.round(performance.now() - t0);
  const context = hooks?.context();
  let emitted = false;
  const emit = (run: RunInfo) => {
    if (emitted || !hooks) return run;
    emitted = true;
    try {
      hooks.emit(run, context);
    } catch {
      // Logging never breaks a call.
    }
    return run;
  };

  const build = (fields: RunFields, ok: boolean, error: string | null): RunInfo => {
    const usage = {
      inputTokens: fields.inputTokens ?? null,
      outputTokens: fields.outputTokens ?? null,
      cachedInputTokens: fields.cachedInputTokens ?? null,
      images: fields.images ?? null,
      audioSeconds: fields.audioSeconds ?? null,
    };
    return {
      provider: "meta",
      operation,
      model,
      requestId: fields.requestId ?? null,
      responseId: fields.responseId ?? null,
      startedAt,
      latencyMs: elapsed(),
      firstTokenMs: fields.firstTokenMs ?? null,
      ...usage,
      costUsd: estimateCostUsd(model, usage),
      ok,
      error,
    };
  };

  return {
    elapsed,
    finish: (fields) => emit(build(fields, true, null)),
    fail: (fields, error) => emit(build(fields, false, error)),
    toError(err, fields, timedOut) {
      if (err instanceof MetaApiError) return err;
      const summary = summarizeError(err, timedOut);
      const run = emit(build(fields, false, `${summary.code}: ${summary.message}`));
      return new MetaApiError(`${operation} (${model}) failed: ${summary.message}`, {
        status: summary.status,
        code: summary.code,
        run,
      });
    },
  };
}
