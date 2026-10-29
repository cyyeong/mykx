// Server glue for Kix Synapse: the settings with their defaults, and starting a review after the response is sent.
import { after } from "next/server";
import type { AuthStore } from "../auth/store.ts";
import { logRunsFor } from "../runs/log.ts";
import { familyNames } from "./intake.ts";
import { liveDeps, runReview } from "./review.ts";
import { withDefaults } from "./settings.ts";
import type { SynapseSettings } from "./types.ts";

export async function loadSettings(store: AuthStore): Promise<SynapseSettings> {
  return withDefaults(await store.synapse.settings().catch(() => null));
}

/** Reviews a report once the kid already has their answer (Next.js `after`, Vercel's waitUntil). */
export function reviewLater(store: AuthStore, reportId: string, householdId: string): void {
  const job = async () => {
    try {
      logRunsFor("synapse-reviewer", householdId, null); // every call in the review shows in Under the hood
      const settings = await loadSettings(store);
      const names = await familyNames(store, householdId);
      await runReview(reportId, liveDeps(store, settings, [...names.learner, ...names.parent]));
    } catch {
      // The report stays "new"; the nightly sweep and the admin's Retry pick it up.
    }
  };
  try {
    after(job);
  } catch {
    // Outside a request (a script, a test): the nightly sweep or an admin's Retry reviews it.
  }
}
