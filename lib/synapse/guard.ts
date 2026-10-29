// The admin check every Kix Synapse admin route makes: signed in, PIN unlocked, admin.
import { requireAdmin } from "../auth/admin.ts";
import type { CookieJar } from "../auth/http.ts";
import { pinLockedResponse } from "../auth/pin.ts";
import type { AuthStore } from "../auth/store.ts";
import { fail } from "../auth/http.ts";

export async function synapseAdmin(store: AuthStore, jar: CookieJar): Promise<{ refused: Response } | { refused: null; adminId: string; householdId: string }> {
  const locked = await pinLockedResponse(store, jar);
  if (locked) return { refused: locked };
  const admin = await requireAdmin(store, jar);
  if (!admin) return { refused: fail(403, "not-allowed") };
  return { refused: null, adminId: admin.profile.id, householdId: admin.householdId };
}
