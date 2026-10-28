// The paper scout's finds for Admin → Add knowledge. Admins only, behind the parent PIN, audited.
//   GET:   the finds and the last runs.
//   POST:  run the scout now (about a minute: robots.txt first, a pause between requests; nothing downloaded).
//   PATCH: mark finds seen, dismissed or new again.
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { runScout } from "@/lib/papers/run";

export const maxDuration = 300;

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    if (!(await requireAdmin(store, jar))) return fail(403, "not-allowed");
    const [finds, runs] = await Promise.all([store.papers.finds(), store.papers.runs(5)]);
    return ok({ finds, runs, weekly: Boolean(process.env.CRON_SECRET) });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const run = await runScout(store, "admin");
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "scout.run", target: run.id, householdId: admin.householdId, detail: { found: run.found, fresh: run.fresh, problems: run.problems.length } });
    return ok({ run });
  });
}

const patchBody = z.strictObject({ ids: z.array(z.guid()).min(1).max(1000), status: z.enum(["new", "seen", "dismissed"]) });

export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const body = await readBody(request, patchBody);
    if (!body) return fail(400, "invalid");
    return ok({ changed: await store.papers.setStatus(body.ids, body.status) });
  });
}
