// The parent dashboard's guardian picture for one kid (docs/prd/PARENT_INSIGHTS.md §1-2): screen time against the
// limit, learning sessions with focus and mood, the flags with their evidence, and Kix's next step. Grown-ups only,
// behind the parent PIN while a kid uses the device.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { loadGuardianView } from "@/lib/guardian/load";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const kids = await store.kids(parent.householdId);
    if (!kids.length) return ok({ kids: [], kid: null, view: null });
    const wanted = new URL(request.url).searchParams.get("kid");
    const kid = kids.find((k) => k.id === wanted) ?? kids[0];
    const view = await loadGuardianView(store, parent.householdId, kid);
    return ok({ kids: kids.map((k) => ({ id: k.id, nickname: k.nickname, band: k.band, level: k.level })), kid: { id: kid.id, nickname: kid.nickname, band: kid.band, level: kid.level }, view });
  });
}
