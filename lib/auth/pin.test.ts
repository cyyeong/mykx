// The parent PIN: safe post-sign-in destinations and the short-lived unlock
// cookie (signature, expiry, household and grown-up binding).
import { describe, expect, it } from "vitest";
import { safeNext, signPinUnlock, verifyPinUnlock } from "./pin.ts";

const SECRET = Buffer.from("pin-test-secret-0123456789abcdef");

describe("safeNext", () => {
  it("passes listed grown-up destinations, with query strings", () => {
    expect(safeNext("/parent", "/parent")).toBe("/parent");
    expect(safeNext("/family?setup=pin", "/parent")).toBe("/family?setup=pin");
    expect(safeNext("/admin/people", "/parent")).toBe("/admin/people");
  });

  it("falls back on off-site, protocol-relative and off-list paths", () => {
    for (const bad of [null, undefined, "", "https://evil.example", "//evil.example/x", "/api/auth/parent", "/doors", "/home", "/admin", "/parenthood"]) {
      expect(safeNext(bad, "/parent")).toBe("/parent");
    }
  });
});

describe("pin unlock cookie", () => {
  const input = { householdId: "h1", parentUserId: "u1", now: 1_000_000 };
  const opts = { householdId: "h1", parentUserId: "u1", secret: SECRET, now: 1_000_000 };

  it("round-trips while fresh", () => {
    const token = signPinUnlock(input, SECRET);
    expect(verifyPinUnlock(token, opts)).toEqual({ ok: true });
  });

  it("rejects expiry, the wrong household, a changed grown-up and tampering", () => {
    const token = signPinUnlock(input, SECRET);
    expect(verifyPinUnlock(token, { ...opts, now: 1_000_000 + 16 * 60_000 }).ok).toBe(false);
    expect(verifyPinUnlock(token, { ...opts, householdId: "h2" }).ok).toBe(false);
    expect(verifyPinUnlock(token, { ...opts, parentUserId: "u2" }).ok).toBe(false);
    expect(verifyPinUnlock(`${token}x`, opts).ok).toBe(false);
    expect(verifyPinUnlock(null, opts).ok).toBe(false);
  });
});
