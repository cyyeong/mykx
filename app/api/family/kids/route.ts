// "Your family": the parent lists their kids and adds one. Level sets the band. A picture-code kid can
// be added without a code (chosen with the kid at their door); a password kid needs a starting one.
import { currentParent, toFamilyKid, withAuth } from "@/lib/auth/context";
import { nowIso } from "@/lib/auth/flows";
import { fail, ok, readBody } from "@/lib/auth/http";
import { addKidBody, DEFAULT_SECRET_KIND, LEVEL_BAND } from "@/lib/auth/schemas";
import { hashSecret } from "@/lib/auth/secrets";
import { NicknameTakenError } from "@/lib/auth/store";

const MAX_KIDS = 8;

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const [household, kids] = await Promise.all([store.household(parent.householdId), store.kids(parent.householdId)]);
    return ok({ household: { id: parent.householdId, name: household?.name ?? "Your family" }, kids: kids.map((k) => toFamilyKid(k)) });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const body = await readBody(request, addKidBody);
    if (!body) return fail(400, "invalid");

    const band = LEVEL_BAND[body.level];
    const secret = body.secret ?? (DEFAULT_SECRET_KIND[band] === "pictures" ? { kind: "pictures" as const } : null);
    if (!secret) return fail(400, "invalid"); // a password kid needs a starting password
    if ((await store.kids(parent.householdId)).length >= MAX_KIDS) return fail(409, "too-many");

    const secretHash =
      secret.kind === "password" ? await hashSecret(secret) : secret.code ? await hashSecret({ kind: "pictures", code: secret.code }) : null;
    const hasCode = secretHash !== null;
    try {
      const kid = await store.addKid(parent.householdId, {
        nickname: body.nickname,
        band,
        level: body.level,
        pack: body.pack,
        secretKind: secret.kind,
        secretHash,
        secretSetAt: hasCode ? nowIso() : null,
        secretEvent: hasCode ? "set" : null,
      });
      await store.audit({
        actor: parent.profile.id,
        actorRole: "parent",
        action: "kid.add",
        target: kid.id,
        householdId: parent.householdId,
        detail: { level: body.level, secretKind: secret.kind, needsSetup: !hasCode },
      });
      return ok({ kid: toFamilyKid(kid) }, 201);
    } catch (err) {
      if (err instanceof NicknameTakenError) return fail(409, "taken");
      throw err;
    }
  });
}
