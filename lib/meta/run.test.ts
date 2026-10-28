import { afterEach, describe, expect, it } from "vitest";
import { setRunHooks, startRun, type RunContext } from "./run.ts";
import type { RunInfo } from "./types.ts";

afterEach(() => setRunHooks(null));

describe("run hooks", () => {
  it("credits a call to the context at its start, once", () => {
    let ctx: RunContext | undefined = { route: "tutor", householdId: "h", profileId: "k" };
    const seen: [RunInfo, RunContext | undefined][] = [];
    setRunHooks({ context: () => ctx, emit: (run, c) => seen.push([run, c]) });
    const clock = startRun("chat_stream", "muse-spark-1.3");
    ctx = undefined; // a stream that ends after the request's context is gone
    clock.finish({ inputTokens: 10, outputTokens: 5 });
    clock.finish({});
    expect(seen).toHaveLength(1);
    expect(seen[0][1]?.route).toBe("tutor");
    expect(seen[0][0]).toMatchObject({ ok: true, model: "muse-spark-1.3", inputTokens: 10 });
  });

  it("logs failures too, and a broken logger never breaks the call", () => {
    setRunHooks({
      context: () => undefined,
      emit: () => {
        throw new Error("db down");
      },
    });
    const err = startRun("structured", "muse-spark-1.3").toError(new Error("boom"), {}, false);
    expect(err.run.ok).toBe(false);
  });
});
