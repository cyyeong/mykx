import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_KIDS, DEMO_SECRETS, KAI_SECRET, KAI_SECRET_HASH } from "./demo-family.ts";
import { canonicalSecret, passwordSchema, pictureCodeSchema, secretSchema, type SecretAttempt } from "./schemas.ts";
import { hashSecret, parseSecretHash, verifyCanonical, verifySecret } from "./secrets.ts";

const ari: SecretAttempt = { kind: "pictures", code: ["idle", "cheer", "pilot", "dreamlight"] };

describe("kid secrets (scrypt)", () => {
  it("hashes to a self-describing string and verifies", async () => {
    const stored = await hashSecret(ari);
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(await verifySecret(ari, stored)).toBe(true);
    expect(await hashSecret(ari)).not.toBe(stored); // fresh salt every time
  });

  it("rejects a wrong code, the right pictures in the wrong order, and a wrong password", async () => {
    const stored = await hashSecret(ari);
    expect(await verifySecret({ kind: "pictures", code: ["idle", "cheer", "pilot", "hint"] }, stored)).toBe(false);
    expect(await verifySecret({ kind: "pictures", code: ["cheer", "idle", "pilot", "dreamlight"] }, stored)).toBe(false);
    const pw = await hashSecret({ kind: "password", password: "frogs123" });
    expect(await verifySecret({ kind: "password", password: "Frogs123" }, pw)).toBe(false);
    expect(await verifySecret({ kind: "password", password: "frogs123" }, pw)).toBe(true);
  });

  it("treats missing or malformed hashes as a mismatch, never a match", async () => {
    for (const bad of [null, undefined, "", "frogs123", "scrypt$16384$8$1$abc", "bcrypt$16384$8$1$AAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA", "scrypt$1000$8$1$AAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA", "scrypt$1048576$8$1$AAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA", "scrypt$16384$8$1$!!$??"]) {
      expect(await verifyCanonical("idle|cheer|pilot|dreamlight", bad)).toBe(false);
    }
    expect(parseSecretHash("scrypt$1048576$8$1$AAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA")).toBeNull(); // too much memory
  });

  it("canonicalises picture codes as ids joined with |", () => {
    expect(canonicalSecret(ari)).toBe("idle|cheer|pilot|dreamlight");
  });

  it("validates picture codes and passwords", () => {
    expect(pictureCodeSchema.safeParse(["idle", "cheer", "pilot"]).success).toBe(false);
    expect(pictureCodeSchema.safeParse(["idle", "cheer", "pilot", "dreamlight", "hint"]).success).toBe(false);
    expect(pictureCodeSchema.safeParse(["idle", "cheer", "pilot", "dragon"]).success).toBe(false);
    expect(pictureCodeSchema.safeParse(["hint", "hint", "hint", "hint"]).success).toBe(true);
    expect(passwordSchema.safeParse("frogs12").success).toBe(false); // 8 minimum
    expect(passwordSchema.safeParse("frogs123").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(65)).success).toBe(false);
    expect(secretSchema.safeParse({ kind: "pictures", password: "frogs123" }).success).toBe(false);
  });
});

describe("demo family secrets", () => {
  it("the demo hashes open with the demo secrets", async () => {
    for (const kid of DEMO_KIDS) {
      const secret = DEMO_SECRETS[kid.id as keyof typeof DEMO_SECRETS] as SecretAttempt;
      expect(secret.kind).toBe(kid.secretKind);
      expect(await verifySecret(secret, kid.secretHash)).toBe(true);
    }
    expect(await verifySecret(KAI_SECRET as unknown as SecretAttempt, KAI_SECRET_HASH)).toBe(true);
  });

  it("supabase/seed.sql carries the same hashes as lib/auth/demo-family.ts", () => {
    const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
    const hashes = [...seed.matchAll(/'(scrypt\$[^']+)'/g)].map((m) => m[1]);
    expect(hashes).toEqual(DEMO_KIDS.map((k) => k.secretHash));
  });
});
