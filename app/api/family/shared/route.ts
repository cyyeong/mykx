// What the kids shared with their grown-ups from Vibe Zone (one version each; the kid can stop sharing). Grown-ups
// only, behind the parent PIN while a kid uses the device.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const [creations, kids] = await Promise.all([store.creations.list(parent.householdId), store.kids(parent.householdId)]);
    const shared = creations
      .filter((c) => c.sharedVersion !== null)
      .map((c) => ({ id: c.id, title: c.title, version: c.sharedVersion!, kid: kids.find((k) => k.id === c.kidId)?.nickname ?? "", spec: c.versions[c.sharedVersion! - 1] ?? null, updatedAt: c.updatedAt }));
    return ok({ shared });
  });
}
