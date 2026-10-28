// The kid's session (ACCOUNTS.md §4.2): a short-lived, signed, http-only cookie. It holds ids only (no nickname, no
// secrets). On a grown-up's device it is tied to that grown-up's session and checked against them on every request,
// so a parent signing out (here or everywhere) ends it too. A kid who signs in with their magic name on the sign-in
// page gets a solo session instead (founder, 29 Oct): tied to the kid's current secret, so a parent's reset ends it.
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
  /** A solo session (magic name, no grown-up here): `sv` must match the kid's current secret. */
  solo?: { sv: string };
}

interface Payload {
  v: 1;
  k: string;
  h: string;
  p: string; // binding to the parent's auth user id (an HMAC, not the id itself), or "solo"
  /** Solo sessions: the secret version (an HMAC of the kid's secret hash). */
  s?: string;
  exp: number;
}

/** A short fingerprint of the kid's secret hash: changes whenever the code or password is reset. */
export function secretVersion(secret: Buffer, secretHash: string | null): string {
  return mac(secret, "secret-version", secretHash ?? "none").subarray(0, 12).toString("base64url");
}

function parentBinding(secret: Buffer, parentUserId: string): string {
  return mac(secret, "parent-binding", parentUserId).subarray(0, 18).toString("base64url");
}

export function signKidSession(
  input:
    | { kidId: string; householdId: string; parentUserId: string; now?: number; ttlSec?: number }
    | { kidId: string; householdId: string; soloSecretHash: string | null; now?: number; ttlSec?: number },
  secret: Buffer,
): string {
  const now = input.now ?? Date.now();
  const solo = "soloSecretHash" in input;
  const payload: Payload = {
    v: 1,
    k: input.kidId,
    h: input.householdId,
    p: solo ? "solo" : parentBinding(secret, input.parentUserId),
    ...(solo ? { s: secretVersion(secret, input.soloSecretHash) } : {}),
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
  // Solo: the caller checks `solo.sv` against the kid's current secret.
  if (p.p === "solo") return typeof p.s === "string" ? { ok: true, session: { kidId: p.k, householdId: p.h, exp: p.exp, solo: { sv: p.s } } } : { ok: false, reason: "malformed" };
  if (!opts.parentUserId || parentBinding(opts.secret, opts.parentUserId) !== p.p) return { ok: false, reason: "parent" };
  return { ok: true, session: { kidId: p.k, householdId: p.h, exp: p.exp } };
}

export function kidCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: KID_SESSION_TTL_SEC };
}
