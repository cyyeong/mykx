// Sets up the Home simulator against the production demo family (docs/prd/GUARDIAN.md §2.3). Re-runnable.
//   node --env-file=.env.local scripts/guardian/setup-sim.ts [--rotate] | npx vercel@65.1.0 env add SIM_HOME_LINK_TOKEN production --sensitive
// It works only on the synthetic demo household (it refuses if any profile in it isn't synthetic) and:
//   1. adds the demo family's Home and School pins, each kid's sharing setting and the parent's descriptions;
//   2. sets the camera hours to all day, every day, so the simulator works at any hour of the demo;
//   3. makes a simulator device and prints its token on stdout, and only that. Everything else goes to stderr.
// Only a SHA-256 of the token is stored, so a lost token can't be shown again: run with --rotate to make a new one.
import { createClient } from "@supabase/supabase-js";
import { ARI_ID, DEMO_HOUSEHOLD_ID, MEI_ID, ZARA_ID } from "../../lib/auth/demo-family.ts";
import { DEMO_DESCRIPTIONS, DEMO_PLACES } from "../../lib/auth/store-demo.ts";
import { DEFAULT_PREFS, newDeviceToken, sha256Hex } from "../../lib/home-watch/home-watch.ts";

const say = (m: string) => process.stderr.write(`${m}\n`);
const rotate = process.argv.includes("--rotate");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (.env.local).");
const db = createClient(url, key, { auth: { persistSession: false } });
const must = <T>(r: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? []) as NonNullable<T>;
};

const profiles = must(await db.from("profiles").select("id, synthetic").eq("household_id", DEMO_HOUSEHOLD_ID), "profiles");
if (!profiles.length || profiles.some((p) => !p.synthetic)) throw new Error("Refusing: the demo household isn't entirely synthetic.");

must(await db.from("places").upsert(DEMO_PLACES.map((p) => ({ id: p.id, household_id: DEMO_HOUSEHOLD_ID, name: p.name, kind: p.kind, lat: p.lat, lng: p.lng, radius_m: p.radiusM })), { onConflict: "id" }), "places");
must(await db.from("kid_location").upsert([[ARI_ID, "balanced"], [ZARA_ID, "school"], [MEI_ID, "balanced"]].map(([id, mode]) => ({ profile_id: id, household_id: DEMO_HOUSEHOLD_ID, enabled: true, mode })), { onConflict: "profile_id" }), "kid_location");
must(await db.from("guardian_prefs").upsert({ household_id: DEMO_HOUSEHOLD_ID, home_area: DEFAULT_PREFS.homeArea, radius_km: DEFAULT_PREFS.radiusKm, interests: DEFAULT_PREFS.interests, cam_days: [1, 2, 3, 4, 5, 6, 7], cam_from: "00:00", cam_to: "23:59", descriptions: DEMO_DESCRIPTIONS }, { onConflict: "household_id" }), "guardian_prefs");
say("Demo family: pins, sharing settings, descriptions and all-day camera hours are in place.");

const live = must(await db.from("home_devices").select("id").eq("household_id", DEMO_HOUSEHOLD_ID).eq("kind", "simulator").is("revoked_at", null), "devices");
if (live.length && !rotate) {
  say(`A simulator device already exists (${live.length}). Its token can't be shown again; run with --rotate to make a new one.`);
  process.exit(2);
}
if (live.length) must(await db.from("home_devices").update({ revoked_at: new Date().toISOString(), token_hash: null }).in("id", live.map((d) => d.id)), "revoke");
const token = newDeviceToken();
must(await db.from("home_devices").insert({ household_id: DEMO_HOUSEHOLD_ID, name: "Home simulator", kind: "simulator", token_hash: sha256Hex(token) }), "device");
say(live.length ? "Made a new simulator device and revoked the old one." : "Made the simulator device.");
process.stdout.write(token);
