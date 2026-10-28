// Records one real outing search (Muse Spark web search, then the Planner) for the synthetic demo household, so the
// "Do something together" page has live-sourced ideas the moment it opens (rule 7: the demo never waits on a search).
// Saved as "cached" (labelled "saved from a search at …"). Costs about $0.20 and takes about a minute.
//   node --env-file=.env.local scripts/guardian/outings-seed.ts
import { DEMO_HOUSEHOLD_ID } from "../../lib/auth/demo-family.ts";
import { getStore } from "../../lib/auth/context.ts";
import { makeOutingRun } from "../../lib/outings/run.ts";

const store = getStore();
if (!store) throw new Error("No store: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (.env.local).");
const profiles = await store.kids(DEMO_HOUSEHOLD_ID);
if (!profiles.length || profiles.some((p) => !p.synthetic)) throw new Error("Refusing: the demo household isn't entirely synthetic.");
const last = await store.outings.latest(DEMO_HOUSEHOLD_ID);
const { run } = await makeOutingRun(store, DEMO_HOUSEHOLD_ID, new Date(), undefined, last, "cached");
console.log(`Saved ${run.ideas.length} sourced ideas for ${run.dates.join(" and ")} (${run.searches} searches).`);
for (const i of run.ideas) console.log(`- ${i.day} ${i.when} [${i.tag}] ${i.title} · ${i.sourceHost}`);
