// For the Home simulator only: the paired family's kids (id, nickname, band), so its scripted route and camera
// frames can be about this household's kids. Nothing else about them; Home Link never needs it.
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { requireDevice } from "@/lib/home-watch/device-auth";

export async function GET(request: Request) {
  return withAuth(request, async ({ store }) => {
    const auth = await requireDevice(store, request, "home-family", 10);
    if (auth.refused) return auth.refused;
    if (auth.device.kind !== "simulator") return fail(403, "not-allowed");
    const kids = await store.kids(auth.device.householdId);
    return ok({ kids: kids.map((k) => ({ id: k.id, nickname: k.nickname, band: k.band })) });
  });
}
