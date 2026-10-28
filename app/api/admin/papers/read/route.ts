// "Read it with the knowledge agent" for a scout find the agent may download itself (fetch "auto": the site's
// robots.txt allows it, checked again here). The server fetches the PDF (≤ 20 MB) and Muse Spark (Standard) reads
// it as a school paper: patterns only, never kept or shown to children (rule 10). Admins only, behind the PIN.
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { readPaper } from "@/lib/knowledge/read";
import { fetchPaper } from "@/lib/papers/scan";
import { logRunsFor } from "@/lib/runs/log";

export const maxDuration = 300;
const body = z.strictObject({ id: z.guid() });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const parsed = await readBody(request, body);
    if (!parsed) return fail(400, "invalid");
    const find = await store.papers.find(parsed.id);
    if (!find) return fail(404, "not-found");
    if (find.fetch !== "auto" || !find.fileUrl) return fail(409, "download-by-hand");
    let bytes: Uint8Array;
    try {
      bytes = await fetchPaper(find.fileUrl);
    } catch (e) {
      return fail(502, "download-failed", { note: (e as Error).message.slice(0, 200) });
    }
    logRunsFor("knowledge-agent");
    const fileName = `${[find.level, find.subject, find.year, find.type, find.school].filter(Boolean).join(" ")}.pdf`.slice(0, 200);
    const upload = await readPaper({ bytes, fileName, rights: "school-private", sourceUrl: find.pageUrl.slice(0, 500), uploadedBy: admin.profile.id, signal: request.signal });
    await store.knowledge.saveUpload(upload);
    const updated = upload.status === "ready" ? await store.papers.setFind(find.id, { status: "read", uploadId: upload.id }) : find;
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "knowledge.upload", target: upload.id, householdId: admin.householdId, detail: { rights: upload.rights, status: upload.status, pack: upload.pack, from: "scout" } });
    return ok({ upload, find: updated });
  });
}
