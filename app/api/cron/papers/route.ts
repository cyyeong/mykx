// The weekly past-paper scout (vercel.json: Mondays 06:00 SGT). Vercel's scheduler calls it with
// `Authorization: Bearer $CRON_SECRET`; anything else is refused. It reads the approved sites' listing pages
// (robots.txt first, a pause between requests), saves each latest paper's link and download decision for
// Admin → Add knowledge, and downloads nothing: an admin decides what the knowledge agent reads.
import { timingSafeEqual } from "node:crypto";
import { getStore } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { runScout } from "@/lib/papers/run";

export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const got = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const have = Buffer.from(got);
  return have.length === want.length && timingSafeEqual(have, want);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return fail(503, "not-configured");
  if (!authorised(request)) return fail(401, "not-allowed");
  const store = getStore();
  if (!store) return fail(503, "not-configured");
  const run = await runScout(store, "weekly");
  await store.audit({ actor: null, actorRole: "system", action: "scout.run", target: run.id, householdId: null, detail: { found: run.found, fresh: run.fresh, problems: run.problems.length } });
  return ok({ run: { at: run.at, found: run.found, fresh: run.fresh, auto: run.auto, manual: run.manual, skip: run.skip } });
}
