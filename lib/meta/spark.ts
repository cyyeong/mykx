// Muse Spark via chat completions: plain, with function tools, streamed, and structured (json_schema + zod).
import type { ChatCompletionMessageParam, ChatCompletionMessageToolCall, ChatCompletionTool } from "openai/resources/chat/completions";
import type { z } from "zod";
import { DEFAULT_SPARK_MODEL, callSignal, createMetaClient, pickRequestId } from "./client.ts";
import { MetaApiError } from "./errors.ts";
import { assertStandardModel } from "./guard.ts";
import { type RunFields, startRun } from "./run.ts";
import { jsonSchemaResponseFormat, parseStructuredText } from "./schema.ts";
import type { CallOptions, RunInfo } from "./types.ts";

export type SparkMessage = ChatCompletionMessageParam;
/** `none` is rejected by Muse Spark, which always reasons. */
export type SparkReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export interface SparkRequest {
  messages: SparkMessage[];
  /** Default `muse-spark-1.3`. Contributor ids throw. */
  model?: string;
  reasoningEffort?: SparkReasoningEffort;
  /** Caps output tokens, reasoning included. Unset by default. */
  maxCompletionTokens?: number;
  temperature?: number;
}

export interface SparkChatResult {
  text: string;
  finishReason: string | null;
  run: RunInfo;
}

export interface SparkStructuredRequest<S extends z.ZodType> extends SparkRequest {
  schema: S;
  /** `response_format.json_schema.name`: letters, digits, `_` and `-`, up to 64. */
  schemaName: string;
  schemaDescription?: string;
  /** Sends `strict: true` (Meta then enforces required/additionalProperties). Unset by default. */
  strict?: boolean;
}

export interface SparkStructuredResult<T> {
  data: T;
  /** Raw model text, for debugging. */
  text: string;
  run: RunInfo;
}

/** Async iterable of text deltas; `result` settles once the stream ends (or fails). */
export interface SparkStream extends AsyncIterable<string> {
  readonly result: Promise<SparkChatResult>;
}

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number | null } | null;
}

function usageFields(usage: ChatUsage | null | undefined): RunFields {
  if (!usage) return {};
  return {
    inputTokens: usage.prompt_tokens ?? null,
    outputTokens: usage.completion_tokens ?? null,
    cachedInputTokens: usage.prompt_tokens_details?.cached_tokens ?? null,
  };
}

