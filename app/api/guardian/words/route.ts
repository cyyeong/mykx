// What the kid types or says to Kix (Talk to Kix). The deterministic safety check runs on every message: distress
// or safety words always get Kix's caring reply, the helplines and an urgent flag for the grown-up (AGENTS.md
// rule 12). The words are kept for the grown-up's view and the post-session mood reading; family messages never
// come here. Never touches mastery or rewards.
import { z } from "zod";
import { currentKid, currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { caringReply, checkWords, HELPLINES, kixMoodLine, moodFromWords } from "@/lib/guardian/words";

const wordsBody = z.strictObject({ text: z.string().trim().min(1).max(500) });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    const body = await readBody(request, wordsBody);
    if (!body) return fail(400, "invalid");
    const check = checkWords(body.text);
    await store.guardian.saveMessage(kid.householdId, kid.id, { at: new Date().toISOString(), text: body.text, source: "talk", ...check });
    if (check.distress) return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES }, reply: caringReply(kid.nickname) });
    // A first, low-confidence mood reading from these words alone, so Kix can answer the feeling (never a label).
    const mood = moodFromWords([body.text])?.mood ?? "calm";
    return ok({ care: null, reply: kixMoodLine(mood, body.text) });
  });
}
