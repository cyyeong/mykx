// zod schema -> chat-completions `response_format` (json_schema), and output validation.
import { z } from "zod";

export type JsonSchema = { [key: string]: unknown };

/** Structurally the same as the OpenAI SDK's `ResponseFormatJSONSchema`. */
export interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    description?: string;
    schema: JsonSchema;
    strict?: boolean;
  };
}

export class SchemaBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaBuildError";
  }
}

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * JSON Schema for the JSON a model must produce so that `schema.parse` accepts it.
 *
 * Follows the meta-model-api skill rules, and throws `SchemaBuildError` when a schema breaks them:
 * - no `$ref`/`$defs` (recursive or reused schemas; inline them), no `allOf`/`oneOf`;
 * - the root is an object;
 * - every object lists all its keys in `required` and has `additionalProperties: false`
 *   (use `.nullable()` instead of `.optional()`/`.default()`, and `z.object`, not `z.record`).
 *
 * Strips `$schema` and zod's ±MAX_SAFE_INTEGER bounds on `.int()`, which only add noise.
 */
export function zodToJsonSchema(schema: z.ZodType): JsonSchema {
  let raw: JsonSchema;
  try {
    raw = z.toJSONSchema(schema, { io: "input", cycles: "throw", reused: "inline", unrepresentable: "throw" }) as JsonSchema;
  } catch (err) {
    throw new SchemaBuildError(`zod schema cannot be expressed as JSON Schema: ${(err as Error).message}`);
  }
  const cleaned = clean(raw) as JsonSchema;
  delete cleaned.$schema;

  if (cleaned.type !== "object") throw new SchemaBuildError("the root of a structured-output schema must be a z.object");
  const problems: string[] = [];
  check(cleaned, "$", problems);
  if (problems.length > 0) throw new SchemaBuildError(`schema is not valid for structured output:\n- ${problems.join("\n- ")}`);
  return cleaned;
}

/** The `response_format` value for `chat.completions.create`. */
export function jsonSchemaResponseFormat(
  name: string,
  schema: z.ZodType,
  options: { description?: string; strict?: boolean } = {},
): JsonSchemaResponseFormat {
  if (!NAME_PATTERN.test(name)) throw new SchemaBuildError(`schema name "${name}" must match ${NAME_PATTERN}`);
  const json_schema: JsonSchemaResponseFormat["json_schema"] = { name, schema: zodToJsonSchema(schema) };
  if (options.description) json_schema.description = options.description;
  if (options.strict !== undefined) json_schema.strict = options.strict;
  return { type: "json_schema", json_schema };
}

export type StructuredParse<T> = { ok: true; data: T } | { ok: false; error: string };

/** Parses model text as JSON (tolerating a ```json fence) and validates it with the schema. */
export function parseStructuredText<S extends z.ZodType>(schema: S, text: string): StructuredParse<z.output<S>> {
  const body = stripFence(text);
  if (!body) return { ok: false, error: "empty output" };
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: `output is not JSON: ${(err as Error).message}` };
  }
  const result = schema.safeParse(value);
  if (!result.success) return { ok: false, error: `output failed validation: ${z.prettifyError(result.error)}` };
  return { ok: true, data: result.data };
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!isObject(node)) return node;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) out[key] = clean(value);
  if (out.type === "integer") {
    if (out.minimum === Number.MIN_SAFE_INTEGER) delete out.minimum;
    if (out.maximum === Number.MAX_SAFE_INTEGER) delete out.maximum;
  }
  // In `io: "input"` mode zod omits additionalProperties for a plain z.object (it strips unknown
  // keys). Closing it tells the model not to invent keys; z.looseObject/z.record keep theirs.
  if (out.type === "object" && out.additionalProperties === undefined) out.additionalProperties = false;
  return out;
}

function check(node: JsonSchema, path: string, problems: string[]): void {
  for (const key of ["$ref", "$defs", "definitions"]) {
    if (key in node) problems.push(`${path}: "${key}" is not supported; inline the schema (no recursion or reuse by reference)`);
  }
  for (const key of ["allOf", "oneOf"]) {
    if (key in node) problems.push(`${path}: "${key}" is not supported (use a z.union of objects, which becomes anyOf)`);
  }

  const isObjectNode = node.type === "object" || "properties" in node;
  if (isObjectNode) {
    const properties = isObject(node.properties) ? node.properties : {};
    if (node.additionalProperties !== false) {
      problems.push(`${path}: objects must have additionalProperties: false (use z.object, not z.record or z.looseObject)`);
    }
    const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
    const missing = Object.keys(properties).filter((key) => !required.has(key));
    if (missing.length > 0) {
      problems.push(`${path}: optional field(s) ${missing.join(", ")}; every field must be required (use .nullable() instead of .optional() or .default())`);
    }
    for (const [key, child] of Object.entries(properties)) {
      if (isObject(child)) check(child, `${path}.${key}`, problems);
    }
  }

  if (isObject(node.items)) check(node.items, `${path}[]`, problems);
  for (const key of ["prefixItems", "anyOf"]) {
    const list = node[key];
    if (Array.isArray(list)) list.forEach((child, i) => isObject(child) && check(child, `${path}.${key}[${i}]`, problems));
  }
}

function isObject(value: unknown): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
