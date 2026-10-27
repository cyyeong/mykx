// One kid in "Your family". PATCH: reset the code (`secret: { kind: "pictures" }` clears it so the kid
// chooses a new one at their door; a password sets a temporary one), daily limit, voice, world.
// DELETE: remove the kid and everything they made, with `{ confirm: <their nickname> }`.
import { currentParent, toFamilyKid, withAuth } from "@/lib/auth/context";
import { nowIso } from "@/lib/auth/flows";
import { fail, ok, readBody } from "@/lib/auth/http";
import { isId, removeKidBody, updateKidBody } from "@/lib/auth/schemas";
import { hashSecret } from "@/lib/auth/secrets";
import type { ProfilePatch } from "@/lib/auth/store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const kid = isId(id) ? await store.kid(parent.householdId, id) : null;
    if (!kid) return fail(404, "not-found");
    const body = await readBody(request, updateKidBody);
    if (!body) return fail(400, "invalid");

    const patch: ProfilePatch = {};
    const fields: string[] = [];
    if (body.pack !== undefined) {
      patch.pack = body.pack;
      fields.push("pack");
    }
    if (body.voiceEnabled !== undefined) {
      patch.voiceEnabled = body.voiceEnabled;
      fields.push("voice_enabled");
    }
    if (body.dailyLimitMin !== undefined) {
      patch.dailyLimitMin = body.dailyLimitMin;
      fields.push("daily_limit_min");
    }
    if (body.secret) {
      const s = body.secret;
      const hash = s.kind === "password" ? await hashSecret(s) : s.code ? await hashSecret({ kind: "pictures", code: s.code }) : null;
      Object.assign(patch, { secretKind: s.kind, secretHash: hash, secretSetAt: nowIso(), secretEvent: "reset", failedAttempts: 0, lockedUntil: null });
      fields.push("secret");
    }

    const updated = await store.update(parent.householdId, kid.id, patch);
    if (!updated) return fail(404, "not-found");
    await store.audit({
      actor: parent.profile.id,
      actorRole: "parent",
      action: body.secret ? "kid.secret-reset" : "kid.update",
      target: kid.id,
      householdId: parent.householdId,
      detail: { fields },
    });
    return ok({ kid: toFamilyKid(updated) });
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const kid = isId(id) ? await store.kid(parent.householdId, id) : null;
    if (!kid) return fail(404, "not-found");
    const body = await readBody(request, removeKidBody);
    if (!body) return fail(400, "invalid");
    if (body.confirm.trim() !== kid.nickname) return fail(400, "confirm");
    if (!(await store.removeKid(parent.householdId, kid.id))) return fail(404, "not-found");
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "kid.remove", target: kid.id, householdId: parent.householdId });
    return ok({});
  });
}
