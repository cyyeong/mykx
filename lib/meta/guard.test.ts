import { afterEach, describe, expect, it, vi } from "vitest";
import { createMetaClient, hasMetaApiKey } from "./client.ts";
import { MetaConfigError, redactSecrets, summarizeError } from "./errors.ts";
import { ContributorModelError, assertStandardModel } from "./guard.ts";
import { museImageEdit } from "./image.ts";
import { samSegment } from "./sam.ts";
import { sparkChat, sparkStream, sparkStructured } from "./spark.ts";
import { z } from "zod";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertStandardModel", () => {
  it("passes Standard model ids through", () => {
    for (const id of ["muse-spark-1.3", "muse-image-1.0", "sam-3.1", "muse-wonder-1.0"]) {
      expect(assertStandardModel(id)).toBe(id);
    }
  });

  it("throws for any id containing 'contributor', in any case", () => {
    for (const id of ["muse-spark-1.3-contributor", "Muse-Spark-1.3-CONTRIBUTOR", "contributor"]) {
      expect(() => assertStandardModel(id)).toThrow(ContributorModelError);
    }
  });
});

describe("every API entry point refuses contributor models before any request", () => {
  const model = "muse-spark-1.3-contributor";
  const messages = [{ role: "user" as const, content: "hi" }];

  it("sparkChat", async () => {
    await expect(sparkChat({ model, messages })).rejects.toBeInstanceOf(ContributorModelError);
  });

  it("sparkStructured", async () => {
    const schema = z.object({ a: z.string() });
    await expect(sparkStructured({ model, messages, schema, schemaName: "a" })).rejects.toBeInstanceOf(ContributorModelError);
  });

  it("sparkStream (throws synchronously)", () => {
    expect(() => sparkStream({ model, messages })).toThrow(ContributorModelError);
  });

  it("museImageEdit", async () => {
    await expect(museImageEdit({ model: "muse-image-contributor", prompt: "x", images: new Uint8Array(8) })).rejects.toBeInstanceOf(
      ContributorModelError,
    );
  });

  it("samSegment", async () => {
    await expect(samSegment({ model: "sam-3.1-contributor", prompt: "x", image: new Uint8Array(8) })).rejects.toBeInstanceOf(
      ContributorModelError,
    );
  });
});

describe("key handling", () => {
  it("throws MetaConfigError without a key, and the message names no value", () => {
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "  ");
    expect(hasMetaApiKey()).toBe(false);
    expect(() => createMetaClient()).toThrow(MetaConfigError);
  });

  it("falls back to META_API_KEY", () => {
    vi.stubEnv("MODEL_API_KEY", "");
    vi.stubEnv("META_API_KEY", "test-key-not-real-123456");
    expect(hasMetaApiKey()).toBe(true);
  });

  it("redacts configured keys and bearer tokens", () => {
    vi.stubEnv("MODEL_API_KEY", "mk-supersecret-value-42");
    const text = 'failed with mk-supersecret-value-42 and header "Authorization: Bearer abc.def-ghi"';
    const out = redactSecrets(text);
    expect(out).not.toContain("mk-supersecret-value-42");
    expect(out).not.toContain("abc.def-ghi");
    expect(out).toContain("[redacted]");
  });

  it("summarizeError redacts keys from arbitrary errors", () => {
    vi.stubEnv("MODEL_API_KEY", "mk-supersecret-value-42");
    const summary = summarizeError(new Error("boom mk-supersecret-value-42"), false);
    expect(summary.message).toBe("boom [redacted]");
    expect(summarizeError(new Error("x"), true).code).toBe("timeout");
  });
});
