import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_LOCK_UNTIL, afterFailure, lockRemainingSec, MAX_TRIES, resetRateLimits, retryAfter, takeToken } from "./lockout.ts";

const NOW = Date.UTC(2026, 9, 27, 8, 0, 0);

describe("lockout rules", () => {
  it("counts down four tries, then the fifth locks for a minute and resets the count", () => {
    let failed = 0;
    const left: number[] = [];
    for (let i = 1; i < MAX_TRIES; i++) {
      const o = afterFailure(failed, NOW);
      expect(o.locked).toBe(false);
      left.push(o.triesLeft);
      failed = o.failedAttempts;
    }
    expect(left).toEqual([4, 3, 2, 1]);
    const fifth = afterFailure(failed, NOW);
    expect(fifth).toEqual({ failedAttempts: 0, lockedUntil: new Date(NOW + 60_000).toISOString(), locked: true, triesLeft: 0 });
    expect(lockRemainingSec(fifth.lockedUntil, NOW)).toBe(60);
    expect(lockRemainingSec(fifth.lockedUntil, NOW + 60_000)).toBe(0);
  });

  it("an admin lock has no countdown", () => {
    expect(retryAfter(ADMIN_LOCK_UNTIL, NOW)).toBeNull();
    expect(retryAfter(new Date(NOW + 30_000).toISOString(), NOW)).toBe(30);
    expect(lockRemainingSec(null, NOW)).toBe(0);
  });
});

describe("per-IP limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows `max` per window per IP, then asks to wait", () => {
    for (let i = 0; i < 3; i++) expect(takeToken("t", "1.2.3.4", 3, 60_000, NOW).ok).toBe(true);
    expect(takeToken("t", "1.2.3.4", 3, 60_000, NOW + 1000)).toEqual({ ok: false, retryAfterSec: 59 });
    expect(takeToken("t", "5.6.7.8", 3, 60_000, NOW).ok).toBe(true);
    expect(takeToken("t", "1.2.3.4", 3, 60_000, NOW + 60_000).ok).toBe(true);
  });
});
