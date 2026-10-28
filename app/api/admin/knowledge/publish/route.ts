// Publishes a pack's approved knowledge as its next minor version (SKILL_ENGINE.md §6.4). Kix reads it from the
// next session on (lib/knowledge/knowledge.ts updateNotes). Admins only, behind the parent PIN, audited.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { buildUpdate, nextVersion } from "@/lib/knowledge/knowledge";
import { packsOnDisk } from "@/lib/knowledge/packs";

const publishBody = z.strictObject({ pack: z.string().regex(/^(p[1-6]|s[1-4])-[a-z-]{2,30}$/) });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const body = await readBody(request, publishBody);
    if (!body) return fail(400, "invalid");
    const [uploads, previous] = await Promise.all([store.knowledge.uploads(), store.knowledge.updates(body.pack)]);
    const base = packsOnDisk().find((p) => p.id === body.pack)?.version ?? null;
    const version = nextVersion(base, previous);
    const update = buildUpdate(body.pack, uploads, version, admin.profile.id, new Date().toISOString(), randomUUID());
    if (!update) return fail(409, "nothing-approved");
    await store.knowledge.saveUpdate(update);
    await store.knowledge.markPublished(
      uploads.filter((u) => u.pack === body.pack && u.status === "ready" && !u.publishedIn).map((u) => u.id),
      version,
    );
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "knowledge.publish", target: body.pack, householdId: admin.householdId, detail: { version, archetypes: update.archetypes.length, items: update.items.length } });
    return ok({ update });
  });
}
