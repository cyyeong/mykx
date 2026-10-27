// Admin actions on one account. Every action writes audit_log. A kid reset clears the code so the old
// one stops working and the parent sets (or the kid chooses) a new one; a parent reset sends the
// Supabase reset email. Admins can't lock, disable or demote themselves.
import { requireAdmin, toPerson } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { nowIso } from "@/lib/auth/flows";
import { fail, ok, readBody } from "@/lib/auth/http";
import { ADMIN_LOCK_UNTIL } from "@/lib/auth/lockout";
import { adminActionBody, isId, type AdminAction } from "@/lib/auth/schemas";
import type { Profile, ProfilePatch } from "@/lib/auth/store";

type Ctx = { params: Promise<{ id: string }> };

const SELF_BLOCKED: AdminAction[] = ["lock", "disable", "revoke-admin"];
const PARENT_ONLY: AdminAction[] = ["grant-admin", "revoke-admin", "reset-parent-password"];

function patchFor(action: AdminAction): ProfilePatch | null {
  switch (action) {
    case "lock":
      return { lockedUntil: ADMIN_LOCK_UNTIL };
    case "unlock":
      return { lockedUntil: null, failedAttempts: 0 };
    case "disable":
      return { disabledAt: nowIso() };
    case "enable":
      return { disabledAt: null };
    case "grant-admin":
      return { isAdmin: true };
    case "revoke-admin":
      return { isAdmin: false };
    case "reset-kid-secret":
      return { secretHash: null, secretSetAt: nowIso(), secretEvent: "reset", failedAttempts: 0, lockedUntil: null };
    case "reset-parent-password":
      return null;
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const body = await readBody(request, adminActionBody);
    if (!body) return fail(400, "invalid");
    const target = isId(id) ? await store.admin.profile(id) : null;
    if (!target) return fail(404, "not-found");
    const { action } = body;
    if (target.id === admin.profile.id && SELF_BLOCKED.includes(action)) return fail(400, "self");
    if (PARENT_ONLY.includes(action) && target.role !== "parent") return fail(400, "not-allowed");
    if (action === "reset-kid-secret" && target.role !== "child") return fail(400, "not-allowed");

    let updated: Profile = target;
    const patch = patchFor(action);
    if (patch) updated = (await store.admin.update(target.id, patch)) ?? target;
    if (target.userId && (action === "disable" || action === "enable")) await store.admin.setBanned(target.userId, action === "disable");
    let email: string | null = null;
    if (target.userId) email = (await store.admin.emails([target.userId])).get(target.userId) ?? null;
    if (action === "reset-parent-password" && email) await store.sendPasswordReset(email, new URL("/signin", request.url).toString());

    await store.audit({
      actor: admin.profile.id,
      actorRole: "admin",
      action: `admin.${action}`,
      target: target.id,
      householdId: target.householdId,
      detail: { role: target.role, ...(action === "reset-parent-password" ? { emailSent: email !== null } : {}) },
    });
    return ok({ person: toPerson(updated, email) });
  });
}
