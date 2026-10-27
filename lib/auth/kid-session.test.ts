import { afterEach, describe, expect, it, vi } from "vitest";
import { KID_SESSION_TTL_SEC, kidCookieOptions, signKidSession, verifyKidSession } from "./kid-session.ts";
import { sessionSecret } from "./tokens.ts";

const secret = Buffer.from("test-secret-0123456789abcdefghijklmnop");
const PARENT = "00000000-0000-4000-8000-0000000000a1";
const base = { kidId: "kid-1", householdId: "house-1", parentUserId: PARENT };
const NOW = Date.UTC(2026, 9, 27, 8, 0, 0);

afterEach(() => vi.unstubAllEnvs());

describe("kid session cookie", () => {
  it("signs and verifies, holding ids only", () => {
    const value = signKidSession({ ...base, now: NOW }, secret);
    const checked = verifyKidSession(value, { parentUserId: PARENT, secret, now: NOW + 1000 });
    expect(checked).toEqual({ ok: true, session: { kidId: "kid-1", householdId: "house-1", exp: NOW / 1000 + KID_SESSION_TTL_SEC } });
    expect(Buffer.from(value.split(".")[0], "base64url").toString()).not.toContain(PARENT); // binding, not the raw id
  });

  it("expires after 12 hours", () => {
    const value = signKidSession({ ...base, now: NOW }, secret);
    expect(verifyKidSession(value, { parentUserId: PARENT, secret, now: NOW + 12 * 3600_000 - 1000 }).ok).toBe(true);
    expect(verifyKidSession(value, { parentUserId: PARENT, secret, now: NOW + 12 * 3600_000 })).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a tampered payload or signature, and another key", () => {
    const value = signKidSession({ ...base, now: NOW }, secret);
    const [body, sig] = value.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), k: "kid-2" })).toString("base64url");
    expect(verifyKidSession(`${forged}.${sig}`, { parentUserId: PARENT, secret, now: NOW })).toEqual({ ok: false, reason: "signature" });
    const flipped = sig.slice(0, -2) + (sig.endsWith("AA") ? "BB" : "AA");
    expect(verifyKidSession(`${body}.${flipped}`, { parentUserId: PARENT, secret, now: NOW })).toEqual({ ok: false, reason: "signature" });
    expect(verifyKidSession(value, { parentUserId: PARENT, secret: Buffer.from("another-secret-0123456789abcdefghijk"), now: NOW }).ok).toBe(false);
    for (const junk of ["", "abc", "a.b.c", "!!.??", undefined, null]) {
      expect(verifyKidSession(junk, { parentUserId: PARENT, secret, now: NOW })).toEqual({ ok: false, reason: "malformed" });
    }
  });

  it("only works while the same parent is signed in on the device", () => {
    const value = signKidSession({ ...base, now: NOW }, secret);
    expect(verifyKidSession(value, { parentUserId: "someone-else", secret, now: NOW })).toEqual({ ok: false, reason: "parent" });
    expect(verifyKidSession(value, { parentUserId: null, secret, now: NOW })).toEqual({ ok: false, reason: "parent" });
  });

  it("is http-only, lax, 12 h, and secure in production", () => {
    expect(kidCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200, secure: false });
    vi.stubEnv("NODE_ENV", "production");
    expect(kidCookieOptions().secure).toBe(true);
  });

  it("needs a 32-byte KID_SESSION_SECRET in production; dev falls back", () => {
    expect(sessionSecret({ KID_SESSION_SECRET: "x".repeat(32) })?.length).toBe(32);
    expect(sessionSecret({ KID_SESSION_SECRET: "short" })).not.toBeNull(); // dev fallback
    expect(sessionSecret({ KID_SESSION_SECRET: "short", NODE_ENV: "production" })).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionSecret({})).toBeNull();
  });
});
