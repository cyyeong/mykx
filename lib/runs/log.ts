// Server only: writes every Meta model call to `model_runs` (Under the hood, cost). A route says who it is with
// `logRunsFor(...)` at its top; lib/meta/run.ts reads that when a call starts and hands the finished RunInfo here.
// Ids and numbers only: no prompt, output, audio or key ever reaches the log.
import { AsyncLocalStorage } from "node:async_hooks";
import { getStore } from "../auth/context.ts";
import { setRunHooks, type RunContext } from "../meta/run.ts";
import type { RunInfo } from "../meta/types.ts";
import type { StoredRun } from "../auth/store.ts";

const current = new AsyncLocalStorage<RunContext>();

export function toStoredRun(run: RunInfo, ctx: RunContext | undefined): StoredRun {
  return {
    at: run.startedAt,
    route: ctx?.route ?? "unknown",
    operation: run.operation,
    model: run.model,
    householdId: ctx?.householdId ?? null,
    profileId: ctx?.profileId ?? null,
    requestId: run.requestId,
    responseId: run.responseId,
    latencyMs: run.latencyMs,
    firstTokenMs: run.firstTokenMs,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    images: run.images,
    audioSeconds: run.audioSeconds,
    costUsd: run.costUsd,
    ok: run.ok,
    error: run.error,
  };
}

setRunHooks({
  context: () => current.getStore(),
  emit: (run, ctx) => {
    const store = getStore();
    if (!store) return;
    void store.runs.save(toStoredRun(run, ctx)).catch(() => undefined);
  },
});

/** Credits the model calls made from here on in this request to a route (and, for child data, the kid). */
export function logRunsFor(route: string, householdId: string | null = null, profileId: string | null = null): void {
  current.enterWith({ route, householdId, profileId });
}
