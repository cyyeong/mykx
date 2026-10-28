// Server only: one outing run, the Scout then the Planner (docs/prd/GUARDIAN.md §2.6). Shared by the route
// (app/api/outings) and by scripts/guardian/outings-seed.ts, which records a real search for the demo family.
import type { AuthStore } from "../auth/store.ts";
import { loadGuardianView } from "../guardian/load.ts";
import { sparkStructured } from "../meta/spark.ts";
import { logRunsFor } from "../runs/log.ts";
import { PLANNER_PROMPT, outingDates, plannerSchema, scoutPrompt, settleIdeas, type OutingRun } from "./outings.ts";
import { sparkSearch } from "./search.ts";
import { weatherLines } from "./weather.ts";

/** An error whose message is safe and useful to show the parent. */
export class OutingError extends Error {}

export async function makeOutingRun(store: AuthStore, householdId: string, now: Date, signal: AbortSignal | undefined, last: OutingRun | null, source: OutingRun["source"] = "live"): Promise<{ run: OutingRun }> {
  const prefs = await store.homeWatch.prefs(householdId);
  const dates = outingDates(now);

  // 1. The Scout: the web, and only the area, radius, interests and dates (never a child's name, age or whereabouts).
  logRunsFor("outing-scout", householdId, null);
  const scout = await sparkSearch(scoutPrompt({ area: prefs.homeArea, radiusKm: prefs.radiusKm, interests: prefs.interests, dates }), { timeoutMs: 120_000, signal });
  if (!scout.citations.length) throw new OutingError("Muse didn’t find sources this time. Try again in a minute.");

  // 2. The Planner: no web. The family's week and the weather, plus the Scout's sourced results.
  logRunsFor("outing-planner", householdId, null);
  const [weather, kids] = await Promise.all([weatherLines(dates), store.kids(householdId)]);
  const week = await Promise.all(
    kids
      .filter((k) => k.role === "child")
      .map(async (k) => {
        const days = (await loadGuardianView(store, householdId, k)).days.filter((d) => d.total > 0);
        const avg = days.length ? Math.round(days.reduce((n, d) => n + d.total, 0) / days.length) : 0;
        return `${k.nickname} (${k.level ?? k.band ?? "child"}): about ${avg} minutes a day on myKx this week.`;
      }),
  );
  const user = [
    `Home area: ${prefs.homeArea}. Within ${prefs.radiusKm} km. The family likes: ${prefs.interests.join(", ")}.`,
    `Dates: ${dates.join(", ")}.`,
    weather.length ? `Weather (NEA):\n${weather.join("\n")}` : "Weather: not available.",
    `The family's week:\n${week.join("\n") || "No details."}`,
    `Search results (with the pages they came from):\n${scout.text}\n\nPages cited:\n${scout.citations.map((c) => `- ${c.url}${c.title ? ` (${c.title})` : ""}`).join("\n")}`,
  ].join("\n\n");
  const { data } = await sparkStructured({ messages: [{ role: "system", content: PLANNER_PROMPT }, { role: "user", content: user }], schema: plannerSchema, schemaName: "outing_plan", reasoningEffort: "low" }, { timeoutMs: 60_000, signal });

  const ideas = settleIdeas(data, scout.citations.map((c) => c.url), dates, prefs.interests);
  if (!ideas.length) throw new OutingError("Muse found places but none it could source. Try again.");
  const run: OutingRun = {
    at: now.toISOString(),
    area: prefs.homeArea,
    radiusKm: prefs.radiusKm,
    interests: prefs.interests,
    dates,
    weather,
    summary: data.summary.trim(),
    ideas,
    searches: scout.searches,
    source,
    planned: (last?.planned ?? []).filter((id) => ideas.some((i) => i.id === id)),
    refreshes: [...(last?.refreshes ?? []).filter((r) => now.getTime() - Date.parse(r) < 2 * 86_400_000), now.toISOString()],
  };
  await store.outings.save(householdId, run);
  return { run };
}
