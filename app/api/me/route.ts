// "Me": the signed-in kid reads their account and changes their nickname or their own code/password
// (old one first, same kind). Needs both the kid cookie and the grown-up's session on this device.
import { currentKid, currentParent, toKidMe, withAuth, type RouteCtx } from "@/lib/auth/context";
import { checkKidSecret, nowIso } from "@/lib/auth/flows";
import { fail, ok, readBody } from "@/lib/auth/http";
import { KID_COOKIE } from "@/lib/auth/kid-session";
import { mePatchBody } from "@/lib/auth/schemas";
import { hashSecret } from "@/lib/auth/secrets";
import { NicknameTakenError, type ProfilePatch } from "@/lib/auth/store";

async function signedInKid({ store, jar }: RouteCtx) {
  const parent = await currentParent(store, jar);
  const kid = await currentKid(store, jar, parent);
  if (!kid && jar.get(KID_COOKIE)) jar.delete(KID_COOKIE);
  return kid;
}

export async function GET(request: Request) {
  return withAuth(request, async (ctx) => {
    const kid = await signedInKid(ctx);
    return kid ? ok({ kid: toKidMe(kid) }) : fail(401, "no-kid");
  });
}

export async function PATCH(request: Request) {
  return withAuth(request, async (ctx) => {
    const kid = await signedInKid(ctx);
    if (!kid) return fail(401, "no-kid");
    const body = await readBody(request, mePatchBody);
    if (!body) return fail(400, "invalid");

    const patch: ProfilePatch = {};
    const changed: string[] = [];
    if (body.secret) {
      if (body.secret.old.kind !== body.secret.new.kind || (kid.secretKind && body.secret.new.kind !== kid.secretKind)) return fail(400, "wrong-kind");
      const refused = await checkKidSecret(ctx.store, kid, body.secret.old);
      if (refused) return refused;
      Object.assign(patch, { secretHash: await hashSecret(body.secret.new), secretSetAt: nowIso(), secretEvent: "changed" });
      changed.push("secret");
    }
    if (body.nickname !== undefined && body.nickname !== kid.nickname) {
      patch.nickname = body.nickname;
      changed.push("nickname");
    }

    let updated = kid;
    if (changed.length) {
      try {
        updated = (await ctx.store.update(kid.householdId, kid.id, patch)) ?? kid;
      } catch (err) {
        if (err instanceof NicknameTakenError) return fail(409, "taken");
        throw err;
      }
      await ctx.store.audit({ actor: kid.id, actorRole: "kid", action: "kid.self-update", target: kid.id, householdId: kid.householdId, detail: { fields: changed } });
    }
    return ok({ kid: toKidMe(updated) });
  });
}