function baseBody(req: SparkRequest, model: string) {
  return {
    model,
    messages: req.messages,
    ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
    ...(req.maxCompletionTokens !== undefined ? { max_completion_tokens: req.maxCompletionTokens } : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
  };
}

/** One non-streamed chat completion. */
export async function sparkChat(req: SparkRequest, options: CallOptions = {}): Promise<SparkChatResult> {
  const model = assertStandardModel(req.model ?? DEFAULT_SPARK_MODEL);
  const client = createMetaClient({ maxRetries: options.maxRetries });
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("chat", model);
  let fields: RunFields = {};
  try {
    const { data, response } = await client.chat.completions
      .create(baseBody(req, model), { signal })
      .withResponse();
    fields = { requestId: pickRequestId(response.headers), responseId: data.id ?? null, ...usageFields(data.usage) };
    const choice = data.choices[0];
    const text = choice?.message?.content ?? "";
    if (!text.trim()) {
      throw new MetaApiError(`chat (${model}) returned no text (finish_reason: ${choice?.finish_reason ?? "none"})`, {
        status: null,
        code: "no_output",
        run: clock.fail(fields, `no_output: finish_reason ${choice?.finish_reason ?? "none"}`),
      });
    }
    return { text, finishReason: choice?.finish_reason ?? null, run: clock.finish(fields) };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}

export interface SparkToolsRequest extends SparkRequest {
  tools: ChatCompletionTool[];
  /** `none` makes the model answer with what it has (the agent loop's last round). Muse Spark only accepts
   *  `tool_choice: "auto"`, so `none` is sent as a request without tools (tested live 28 Oct). */
  toolChoice?: "auto" | "none";
}

export interface SparkToolsResult {
  text: string;
  toolCalls: ChatCompletionMessageToolCall[];
  finishReason: string | null;
  run: RunInfo;
}

/** One non-streamed chat completion that may call function tools (the Skill Engine's agent loop, lib/skills/runtime.ts). */
export async function sparkTools(req: SparkToolsRequest, options: CallOptions = {}): Promise<SparkToolsResult> {
  const model = assertStandardModel(req.model ?? DEFAULT_SPARK_MODEL);
  const client = createMetaClient({ maxRetries: options.maxRetries });
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("chat_tools", model);
  let fields: RunFields = {};
  try {
    const { data, response } = await client.chat.completions
      .create(req.toolChoice === "none" ? baseBody(req, model) : { ...baseBody(req, model), tools: req.tools, tool_choice: "auto" as const }, { signal })
      .withResponse();
    fields = { requestId: pickRequestId(response.headers), responseId: data.id ?? null, ...usageFields(data.usage) };
    const choice = data.choices[0];
    const text = choice?.message?.content ?? "";
    const toolCalls = choice?.message?.tool_calls ?? [];
    if (!text.trim() && !toolCalls.length) {
      throw new MetaApiError(`chat_tools (${model}) returned nothing (finish_reason: ${choice?.finish_reason ?? "none"})`, {
        status: null,
        code: "no_output",
        run: clock.fail(fields, `no_output: finish_reason ${choice?.finish_reason ?? "none"}`),
      });
    }
    return { text, toolCalls, finishReason: choice?.finish_reason ?? null, run: clock.finish(fields) };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}

/** Chat completion with `response_format: json_schema` built from a zod schema; output is zod-validated. */
export async function sparkStructured<S extends z.ZodType>(
  req: SparkStructuredRequest<S>,
  options: CallOptions = {},
): Promise<SparkStructuredResult<z.output<S>>> {
  const model = assertStandardModel(req.model ?? DEFAULT_SPARK_MODEL);
  const responseFormat = jsonSchemaResponseFormat(req.schemaName, req.schema, {
    description: req.schemaDescription,
    strict: req.strict,
  });
  const client = createMetaClient({ maxRetries: options.maxRetries });
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("structured", model);
  let fields: RunFields = {};
  try {
    const { data, response } = await client.chat.completions
      .create({ ...baseBody(req, model), response_format: responseFormat }, { signal })
      .withResponse();
    fields = { requestId: pickRequestId(response.headers), responseId: data.id ?? null, ...usageFields(data.usage) };
    const text = data.choices[0]?.message?.content ?? "";
    const parsed = parseStructuredText(req.schema, text);
    if (!parsed.ok) {
      throw new MetaApiError(`structured (${model}) ${parsed.error}`, {
        status: null,
        code: "invalid_output",
        run: clock.fail(fields, `invalid_output: ${parsed.error.slice(0, 200)}`),
      });
    }
    return { data: parsed.data, text, run: clock.finish(fields) };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}

/**
 * Streamed chat completion. Iterate it for text deltas; await `result` for the full text and RunInfo.
 * The request starts on first iteration. Breaking out early aborts the request and rejects `result`
 * with code `aborted`. `result` never causes an unhandled rejection if you don't await it.
 */
export function sparkStream(req: SparkRequest, options: CallOptions = {}): SparkStream {
  const model = assertStandardModel(req.model ?? DEFAULT_SPARK_MODEL);
  let settle!: { resolve: (r: SparkChatResult) => void; reject: (e: unknown) => void };
  const result = new Promise<SparkChatResult>((resolve, reject) => {
    settle = { resolve, reject };
  });
  result.catch(() => {});

  async function* deltas(): AsyncGenerator<string> {
    const client = createMetaClient({ maxRetries: options.maxRetries });
    const { signal, timedOut } = callSignal(options);
    const clock = startRun("chat_stream", model);
    const fields: RunFields = {};
    let text = "";
    let finishReason: string | null = null;
    let settled = false;
    try {
      const { data: stream, response } = await client.chat.completions
        .create({ ...baseBody(req, model), stream: true, stream_options: { include_usage: true } }, { signal })
        .withResponse();
      fields.requestId = pickRequestId(response.headers);
      for await (const chunk of stream) {
        fields.responseId ??= chunk.id ?? null;
        if (chunk.usage) Object.assign(fields, usageFields(chunk.usage));
        const choice = chunk.choices[0];
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const delta = choice?.delta?.content;
        if (delta) {
          fields.firstTokenMs ??= clock.elapsed();
          text += delta;
          yield delta;
        }
      }
      if (!text.trim()) {
        throw new MetaApiError(`chat_stream (${model}) returned no text (finish_reason: ${finishReason ?? "none"})`, {
          status: null,
          code: "no_output",
          run: clock.fail(fields, `no_output: finish_reason ${finishReason ?? "none"}`),
        });
      }
      settled = true;
      settle.resolve({ text, finishReason, run: clock.finish(fields) });
    } catch (err) {
      const error = clock.toError(err, fields, timedOut());
      settled = true;
      settle.reject(error);
      throw error;
    } finally {
      if (!settled) {
        settle.reject(clock.toError(new DOMException("stream closed by consumer", "AbortError"), fields, false));
      }
    }
  }

  const iterator = deltas();
  return {
    result,
    [Symbol.asyncIterator]: () => iterator,
  };
}
