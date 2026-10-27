// Submitting an answer: deterministic marking, mastery and the reward ledger,
// stored in Supabase (or the demo store in dev). Needs the kid session on
// this device; open items are refused here (a parent or admin confirms their
// rubric before mastery may move).
import { z } from "zod";
import { currentKid, currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { KID_COOKIE } from "@/lib/auth/kid-session";
import { submitAttempt } from "@/lib/learn/submit";

const attemptBody = z.object({
  itemId: z.string().min(1).max(100),
  response: z.union([z.number().int(), z.string().max(500), z.null()]),
  explanation: z.string().max(500).nullable().optional(),
  hintsUsed: z.number().int().min(0).max(10).default(0),
  revealed: z.boolean().default(false),
  /** Client-generated per submission; a resend lands once (J17). */
  key: z.string().uuid(),
});

export async function POST(request: Request) {
  return withAuth(request, async (ctx) => {
    const parent = await currentParent(ctx.store, ctx.jar);
    const kid = await currentKid(ctx.store, ctx.jar, parent);
    if (!kid) {
      if (ctx.jar.get(KID_COOKIE)) ctx.jar.delete(KID_COOKIE);
      return fail(401, "no-kid");
    }
    const body = await readBody(request, attemptBody);
    if (!body) return fail(400, "invalid");
    try {
      const result = await submitAttempt(ctx.store, kid.householdId, kid.id, {
        itemId: body.itemId,
        response: body.response,
        explanation: body.explanation ?? null,
        hintsUsed: body.hintsUsed,
        revealed: body.revealed,
        key: body.key,
      });
      return ok(result);
    } catch (err) {
      if ((err as Error).message === "unknown-item") return fail(404, "not-found");
      if ((err as Error).message === "needs-review") return fail(400, "not-allowed");
      throw err;
    }
  });
}
