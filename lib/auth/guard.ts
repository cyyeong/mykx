// Guard for routes that spend Meta credit (Studio transform, voice): a grown-up must be signed in on this
// device, and each household gets a small per-minute budget. Voice also honours the parent's per-child
// switch (hard rule 9). Returns a ready refusal, or who is asking.
import { currentKid, currentParent, getStore } from "./context.ts";
import { RequestCookieJar, fail } from "./http.ts";
import { takeToken } from "./lockout.ts";
import type { Profile } from "./store.ts";

export type FamilyCheck = { refused: Response } | { refused: null; householdId: string; kid: Profile | null };

export async function requireFamily(request: Request, bucket: string, perMinute: number): Promise<FamilyCheck> {
  let store;
  try {
    store = getStore();
  } catch {
    store = null;
  }
  if (!store) return { refused: fail(503, "not-configured") };
  const jar = new RequestCookieJar(request);
  const parent = await currentParent(store, jar);
  // A kid who signed in with their magic name has no grown-up on this device: their own session says the family.
  const kid = await currentKid(store, jar, parent);
  const householdId = parent?.householdId ?? kid?.householdId;
  if (!householdId) return { refused: fail(401, "no-parent") };
  const budget = takeToken(bucket, householdId, perMinute);
  if (!budget.ok) return { refused: fail(429, "slow-down", { retryAfterSec: budget.retryAfterSec }) };
  return { refused: null, householdId, kid };
}
