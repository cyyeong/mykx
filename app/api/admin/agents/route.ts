// Under the hood's agent list (founder, 29 Oct): every agent, whether it has instructions an admin can edit, and the
// version Kix uses now (1 is the built-in default). Admins only, behind the parent PIN. Platform content only.
import { agentList } from "@/lib/agents/catalog";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const rows = await store.agents.versions().catch(() => []);
    return ok({ agents: agentList(rows) });
  });
}
