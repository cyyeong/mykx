// Meta's open-weight model, Muse Spark Open, on Baseten's OpenAI-compatible Model API (zero data retention by
// default), behind model roles: each job names the provider and model it wants (docs/prd/SYNAPSE.md §6). With no
// BASETEN_API_KEY (the founder's choice for now, 29 Oct), or when Baseten fails, the role runs on Muse Spark 1.3 and
// the result says which model really answered (rule 8). Only de-identified content may go to the open model (rule 1).
// Server only: it reads keys from the environment.
import OpenAI from "openai";
import type { z } from "zod";
import { isGuest } from "../guest.ts";
import { DEFAULT_SPARK_MODEL, callSignal, pickRequestId } from "./client.ts";
import { MetaApiError, MetaConfigError } from "./errors.ts";
import { assertStandardModel } from "./guard.ts";
import { type RunFields, startRun } from "./run.ts";
import { jsonSchemaResponseFormat, parseStructuredText, zodToJsonSchema } from "./schema.ts";
import { type SparkStructuredRequest, type SparkStructuredResult, sparkStructured } from "./spark.ts";
import type { CallOptions, ModelProvider } from "./types.ts";

export const BASETEN_BASE_URL = "https://inference.baseten.co/v1";
export const MUSE_SPARK_OPEN_MODEL = "meta-models/muse-spark-open";

export type ModelRole = "synapse.reviewer" | "synapse.judge" | "synapse.second";

export interface RoleModel {
  provider: ModelProvider;
  model: string;
}

/** What each job asks for. The reviewer and the judge are a different model from the one that made the mistake. */
export const ROLE_DEFAULTS: Readonly<Record<ModelRole, RoleModel>> = {
  "synapse.reviewer": { provider: "baseten", model: MUSE_SPARK_OPEN_MODEL },
  "synapse.judge": { provider: "baseten", model: MUSE_SPARK_OPEN_MODEL },
  "synapse.second": { provider: "meta", model: DEFAULT_SPARK_MODEL },
};

/** Where a Baseten role runs when it can't reach Baseten. */
export const OPEN_FALLBACK: RoleModel = { provider: "meta", model: DEFAULT_SPARK_MODEL };

function readOpenKey(): string | undefined {
  if (isGuest()) return undefined; // the guest site never calls a model (lib/guest.ts)
  return process.env.BASETEN_API_KEY?.trim() || undefined;
}

/** True when `BASETEN_API_KEY` is set and non-empty. */
export function hasOpenModelKey(): boolean {
  return readOpenKey() !== undefined;
}

/** Baseten's id for Muse Spark Open; `MUSE_SPARK_OPEN_MODEL` overrides it (an event alias, a dedicated deployment). */
export function openModelId(): string {
  return process.env.MUSE_SPARK_OPEN_MODEL?.trim() || MUSE_SPARK_OPEN_MODEL;
}

/** A fresh SDK client for Baseten. The key is read on every call, never cached or logged. */
export function createOpenModelClient(options: { maxRetries?: number } = {}): OpenAI {
  const apiKey = readOpenKey();
  if (!apiKey) throw new MetaConfigError("No Baseten key: set BASETEN_API_KEY to use Muse Spark Open.");
  return new OpenAI({
    apiKey,
    baseURL: process.env.BASETEN_BASE_URL?.trim() || BASETEN_BASE_URL,
    maxRetries: options.maxRetries ?? 2,
    organization: null,
    project: null,
    logLevel: "warn",
  });
}

export interface RoleChoice {
  role: ModelRole;
  wanted: RoleModel;
  used: RoleModel;
  /** Why the role isn't on the model it wanted, or null when it is. */
  fallback: null | "no-key" | "provider-error";
}

