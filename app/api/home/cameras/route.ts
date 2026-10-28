// A device tells myKx its cameras (up to 10): a key and a room each. A bathroom or any bedroom is refused (rule 15).
// Cameras it no longer lists are switched off, not deleted, so their history stays until it expires.
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { requireDevice } from "@/lib/home-watch/device-auth";
import { forbiddenRoom, roomKindOf } from "@/lib/home-watch/home-watch";
import { camerasBody } from "@/lib/home-watch/schemas";

export async function PUT(request: Request) {
  return withAuth(request, async ({ store }) => {
    const auth = await requireDevice(store, request, "home-cameras", 10);
    if (auth.refused) return auth.refused;
    const body = await readBody(request, camerasBody);
    if (!body) return fail(400, "invalid");
    const blocked = body.cameras.find((c) => forbiddenRoom(c.room));
    if (blocked) return fail(400, "not-allowed", { note: `No camera may look at a bathroom or a bedroom (“${blocked.room.slice(0, 40)}”).` });
    if (new Set(body.cameras.map((c) => c.key)).size !== body.cameras.length) return fail(400, "invalid");
    const cameras = await store.homeWatch.syncCameras(auth.device.householdId, auth.device.id, body.cameras.map((c) => ({ ...c, roomKind: roomKindOf(c.room) })));
    return ok({ cameras });
  });
}
