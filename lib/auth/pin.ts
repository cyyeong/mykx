// The parent PIN (USER_STORIES §8.4 fix 8, HANDOFF task 4): a 4-digit code set
// in Your family, asked on grown-up pages on a device kids use. Verified
// server-side; a correct entry mints a short-lived signed unlock cookie bound
// to the grown-up signed in right now.
//
// "A device kids use" is a kid session now OR the kids-here cookie, which a
// kid sign-in sets and a kid sign-out (Switch profile) leaves alone, so a kid
// can't step out of their own session to reach grown-up pages. Only the
// grown-up's password clears it: signing out, or signing in again.
import { currentKid, currentParent, type Parent } from "./context.ts";
import { fail, type CookieJar, type CookieOptions } from "./http.ts";
import type { AuthStore } from "./store.ts";
import { mac, sessionSecret, signToken, verifyToken } from "./tokens.ts";

export const PIN_UNLOCK_COOKIE = "mykx_pinunlock";
export const PIN_UNLOCK_TTL_SEC = 15 * 60;
export const KIDS_HERE_COOKIE = "mykx_kidshere";
export const KIDS_HERE_TTL_SEC = 30 * 24 * 60 * 60;
/** Wrong PINs per household before a pause; counted from the audit log, never from the grown-up's own lockout. */
export const PIN_MAX_WRONG = 5;
export const PIN_WRONG_WINDOW_MS = 5 * 60_000;
const LABEL = "pin-unlock";
const KIDS_HERE_LABEL = "kids-here";

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

/** Marks this device as one kids use (set at kid sign-in; bound to the household and the grown-up). */
export function signKidsHere(input: { householdId: string; parentUserId: string; now?: number }, secret: Buffer): string {
  const now = input.now ?? Date.now();
  const payload: UnlockPayload = {
    v: 1,
    h: input.householdId,
    p: parentBinding(secret, input.parentUserId),
    exp: Math.floor(now / 1000) + KIDS_HERE_TTL_SEC,
  };
  return signToken(KIDS_HERE_LABEL, payload, secret);
}

function verifyKidsHere(value: string | null | undefined, opts: { householdId: string; parentUserId: string; secret: Buffer }): boolean {
  const checked = verifyToken<UnlockPayload>(KIDS_HERE_LABEL, value, opts.secret);
  if (!checked.ok) return false;
  const p = checked.payload;
  return p.v === 1 && p.h === opts.householdId && p.p === parentBinding(opts.secret, opts.parentUserId) && Math.floor(Date.now() / 1000) < p.exp;
}

export function kidsHereCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: KIDS_HERE_TTL_SEC };
}

/** Ends the grown-up's proof on this device: the unlock and the kids-here mark (a full grown-up sign-out or sign-in). */
export function clearGrownUpProof(jar: CookieJar): void {
  jar.delete(PIN_UNLOCK_COOKIE);
  jar.delete(KIDS_HERE_COOKIE);
}

export type GrownUpAccess = {
  /** open: the grown-up's pages and data; pin: ask the PIN; setup: no PIN yet on a device kids use. */
  state: "open" | "pin" | "setup";
  kidActive: boolean;
  /** Kids use this device (a kid session now, or the kids-here mark once a PIN is set). */
  shared: boolean;
  unlocked: boolean;
};

/**
 * The one shared-device check behind every grown-up page and data route.
 * Open on a grown-up-only device, or with a valid 15-minute unlock; otherwise
 * the PIN (or its setup) is needed. Null when no grown-up is signed in.
 */
export async function grownUpAccess(store: AuthStore, jar: CookieJar, known?: Parent | null): Promise<(GrownUpAccess & { parent: Parent }) | null> {
  const parent = known === undefined ? await currentParent(store, jar) : known;
  if (!parent) return null;
  const kidActive = (await currentKid(store, jar, parent)) !== null;
  const secret = sessionSecret();
  const binding = secret ? { householdId: parent.householdId, parentUserId: parent.user.userId, secret } : null;
  // The kids-here mark counts once a PIN exists; before that, the grown-up
  // needs a kid-free moment to set one (Your family asks for it).
  const shared = kidActive || (!!parent.profile.pinHash && !!binding && verifyKidsHere(jar.get(KIDS_HERE_COOKIE), binding));
  const unlocked = !!binding && verifyPinUnlock(jar.get(PIN_UNLOCK_COOKIE), binding).ok;
  const state = !shared || unlocked ? "open" : parent.profile.pinHash ? "pin" : "setup";
  return { parent, state, kidActive, shared, unlocked };
}

/**
 * The data-route half of the gate: on a device kids use, without a valid
 * unlock, grown-up reads and writes are refused, so a kid past the page shell
 * (or one who switched themselves out) still can't reach the family's data.
 * Null means open (routes answer 401 themselves when nobody's grown-up is here).
 */
export async function pinLockedResponse(store: AuthStore, jar: CookieJar): Promise<Response | null> {
  const access = await grownUpAccess(store, jar);
  return !access || access.state === "open" ? null : fail(403, "not-allowed");
}
