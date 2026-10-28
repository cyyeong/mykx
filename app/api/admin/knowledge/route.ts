// The knowledge agent's admin routes (SKILL_ENGINE.md §6). Admins only, behind the parent PIN, audited.
//   POST:  one PDF (≤ 4 MB, Vercel's body limit) with its rights; Muse Spark (Standard) reads it into patterns,
//          traps and marking cues (and items, for our own or licensed material), routed to a pack. The browser
//          sends several files one after another. The PDF itself isn't kept (rule 10).
//   GET:   the uploads and each pack's published versions.
//   PATCH: an admin's approve/reject marks for one upload.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { extractionPrompt, extractionSchema, RIGHTS, settle, type KnowledgeUpload } from "@/lib/knowledge/knowledge";
import { packsOnDisk } from "@/lib/knowledge/packs";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";

export const maxDuration = 300;
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const rights = z.enum(RIGHTS).safeParse(form?.get("rights"));
    const source = z.url().max(500).nullable().safeParse((form?.get("sourceUrl") as string | null) || null);
    if (!(file instanceof File) || !rights.success || !source.success) return fail(400, "invalid");
    if (file.size > MAX_BYTES) return fail(413, "too-large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 4)) !== "%PDF") return fail(415, "not-pdf");

    const packs = packsOnDisk();
    const base: KnowledgeUpload = {
      id: randomUUID(),
      uploadedBy: admin.profile.id,
      fileName: file.name.slice(0, 200),
      bytes: file.size,
      rights: rights.data,
      sourceUrl: source.data,
      status: "failed",
      pack: null,
      packIsNew: false,
      extraction: null,
      review: {},
      publishedIn: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    let upload: KnowledgeUpload;
    if (!hasMetaApiKey()) {
      upload = { ...base, error: "The Meta model key isn't set on this server, so the paper couldn't be read." };
    } else {
      try {
        const { data } = await sparkStructured(
          {
            messages: [
              { role: "system", content: extractionPrompt(rights.data, Object.fromEntries(packs.map((p) => [p.id, p.topics]))) },
              {
                role: "user",
                content: [
                  { type: "text", text: `File: ${base.fileName}` },
                  { type: "file", file: { filename: base.fileName, file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}` } },
                ],
              },
            ],
            schema: extractionSchema,
            schemaName: "knowledge_extraction",
            reasoningEffort: "medium",
          },
          { timeoutMs: 240_000, signal: request.signal },
        );
        const settled = settle(data, rights.data, packs.map((p) => p.id));
        upload = { ...base, status: "ready", extraction: settled.extraction, pack: settled.pack, packIsNew: settled.packIsNew };
      } catch (e) {
        upload = { ...base, error: `Muse Spark couldn't read it: ${(e as Error).message.slice(0, 200)}` };
      }
    }
    await store.knowledge.saveUpload(upload);
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "knowledge.upload", target: upload.id, householdId: admin.householdId, detail: { rights: upload.rights, status: upload.status, pack: upload.pack } });
    return ok({ upload });
  });
}

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    if (!(await requireAdmin(store, jar))) return fail(403, "not-allowed");
    const [uploads, updates] = await Promise.all([store.knowledge.uploads(), store.knowledge.updates()]);
    const packs = packsOnDisk().map((p) => ({ id: p.id, title: p.title, version: p.version }));
    return ok({ uploads, updates, packs });
  });
}

const reviewBody = z.strictObject({ id: z.guid(), review: z.record(z.string().regex(/^[atci]:\d{1,2}$/), z.enum(["approved", "rejected"])) });

export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    if (!(await requireAdmin(store, jar))) return fail(403, "not-allowed");
    const body = await readBody(request, reviewBody);
    if (!body) return fail(400, "invalid");
    await store.knowledge.setReview(body.id, body.review);
    return ok({});
  });
}
