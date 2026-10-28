// Server only: who is calling a device route (Home Link, the Home simulator). A device proves itself with
// `Authorization: Bearer hl_…`; only the token's SHA-256 is stored. Each device gets its own per-minute budget.
import { fail } from "../auth/http.ts";
import { takeToken } from "../auth/lockout.ts";
import type { AuthStore } from "../auth/store.ts";
import { bearerToken, sha256Hex, type HomeDevice } from "./home-watch.ts";

export async function requireDevice(store: AuthStore, request: Request, bucket: string, perMinute: number): Promise<{ device: HomeDevice; refused: null } | { device: null; refused: Response }> {
  const token = bearerToken(request);
  if (!token) return { device: null, refused: fail(401, "wrong") };
  const device = await store.homeWatch.deviceByToken(sha256Hex(token));
  if (!device) return { device: null, refused: fail(401, "wrong") };
  const budget = takeToken(bucket, device.id, perMinute);
  if (!budget.ok) return { device: null, refused: fail(429, "slow-down", { retryAfterSec: budget.retryAfterSec }) };
  return { device, refused: null };
}

/** Midnight in Singapore today, as an ISO time (the parent's "today"). */
export function sgMidnightIso(now: Date): string {
  const sg = new Date(now.getTime() + 8 * 3_600_000);
  return new Date(Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), sg.getUTCDate()) - 8 * 3_600_000).toISOString();
}