/** The model a role runs on right now: its default (or `override`), unless that is Baseten without a key. */
export function resolveRole(role: ModelRole, override?: RoleModel): RoleChoice {
  const base = override ?? ROLE_DEFAULTS[role];
  const wanted = base.provider === "baseten" && !override ? { ...base, model: openModelId() } : base;
  if (wanted.provider === "baseten" && !hasOpenModelKey()) return { role, wanted, used: OPEN_FALLBACK, fallback: "no-key" };
  return { role, wanted, used: wanted, fallback: null };
}

export type RoleStructuredRequest<S extends z.ZodType> = Omit<SparkStructuredRequest<S>, "model">;

export interface RoleStructuredResult<T> extends SparkStructuredResult<T> {
  choice: RoleChoice;
}

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number | null } | null;
}

const usageFields = (u: ChatUsage | null | undefined): RunFields =>
  u ? { inputTokens: u.prompt_tokens ?? null, outputTokens: u.completion_tokens ?? null, cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? null } : {};

/** Structured output on Baseten. Its `json_schema` support isn't verified for this model, so a 400 on the schema
 *  retries once in JSON mode with the schema in a system message; zod validates either way. */
async function basetenStructured<S extends z.ZodType>(req: RoleStructuredRequest<S>, model: string, options: CallOptions): Promise<SparkStructuredResult<z.output<S>>> {
  assertStandardModel(model);
  const client = createOpenModelClient({ maxRetries: options.maxRetries });
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("structured", model, "baseten");
  const base = {
    model,
    messages: req.messages,
    ...(req.maxCompletionTokens !== undefined ? { max_tokens: req.maxCompletionTokens } : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
  };
  let fields: RunFields = {};
  try {
    const send = (body: object) => client.chat.completions.create(body as OpenAI.ChatCompletionCreateParamsNonStreaming, { signal }).withResponse();
    let sent;
    try {
      sent = await send({ ...base, response_format: jsonSchemaResponseFormat(req.schemaName, req.schema, { description: req.schemaDescription, strict: req.strict }) });
    } catch (err) {
      if (!(err instanceof OpenAI.APIError) || err.status !== 400) throw err;
      const schemaNote = { role: "system" as const, content: `Answer with one JSON object only, matching this JSON Schema:\n${JSON.stringify(zodToJsonSchema(req.schema))}` };
      sent = await send({ ...base, messages: [schemaNote, ...req.messages], response_format: { type: "json_object" } });
    }
    const { data, response } = sent;
    fields = { requestId: pickRequestId(response.headers), responseId: data.id ?? null, ...usageFields(data.usage) };
    const text = data.choices[0]?.message?.content ?? "";
    const parsed = parseStructuredText(req.schema, text);
    if (!parsed.ok) {
      throw new MetaApiError(`structured (${model}) ${parsed.error}`, { status: null, code: "invalid_output", run: clock.fail(fields, `invalid_output: ${parsed.error.slice(0, 200)}`) });
    }
    return { data: parsed.data, text, run: clock.finish(fields) };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}

/** A structured call for a role. A Baseten role without a key, or whose call fails (not a cancel by the caller),
 *  runs on Muse Spark 1.3 instead; `choice` records what happened. */
export async function roleStructured<S extends z.ZodType>(
  role: ModelRole,
  req: RoleStructuredRequest<S>,
  options: CallOptions & { override?: RoleModel } = {},
): Promise<RoleStructuredResult<z.output<S>>> {
  const choice = resolveRole(role, options.override);
  if (choice.used.provider === "meta") return { ...(await sparkStructured({ ...req, model: choice.used.model }, options)), choice };
  try {
    return { ...(await basetenStructured(req, choice.used.model, options)), choice };
  } catch (err) {
    if (options.signal?.aborted || !(err instanceof MetaApiError || err instanceof MetaConfigError)) throw err;
    const fell: RoleChoice = { ...choice, used: OPEN_FALLBACK, fallback: "provider-error" };
    return { ...(await sparkStructured({ ...req, model: OPEN_FALLBACK.model }, options)), choice: fell };
  }
}
