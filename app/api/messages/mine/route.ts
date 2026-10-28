// Family messages, the kid's side: threads with the household's grown-ups, and replies (quick replies, stickers,
// words, or a hold-to-talk transcript; the audio is never kept). Kix and every language model never read these
// (rule 12). If the words carry distress, the kid still sees the helplines (a fixed card, no model, no flag: the
// grown-up reads the message itself).
import { z } from "zod";
import { currentKid, currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { messageBody } from "@/lib/family/messages";
import { checkWords, HELPLINES } from "@/lib/guardian/words";

const sendBody = z.strictObject({ to: z.string().min(1).max(64), message: messageBody });
const readBodySchema = z.strictObject({ read: z.array(z.string().max(64)).max(60) });

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    const grownUps = await store.family.grownUps(kid.householdId);
    const threads = await Promise.all(grownUps.map((g) => store.family.thread(kid.householdId, g.id, kid.id)));
    return ok({
      me: kid.id,
      grownUps: grownUps.map((g, i) => ({ id: g.id, name: g.nickname || "Grown-up", thread: threads[i], unread: threads[i].filter((m) => m.to === kid.id && !m.readAt).length })),
    });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    const body = await readBody(request, sendBody);
    if (!body) return fail(400, "invalid");
    const grownUps = await store.family.grownUps(kid.householdId);
    if (!grownUps.some((g) => g.id === body.to)) return fail(404, "not-found");
    const sent = await store.family.send(kid.householdId, { from: kid.id, to: body.to, body: body.message.body ?? null, sticker: body.message.sticker ?? null, byVoice: body.message.byVoice ?? false });
    if (!sent) return fail(404, "not-found");
    const distress = body.message.body ? checkWords(body.message.body).distress : false;
    return ok({ message: sent, helplines: distress ? HELPLINES : null });
  });
}

/** Marks the grown-ups' messages as read once the kid has seen them. */
export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    const body = await readBody(request, readBodySchema);
    if (!body) return fail(400, "invalid");
    await store.family.markRead(kid.householdId, kid.id, body.read);
    return ok({});
  });
}
