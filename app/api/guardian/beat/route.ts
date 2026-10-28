// The kid's heartbeat (docs/prd/PARENT_INSIGHTS.md §1): every 30 s while a kid page is visible, what the kid is
// doing and whether they've been idle. Stores the beat and answers with Kix's next step (a break, a wind-down,
// balance), so the guardian reacts without a second call. Counts only; never touches mastery or rewards.
import { z } from "zod";
import { currentKid, currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { ACTIVITY_KINDS } from "@/lib/guardian/screen-time";
import { loadKidStatus } from "@/lib/guardian/load";

const beatBody = z.strictObject({ kind: z.enum(ACTIVITY_KINDS), idle: z.boolean() });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    const body = await readBody(request, beatBody);
    if (!body) return fail(400, "invalid");
    const now = new Date().toISOString();
    await store.guardian.saveBeat(kid.householdId, kid.id, { at: now, kind: body.kind, idle: body.idle });
    return ok(await loadKidStatus(store, kid.householdId, kid, now));
  });
}

/** The same status without a beat (Home's "Kix suggests" card on load). */
export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    return ok(await loadKidStatus(store, kid.householdId, kid));
  });
}
