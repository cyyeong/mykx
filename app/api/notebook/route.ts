// Kix's Notebook, the grown-up's side (rule 11): read the pages and their history, edit a page, or wipe it all.
// Grown-up edits follow the same rule as the Memory Keeper: no labels or diagnoses, because Kix reads these pages.
// Behind the parent PIN while a kid uses the device.
import { z } from "zod";
import { currentParent, withAuth, type Parent, type RouteCtx } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { MAX_PAGE, PAGE_TITLE, PAGES, refused } from "@/lib/notebook/notebook";

const editBody = z.strictObject({ kidId: z.string().min(1).max(64), page: z.enum(PAGES), body: z.string().max(MAX_PAGE) });
const wipeBody = z.strictObject({ kidId: z.string().min(1).max(64) });

async function grownUp({ store, jar }: RouteCtx): Promise<{ parent: Parent; error: null } | { parent: null; error: Response }> {
  const parent = await currentParent(store, jar);
  if (!parent) return { parent: null, error: fail(401, "no-parent") };
  const locked = await pinLockedResponse(store, jar);
  if (locked) return { parent: null, error: locked };
  return { parent, error: null };
}

export async function GET(request: Request) {
  return withAuth(request, async (ctx) => {
    const { store } = ctx;
    const g = await grownUp(ctx);
    if (!g.parent) return g.error;
    const kids = await store.kids(g.parent.householdId);
    const want = new URL(request.url).searchParams.get("kid");
    const kid = kids.find((k) => k.id === want) ?? kids[0] ?? null;
    if (!kid) return ok({ kids: [], kid: null, pages: [], revisions: [], reads: [] });
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const [pages, revisions, reads] = await Promise.all([
      store.notebook.pages(g.parent.householdId, kid.id),
      store.notebook.revisions(g.parent.householdId, kid.id, 20),
      store.notebook.reads(g.parent.householdId, kid.id, since),
    ]);
    return ok({
      kids: kids.map((k) => ({ id: k.id, nickname: k.nickname })),
      kid: { id: kid.id, nickname: kid.nickname },
      pages: PAGES.map((slug) => ({ slug, title: PAGE_TITLE[slug], body: pages.find((p) => p.slug === slug)?.body ?? "", updatedAt: pages.find((p) => p.slug === slug)?.updatedAt ?? null })),
      revisions,
      reads: reads.reverse(),
    });
  });
}

export async function PATCH(request: Request) {
  return withAuth(request, async (ctx) => {
    const { store } = ctx;
    const g = await grownUp(ctx);
    if (!g.parent) return g.error;
    const body = await readBody(request, editBody);
    if (!body) return fail(400, "invalid");
    if (body.body.split("\n").some((l) => refused(l))) return fail(400, "label");
    if (!(await store.kid(g.parent.householdId, body.kidId))) return fail(404, "not-found");
    await store.notebook.write(g.parent.householdId, body.kidId, body.page, body.body.trim(), "grown-up", "Edited by a grown-up");
    return ok({});
  });
}

export async function DELETE(request: Request) {
  return withAuth(request, async (ctx) => {
    const { store } = ctx;
    const g = await grownUp(ctx);
    if (!g.parent) return g.error;
    const body = await readBody(request, wipeBody);
    if (!body) return fail(400, "invalid");
    if (!(await store.kid(g.parent.householdId, body.kidId))) return fail(404, "not-found");
    await store.notebook.wipe(g.parent.householdId, body.kidId);
    return ok({});
  });
}
