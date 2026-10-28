// Family messages, the grown-up's side (PARENT_INSIGHTS §3): the thread with one kid, and sending words or a Kix
// sticker. Behind the parent PIN while a kid uses the device. Kix and every language model never read these
// (rule 12), so nothing here calls a model.
import { z } from "zod";
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { messageBody } from "@/lib/family/messages";

const sendBody = z.strictObject({ kidId: z.string().min(1).max(64), message: messageBody });

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const kids = await store.kids(parent.householdId);
    const want = new URL(request.url).searchParams.get("kid");
    const kid = kids.find((k) => k.id === want) ?? kids[0] ?? null;
    if (!kid) return ok({ kids: [], kid: null, thread: [], unread: {} });
    const [thread, unread] = await Promise.all([store.family.thread(parent.householdId, parent.profile.id, kid.id), store.family.unread(parent.householdId, parent.profile.id)]);
    const fresh = thread.filter((m) => m.to === parent.profile.id && !m.readAt).map((m) => m.id);
    if (fresh.length) await store.family.markRead(parent.householdId, parent.profile.id, fresh);
    const perKid: Record<string, number> = {};
    for (const m of unread) if (m.from !== kid.id) perKid[m.from] = (perKid[m.from] ?? 0) + 1;
    return ok({
      me: parent.profile.id,
      kids: kids.map((k) => ({ id: k.id, nickname: k.nickname })),
      kid: { id: kid.id, nickname: kid.nickname },
      thread,
      unread: perKid,
    });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, sendBody);
    if (!body) return fail(400, "invalid");
    const kid = await store.kid(parent.householdId, body.kidId);
    if (!kid) return fail(404, "not-found");
    const sent = await store.family.send(parent.householdId, { from: parent.profile.id, to: kid.id, body: body.message.body ?? null, sticker: body.message.sticker ?? null, byVoice: false });
    if (!sent) return fail(404, "not-found");
    return ok({ message: sent });
  });
}
