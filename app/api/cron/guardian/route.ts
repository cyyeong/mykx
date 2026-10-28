// Daily Guardian clean-up (vercel.json, 03:00 SGT): deletes flagged frames past their 24 h (rule 15). Room statuses
// (14 days) and points (30 days) are trimmed as they're written. Vercel's scheduler calls it with CRON_SECRET.
import { timingSafeEqual } from "node:crypto";
import { getStore } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const have = Buffer.from(request.headers.get("authorization") ?? "");
  return have.length === want.length && timingSafeEqual(have, want);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return fail(503, "not-configured");
  if (!authorised(request)) return fail(401, "not-allowed");
  const store = getStore();
  if (!store) return fail(503, "not-configured");
  return ok({ purged: await store.homeWatch.purgeAlertFrames(new Date().toISOString()) });
}
