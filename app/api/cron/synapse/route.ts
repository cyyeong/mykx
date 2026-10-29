// Kix Synapse's daily run (vercel.json, 03:30 SGT): reviews any report still waiting to start (a review that died with
// its function), retires expired cautions, runs every eval case, and drops the words of reports older than 90 days
// (the numbers stay). Vercel's scheduler calls it with CRON_SECRET.
import { timingSafeEqual } from "node:crypto";
import { getStore } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { forgetCautions, isLive } from "@/lib/synapse/cautions";
import { runEvals } from "@/lib/synapse/evals";
import { logRunsFor } from "@/lib/runs/log";
import { familyNames } from "@/lib/synapse/intake";
import { liveDeps, runReview } from "@/lib/synapse/review";
import { loadSettings } from "@/lib/synapse/server";

export const maxDuration = 300;

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
  const now = Date.now();
  const settings = await loadSettings(store);

  logRunsFor("synapse-reviewer", null, null);
  const stuck = (await store.synapse.reports({ limit: 200 })).filter((r) => r.status === "new" && now - Date.parse(r.createdAt) > 5 * 60_000).slice(0, 5);
  for (const r of stuck) {
    const names = await familyNames(store, r.householdId);
    await runReview(r.id, liveDeps(store, settings, [...names.learner, ...names.parent])).catch(() => null);
  }

  let retired = 0;
  for (const c of await store.synapse.cautions()) {
    if (c.status === "active" && !isLive(c, now)) {
      await store.synapse.saveCaution({ ...c, status: "retired" });
      retired += 1;
    }
  }
  if (retired) forgetCautions();

  logRunsFor("synapse-judge", null, null);
  const run = await runEvals(store, liveDeps(store, settings, []), "nightly", { limit: 40 });

  let trimmed = 0;
  for (const r of await store.synapse.reports({ limit: 1000 })) {
    if (now - Date.parse(r.createdAt) > 90 * 86_400_000 && (r.case.shown || r.case.note || r.case.ask)) {
      await store.synapse.saveReport({ ...r, case: { ...r.case, shown: null, ask: null, note: null, answer: null }, retest: r.retest ? { ...r.retest, good: null } : null });
      trimmed += 1;
    }
  }
  return ok({ reviewed: stuck.length, retired, evals: { passed: run.passed, total: run.total }, trimmed });
}
