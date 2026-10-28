// The magic-name door ticket (founder, 29 Oct): after a kid types their magic name on the sign-in page, a short,
// signed, http-only cookie remembers whose door came, so the next step (the picture code or password) never sends
// the name again. Ids only; ten minutes.
import type { CookieOptions } from "./http.ts";
import { signToken, verifyToken } from "./tokens.ts";

export const DOOR_COOKIE = "mykx_door";
const LABEL = "door-ticket";
const TTL_SEC = 10 * 60;

export function signDoorTicket(input: { kidId: string; householdId: string; now?: number }, secret: Buffer): string {
  return signToken(LABEL, { k: input.kidId, h: input.householdId, exp: Math.floor((input.now ?? Date.now()) / 1000) + TTL_SEC }, secret);
}

export function verifyDoorTicket(value: string | null | undefined, secret: Buffer, now = Date.now()): { kidId: string; householdId: string } | null {
  const checked = verifyToken<{ k?: unknown; h?: unknown; exp?: unknown }>(LABEL, value, secret);
  if (!checked.ok) return null;
  const { k, h, exp } = checked.payload;
  if (typeof k !== "string" || typeof h !== "string" || typeof exp !== "number" || Math.floor(now / 1000) >= exp) return null;
  return { kidId: k, householdId: h };
}

export function doorCookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_SEC };
}
