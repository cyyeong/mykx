// Wrong-code lockout (ACCOUNTS.md §2, §4.1) and a per-IP limiter on top. Deterministic and pure apart
// from the limiter's in-memory map, so the same rules run on the demo store and on Supabase.

export const MAX_TRIES = 5;
export const LOCK_MS = 60_000;
/** An admin lock: far enough ahead that only "unlock" ends it. */
export const ADMIN_LOCK_UNTIL = "9999-12-31T23:59:59.000Z";

/** Seconds until the lock lifts; 0 when not locked. */
export function lockRemainingSec(lockedUntil: string | null, now: number = Date.now()): number {
  if (!lockedUntil) return 0;
  const until = Date.parse(lockedUntil);
  return Number.isFinite(until) && until > now ? Math.ceil((until - now) / 1000) : 0;
}

/** The value for a 423 reply: seconds to wait, or null for an admin lock (a grown-up must unlock). */
export function retryAfter(lockedUntil: string | null, now: number = Date.now()): number | null {
  const sec = lockRemainingSec(lockedUntil, now);
  return sec > 24 * 60 * 60 ? null : sec;
}

export interface FailureOutcome {
  failedAttempts: number;
  lockedUntil: string | null;
  /** True when this failure started a lock. */
  locked: boolean;
  triesLeft: number;
}

/** One more wrong try. The fifth locks for a minute and resets the count for after the pause. */
export function afterFailure(failedAttempts: number, now: number = Date.now()): FailureOutcome {
  const next = Math.max(0, failedAttempts) + 1;
  if (next >= MAX_TRIES) return { failedAttempts: 0, lockedUntil: new Date(now + LOCK_MS).toISOString(), locked: true, triesLeft: 0 };
  return { failedAttempts: next, lockedUntil: null, locked: false, triesLeft: MAX_TRIES - next };
}

/** A right answer clears the count (only reachable when not locked). */
export const AFTER_SUCCESS = { failedAttempts: 0, lockedUntil: null } as const;

// Per-IP limiter: a fixed window per (bucket, ip). In memory, so per server instance; the lockout above
// is the real guard and lives in the database.
type Window = { count: number; resetAt: number };
const g = globalThis as typeof globalThis & { __mykxRateLimits?: Map<string, Window> };
const windows = (g.__mykxRateLimits ??= new Map<string, Window>());

export function takeToken(bucket: string, ip: string, max: number, windowMs = 60_000, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
  if (windows.size > 10_000) for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
  const key = `${bucket}:${ip}`;
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (w.count >= max) return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  w.count += 1;
  return { ok: true };
}

/** Tests only. */
export function resetRateLimits() {
  windows.clear();
}
