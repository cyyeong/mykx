// One kid in "Your family". PATCH: reset the code (`secret: { kind: "pictures", code }` sets the 4 pictures the
// grown-up tapped; without a code it clears it so the kid chooses a new one at their door; a password sets a
// temporary one), daily limit, voice, focus camera, world.
// DELETE: remove the kid and everything they made, with `{ confirm: <their nickname> }`.
import { MagicNamesNotReadyError, UsernameTakenError } from "@/lib/auth/store";
import { currentParent, toFamilyKid, withAuth } from "@/lib/auth/context";
import { pinLockedResponse } from "@/lib/auth/pin";
import { nowIso } from "@/lib/auth/flows";
import { fail, ok, readBody } from "@/lib/auth/http";
import { isId, removeKidBody, updateKidBody } from "@/lib/auth/schemas";
import { hashSecret } from "@/lib/auth/secrets";
import type { ProfilePatch } from "@/lib/auth/store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
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
    if (body.interests !== undefined) {
      patch.interests = body.interests;
      fields.push("interests");
    }
    if (body.voiceEnabled !== undefined) {
      patch.voiceEnabled = body.voiceEnabled;
      fields.push("voice_enabled");
    }
    if (body.cameraEnabled !== undefined) {
      patch.cameraEnabled = body.cameraEnabled;
      fields.push("camera_enabled");
    }
    if (body.dailyLimitMin !== undefined) {
      patch.dailyLimitMin = body.dailyLimitMin;
      fields.push("daily_limit_min");
    }
    if (body.username !== undefined) {
      patch.username = body.username;
      fields.push("username");
    }
    if (body.secret) {
      const s = body.secret;
      const hash = s.kind === "password" ? await hashSecret(s) : s.code ? await hashSecret({ kind: "pictures", code: s.code }) : null;
      Object.assign(patch, { secretKind: s.kind, secretHash: hash, secretSetAt: nowIso(), secretEvent: "reset", failedAttempts: 0, lockedUntil: null });
      fields.push("secret");
    }

    let updated;
    try {
      updated = await store.update(parent.householdId, kid.id, patch);
    } catch (err) {
      if (err instanceof UsernameTakenError) return fail(409, "taken", { note: "That magic name is already taken. Try adding a word or a number." });
      if (err instanceof MagicNamesNotReadyError) return fail(503, "not-configured", { note: "Magic names need a one-time database update first (supabase/migrations/20261030_kid_username.sql)." });
      throw err;
    }
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
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
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
