// Kid picture codes and passwords, hashed with scrypt (ACCOUNTS.md §4.1). Server only: it uses
// node:crypto. The UI imports picture ids and schemas from ./schemas.ts instead.
// Stored form: scrypt$N$r$p$<salt>$<hash>, salt and hash base64url, so parameters can change later
// without breaking old hashes.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { canonicalSecret, type SecretAttempt } from "./schemas.ts";

export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, saltBytes: 16, keyBytes: 32 } as const;

// Bounds for stored hashes, so a tampered row can't make verify burn memory or CPU.
const MAX_N = 1 << 17;
const MAX_R = 16;
const MAX_P = 4;

function derive(secret: string, salt: Buffer, keyBytes: number, N: number, r: number, p: number): Promise<Buffer> {
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r + 1024 * 1024 };
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, keyBytes, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

const B64URL = /^[A-Za-z0-9_-]+$/;

/** Parses a stored hash, or null if it isn't one this code wrote (or is out of bounds). */
export function parseSecretHash(stored: string | null | undefined): ParsedHash | null {
  if (typeof stored !== "string") return null;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = parts.slice(1, 4).map((x) => (/^\d{1,7}$/.test(x) ? Number(x) : NaN));
  if (!Number.isInteger(N) || N < 2 || N > MAX_N || (N & (N - 1)) !== 0) return null;
  if (!Number.isInteger(r) || r < 1 || r > MAX_R || !Number.isInteger(p) || p < 1 || p > MAX_P) return null;
  if (!B64URL.test(parts[4]) || !B64URL.test(parts[5])) return null;
  const salt = Buffer.from(parts[4], "base64url");
  const hash = Buffer.from(parts[5], "base64url");
  if (salt.length < 8 || hash.length < 16 || hash.length > 64) return null;
  return { N, r, p, salt, hash };
}

/** Hashes a canonical secret string (see canonicalSecret). */
export async function hashCanonical(secret: string): Promise<string> {
  const { N, r, p, saltBytes, keyBytes } = SCRYPT_PARAMS;
  const salt = randomBytes(saltBytes);
  const hash = await derive(secret, salt, keyBytes, N, r, p);
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** Hashes a picture code or password for storage. */
export function hashSecret(secret: SecretAttempt): Promise<string> {
  return hashCanonical(canonicalSecret(secret));
}

// A fixed, valid hash to check against when there's nothing stored, so a missing secret takes as
// long to reject as a wrong one.
const DUMMY = `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${Buffer.alloc(16, 7).toString("base64url")}$${Buffer.alloc(32, 9).toString("base64url")}`;

/** True when `secret` matches the stored hash. False for a missing or malformed hash. */
export async function verifyCanonical(secret: string, stored: string | null | undefined): Promise<boolean> {
  const parsed = parseSecretHash(stored);
  const target = parsed ?? (parseSecretHash(DUMMY) as ParsedHash);
  const key = await derive(secret, target.salt, target.hash.length, target.N, target.r, target.p);
  return parsed !== null && key.length === target.hash.length && timingSafeEqual(key, target.hash);
}

/** True when the attempt matches the stored hash. */
export function verifySecret(secret: SecretAttempt, stored: string | null | undefined): Promise<boolean> {
  return verifyCanonical(canonicalSecret(secret), stored);
}
