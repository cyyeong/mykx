// The kid's session (ACCOUNTS.md §4.2): a short-lived, signed, http-only cookie tied to the parent's
// session on this device. It holds ids only (no nickname, no secrets) and is checked against the
// current parent on every request, so a parent signing out (here or everywhere) ends it too.
import type { CookieOptions } from "./http.ts";
import { mac, signToken, verifyToken } from "./tokens.ts";

export const KID_COOKIE = "mykx_kid";
export const KID_SESSION_TTL_SEC = 12 * 60 * 60;
const LABEL = "kid-session";

export interface KidSession {
  kidId: string;
  householdId: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

interface Payload {
  v: 1;
  k: string;
  h: string;
  p: string; // binding to the parent's auth user id (an HMAC, not the id itself)
  exp: number;
}

function parentBinding(secret: Buffer, parentUserId: string): string {
  return mac(secret, "parent-binding", parentUserId).subarray(0, 18).toString("base64url");
}

export function signKidSession(
  input: { kidId: string; householdId: string; parentUserId: string; now?: number; ttlSec?: number },
  secret: Buffer,
): string {
  const now = input.now ?? Date.now();
  const payload: Payload = {
    v: 1,
    k: input.kidId,
    h: input.householdId,
    p: parentBinding(secret, input.parentUserId),
    exp: Math.floor(now / 1000) + (input.ttlSec ?? KID_SESSION_TTL_SEC),
  };
  return signToken(LABEL, payload, secret);
}

export type KidSessionCheck = { ok: true; session: KidSession } | { ok: false; reason: "malformed" | "signature" | "expired" | "parent" };

/** Verifies signature, expiry and the binding to the parent signed in on this device right now. */
export function verifyKidSession(
  value: string | null | undefined,
  opts: { parentUserId: string | null; secret: Buffer; now?: number },
): KidSessionCheck {
  const checked = verifyToken<Payload>(LABEL, value, opts.secret);
  if (!checked.ok) return checked;
  const p = checked.payload;
  if (p.v !== 1 || typeof p.k !== "string" || typeof p.h !== "string" || typeof p.p !== "string" || typeof p.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (Math.floor((opts.now ?? Date.now()) / 1000) >= p.exp) return { ok: false, reason: "expired" };
  if (!opts.parentUserId || parentBinding(opts.secret, opts.parentUserId) !== p.p) return { ok: false, reason: "parent" };
  return { ok: true, session: { kidId: p.k, householdId: p.h, exp: p.exp } };
}

export function kidCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: KID_SESSION_TTL_SEC };
}
