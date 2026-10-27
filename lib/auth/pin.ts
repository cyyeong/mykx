// The parent PIN (USER_STORIES §8.4 fix 8, HANDOFF task 4): a 4-digit code set
// once in Your family, asked on grown-up pages while a kid session is active
// on the device. Verified server-side; a correct entry mints a short-lived
// signed unlock cookie bound to the grown-up signed in right now.
import type { CookieOptions } from "./http.ts";
import { mac, signToken, verifyToken } from "./tokens.ts";

export const PIN_UNLOCK_COOKIE = "mykx_pinunlock";
export const PIN_UNLOCK_TTL_SEC = 15 * 60;
const LABEL = "pin-unlock";

/** Destinations a post-sign-in `next` may point at (fix 6). Prefix match on path segments. */
const NEXT_ALLOWLIST = ["/parent", "/family", "/papers", "/admin/people", "/admin/skills"];

/** A safe landing path, or null when `next` is missing, off-site or off-list. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  const path = next.split(/[?#]/)[0];
  if (NEXT_ALLOWLIST.some((p) => path === p || path.startsWith(`${p}/`))) return next;
  return fallback;
}

interface UnlockPayload {
  v: 1;
  h: string; // household id
  p: string; // binding to the grown-up's auth user id (an HMAC, not the id itself)
  exp: number;
}

function parentBinding(secret: Buffer, parentUserId: string): string {
  return mac(secret, "parent-binding", parentUserId).subarray(0, 18).toString("base64url");
}

export function signPinUnlock(input: { householdId: string; parentUserId: string; now?: number; ttlSec?: number }, secret: Buffer): string {
  const now = input.now ?? Date.now();
  const payload: UnlockPayload = {
    v: 1,
    h: input.householdId,
    p: parentBinding(secret, input.parentUserId),
    exp: Math.floor(now / 1000) + (input.ttlSec ?? PIN_UNLOCK_TTL_SEC),
  };
  return signToken(LABEL, payload, secret);
}

export type PinUnlockCheck = { ok: true } | { ok: false };

/** Checks signature, expiry, household and the binding to the grown-up on this device right now. */
export function verifyPinUnlock(
  value: string | null | undefined,
  opts: { householdId: string; parentUserId: string | null; secret: Buffer; now?: number },
): PinUnlockCheck {
  const checked = verifyToken<UnlockPayload>(LABEL, value, opts.secret);
  if (!checked.ok) return checked;
  const p = checked.payload;
  if (p.v !== 1 || typeof p.h !== "string" || typeof p.p !== "string" || typeof p.exp !== "number") return { ok: false };
  if (Math.floor((opts.now ?? Date.now()) / 1000) >= p.exp) return { ok: false };
  if (p.h !== opts.householdId) return { ok: false };
  if (!opts.parentUserId || parentBinding(opts.secret, opts.parentUserId) !== p.p) return { ok: false };
  return { ok: true };
}

export function pinUnlockCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: PIN_UNLOCK_TTL_SEC };
}
