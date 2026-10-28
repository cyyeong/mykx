// Home Link computers and the Home simulator, for the grown-up (GUARDIAN §2.2). Behind the parent PIN, audited.
//   GET:    devices and their cameras.
//   POST:   a new device and its one-time pairing code (shown once; only its hash is kept; runs out in 15 minutes).
//   DELETE: revoke a device: its token stops working at once.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { PAIR_CODE_MINUTES, newPairCode, normalizePairCode, sha256Hex } from "@/lib/home-watch/home-watch";
import { deviceDeleteBody, newDeviceBody } from "@/lib/home-watch/schemas";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const [devices, cameras] = await Promise.all([store.homeWatch.devices(parent.householdId), store.homeWatch.cameras(parent.householdId)]);
    return ok({ devices: devices.filter((d) => !d.revokedAt), cameras });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, newDeviceBody);
    if (!body) return fail(400, "invalid");
    if ((await store.homeWatch.devices(parent.householdId)).filter((d) => !d.revokedAt).length >= 4) return fail(409, "too-many");
    const code = newPairCode();
    const device = await store.homeWatch.createDevice(parent.householdId, { name: body.name, kind: body.kind, pairCodeHash: sha256Hex(normalizePairCode(code)), pairExpiresAt: new Date(Date.now() + PAIR_CODE_MINUTES * 60_000).toISOString(), createdBy: parent.profile.id });
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "home.device-add", target: device.id, householdId: parent.householdId, detail: { kind: device.kind } });
    return ok({ device, code });
  });
}

export async function DELETE(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, deviceDeleteBody);
    if (!body) return fail(400, "invalid");
    if (!(await store.homeWatch.revokeDevice(parent.householdId, body.id))) return fail(404, "not-found");
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "home.device-revoke", target: body.id, householdId: parent.householdId });
    return ok({});
  });
}
