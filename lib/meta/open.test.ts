import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BASETEN_BASE_URL, MUSE_SPARK_OPEN_MODEL, resolveRole, roleStructured } from "./open.ts";

const verdict = z.object({ verdict: z.enum(["problem", "not-a-problem"]), confidence: z.number() });
const req = { messages: [{ role: "user" as const, content: "Is 'recieve' a typo?" }], schema: verdict, schemaName: "verdict" };
const ENV = ["BASETEN_API_KEY", "MODEL_API_KEY", "META_API_KEY", "NEXT_PUBLIC_MYKX_GUEST", "MUSE_SPARK_OPEN_MODEL"] as const;
const saved: Partial<Record<(typeof ENV)[number], string | undefined>> = {};

interface Call {
  url: string;
  auth: string | null;
  body: { model: string; response_format?: { type: string }; messages: { role: string; content: string }[] };
}
let calls: Call[] = [];

function completion(content: string, status = 200) {
  const body = status === 200 ? { id: "chatcmpl-1", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 6 } } : { error: { message: content } };
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Answers from `replies` in order, recording each request. */
function stubFetch(replies: (() => Response)[]) {
  calls = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get("authorization"), body: JSON.parse(String(init?.body ?? "{}")) });
    const next = replies.shift();
    if (!next) throw new Error("unexpected request");
    return next();
  });
}

beforeEach(() => {
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.MODEL_API_KEY = "meta-test-key";
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("model roles", () => {
  it("runs the open-model roles on Muse Spark 1.3 while the Baseten key is empty", () => {
    expect(resolveRole("synapse.reviewer")).toMatchObject({ wanted: { provider: "baseten", model: MUSE_SPARK_OPEN_MODEL }, used: { provider: "meta", model: "muse-spark-1.3" }, fallback: "no-key" });
    expect(resolveRole("synapse.second")).toMatchObject({ used: { provider: "meta" }, fallback: null });
  });

  it("uses Muse Spark Open on Baseten once the key is set, and never on the guest site", () => {
    process.env.BASETEN_API_KEY = "bt-test-key";
    expect(resolveRole("synapse.judge")).toMatchObject({ used: { provider: "baseten", model: MUSE_SPARK_OPEN_MODEL }, fallback: null });
    process.env.MUSE_SPARK_OPEN_MODEL = "meta-models/muse-spark-open-1026";
    expect(resolveRole("synapse.judge").used.model).toBe("meta-models/muse-spark-open-1026");
    process.env.NEXT_PUBLIC_MYKX_GUEST = "1";
    expect(resolveRole("synapse.judge").fallback).toBe("no-key");
  });
});

describe("roleStructured", () => {
  it("calls Baseten's OpenAI-compatible API with a JSON schema and logs the provider", async () => {
    process.env.BASETEN_API_KEY = "bt-test-key";
    stubFetch([() => completion('{"verdict":"problem","confidence":100}')]);
    const out = await roleStructured("synapse.reviewer", req);
    expect(out.data).toEqual({ verdict: "problem", confidence: 100 });
    expect(out.choice.fallback).toBeNull();
    expect(out.run).toMatchObject({ provider: "baseten", model: MUSE_SPARK_OPEN_MODEL, ok: true, inputTokens: 12 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASETEN_BASE_URL}/chat/completions`);
    expect(calls[0].auth).toBe("Bearer bt-test-key");
    expect(calls[0].body.model).toBe(MUSE_SPARK_OPEN_MODEL);
    expect(calls[0].body.response_format?.type).toBe("json_schema");
  });

  it("retries once in JSON mode when Baseten refuses the schema", async () => {
    process.env.BASETEN_API_KEY = "bt-test-key";
    stubFetch([() => completion("response_format json_schema not supported", 400), () => completion('```json\n{"verdict":"not-a-problem","confidence":90}\n```')]);
    const out = await roleStructured("synapse.reviewer", req, { maxRetries: 0 });
    expect(out.data.verdict).toBe("not-a-problem");
    expect(calls[1].body.response_format?.type).toBe("json_object");
    expect(calls[1].body.messages[0]).toMatchObject({ role: "system" });
    expect(calls[1].body.messages[0].content).toContain('"confidence"');
  });

  it("falls back to Muse Spark 1.3 when Baseten fails, and says so", async () => {
    process.env.BASETEN_API_KEY = "bt-test-key";
    stubFetch([() => completion("upstream down", 503), () => completion('{"verdict":"problem","confidence":80}')]);
    const out = await roleStructured("synapse.reviewer", req, { maxRetries: 0 });
    expect(out.choice).toMatchObject({ used: { provider: "meta", model: "muse-spark-1.3" }, fallback: "provider-error" });
    expect(out.run.provider).toBe("meta");
    expect(calls[1].url).toContain("api.meta.ai");
    expect(calls[1].auth).toBe("Bearer meta-test-key");
  });

  it("goes straight to Muse Spark 1.3 with no Baseten key", async () => {
    stubFetch([() => completion('{"verdict":"problem","confidence":100}')]);
    const out = await roleStructured("synapse.reviewer", req);
    expect(out.choice.fallback).toBe("no-key");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("api.meta.ai");
  });
});
