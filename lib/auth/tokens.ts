// Signed cookie values: base64url(JSON payload) + "." + base64url(HMAC-SHA256). Each use has its own
// label, so a token minted for one cookie never verifies as another. Server only (node:crypto).
import { createHmac, timingSafeEqual } from "node:crypto";

/** Dev-only fallback, so `npm run dev` works before KID_SESSION_SECRET is set. Never used in production. */
const DEV_SECRET = "mykx-dev-only-session-secret-never-use-in-production";
export const MIN_SECRET_BYTES = 32;

/**
 * The HMAC key from KID_SESSION_SECRET (at least 32 bytes). Outside production a missing secret falls
 * back to a fixed dev key; in production it returns null and the kid routes answer 503.
 */
export function sessionSecret(env: Record<string, string | undefined> = process.env): Buffer | null {
  const value = env.KID_SESSION_SECRET?.trim();
  if (value && Buffer.byteLength(value, "utf8") >= MIN_SECRET_BYTES) return Buffer.from(value, "utf8");
  if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") return null;
  return Buffer.from(DEV_SECRET, "utf8");
}

export function mac(secret: Buffer, label: string, data: string): Buffer {
  return createHmac("sha256", secret).update(`mykx:${label}\0${data}`).digest();
}

export function signToken(label: string, payload: object, secret: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${mac(secret, label, body).toString("base64url")}`;
}

export type TokenCheck<T> = { ok: true; payload: T } | { ok: false; reason: "malformed" | "signature" };

/** Checks the signature and returns the parsed payload. Expiry and fields are the caller's job. */
export function verifyToken<T = Record<string, unknown>>(label: string, token: string | null | undefined, secret: Buffer): TokenCheck<T> {
  if (typeof token !== "string" || token.length > 2048) return { ok: false, reason: "malformed" };
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return { ok: false, reason: "malformed" };
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(sig)) return { ok: false, reason: "malformed" };
  const expected = mac(secret, label, body);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "signature" };
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, reason: "malformed" };
    return { ok: true, payload: payload as T };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
