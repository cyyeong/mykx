import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SchemaBuildError, jsonSchemaResponseFormat, parseStructuredText, zodToJsonSchema } from "./schema.ts";

const Flashcards = z.object({
  topic: z.string(),
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
        stage: z.enum(["egg", "tadpole", "froglet", "adult"]).nullable(),
        difficulty: z.number().int(),
      }),
    )
    .length(3),
});

describe("zodToJsonSchema", () => {
  it("builds a closed, fully-required schema without $schema or safe-int noise", () => {
    expect(zodToJsonSchema(Flashcards)).toEqual({
      type: "object",
      properties: {
        topic: { type: "string" },
        cards: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              front: { type: "string", minLength: 1 },
              back: { type: "string", minLength: 1 },
              stage: { anyOf: [{ type: "string", enum: ["egg", "tadpole", "froglet", "adult"] }, { type: "null" }] },
              difficulty: { type: "integer" },
            },
            required: ["front", "back", "stage", "difficulty"],
            additionalProperties: false,
          },
        },
      },
      required: ["topic", "cards"],
      additionalProperties: false,
    });
  });

  it("rejects optional and defaulted fields with a hint to use nullable", () => {
    expect(() => zodToJsonSchema(z.object({ a: z.string().optional() }))).toThrow(/optional field\(s\) a.*nullable/);
    expect(() => zodToJsonSchema(z.object({ a: z.string().default("x") }))).toThrow(SchemaBuildError);
  });

  it("rejects open objects and records", () => {
    expect(() => zodToJsonSchema(z.looseObject({ a: z.string() }))).toThrow(/additionalProperties: false/);
    expect(() => zodToJsonSchema(z.object({ m: z.record(z.string(), z.string()) }))).toThrow(SchemaBuildError);
  });

  it("rejects recursive schemas", () => {
    const Node = z.object({
      name: z.string(),
      get children(): z.ZodArray<typeof Node> {
        return z.array(Node);
      },
    });
    expect(() => zodToJsonSchema(Node)).toThrow(SchemaBuildError);
  });

  it("rejects a non-object root", () => {
    expect(() => zodToJsonSchema(z.array(z.string()))).toThrow(/root/);
  });

  it("inlines a reused sub-schema instead of emitting $ref", () => {
    const Point = z.object({ x: z.number() });
    const schema = zodToJsonSchema(z.object({ a: Point, b: Point }));
    expect(JSON.stringify(schema)).not.toContain("$ref");
  });
});

describe("jsonSchemaResponseFormat", () => {
  it("wraps the schema as response_format json_schema", () => {
    const format = jsonSchemaResponseFormat("flashcards", Flashcards, { strict: true });
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.name).toBe("flashcards");
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.schema.type).toBe("object");
    expect("description" in format.json_schema).toBe(false);
  });

  it("validates the name", () => {
    expect(() => jsonSchemaResponseFormat("frog cards!", Flashcards)).toThrow(SchemaBuildError);
  });
});

describe("parseStructuredText", () => {
  const good = {
    topic: "Frog life cycle",
    cards: [
      { front: "First stage?", back: "Egg", stage: "egg", difficulty: 1 },
      { front: "Breathes with gills?", back: "Tadpole", stage: "tadpole", difficulty: 2 },
      { front: "Lives on land and in water?", back: "Adult frog", stage: null, difficulty: 2 },
    ],
  };

  it("accepts valid JSON, with or without a code fence", () => {
    expect(parseStructuredText(Flashcards, JSON.stringify(good))).toEqual({ ok: true, data: good });
    const fenced = "```json\n" + JSON.stringify(good) + "\n```";
    expect(parseStructuredText(Flashcards, fenced).ok).toBe(true);
  });

  it("reports invalid JSON and schema mismatches", () => {
    const notJson = parseStructuredText(Flashcards, "{ cards: ");
    expect(notJson.ok).toBe(false);
    if (!notJson.ok) expect(notJson.error).toMatch(/not JSON/);

    const twoCards = parseStructuredText(Flashcards, JSON.stringify({ ...good, cards: good.cards.slice(0, 2) }));
    expect(twoCards.ok).toBe(false);
    if (!twoCards.ok) expect(twoCards.error).toMatch(/validation/);

    expect(parseStructuredText(Flashcards, "  ").ok).toBe(false);
  });
});
