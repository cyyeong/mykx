// Admin "People": search households and accounts (household name, nickname, id, or a parent's email).
// Admin flag checked on the server; account details only, never a child's content.
import { requireAdmin, toHouseholdRows } from "@/lib/auth/admin";
import { pinLockedResponse } from "@/lib/auth/pin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
    const hits = await store.admin.search(q, 25);
    return ok({ households: await toHouseholdRows(store, hits) });
  });
}
