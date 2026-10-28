// A grown-up marks a guardian flag as seen. Flags are computed, never stored; only the seen mark is.
import { z } from "zod";
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";

const seenBody = z.strictObject({ flagId: z.string().min(1).max(200) });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, seenBody);
    if (!body) return fail(400, "invalid");
    await store.guardian.markSeen(parent.householdId, body.flagId);
    return ok({});
  });
}
