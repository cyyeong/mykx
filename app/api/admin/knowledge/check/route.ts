// Cross-check again (founder, 29 Oct): after the admin edits a key or pairs a paper by hand, Muse Spark (Standard)
// works the answers out again (lib/knowledge/review.ts). Admins only, behind the parent PIN.
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { papersToCheck, recheck } from "@/lib/knowledge/review";
import { logRunsFor } from "@/lib/runs/log";

export const maxDuration = 300;
const body = z.strictObject({ id: z.guid() });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    if (!(await requireAdmin(store, jar))) return fail(403, "not-allowed");
    const b = await readBody(request, body);
    if (!b) return fail(400, "invalid");
    const u = await store.knowledge.upload(b.id);
    if (!u || u.publishedIn) return fail(404, "not-found");
    const session = (await store.knowledge.uploads()).filter((x) => (u.sessionId ? x.sessionId === u.sessionId : x.id === u.id));
    logRunsFor("knowledge-agent");
    const done = await recheck(store, papersToCheck(u, session), request.signal);
    return ok({ uploads: done });
  });
}
