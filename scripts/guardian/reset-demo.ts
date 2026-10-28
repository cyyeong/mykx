// Clears Guardian's data for the synthetic demo household between video takes: today's points and arrivals, room
// readings, alerts and their private frames, any teen pause, and the camera "last seen" times. Pins, sharing settings,
// descriptions, the simulator device and the saved outing ideas stay. Refuses unless every profile is synthetic.
//   node --env-file=.env.local scripts/guardian/reset-demo.ts
import { createClient } from "@supabase/supabase-js";
import { DEMO_HOUSEHOLD_ID } from "../../lib/auth/demo-family.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed (.env.local).");
const db = createClient(url, key, { auth: { persistSession: false } });
const ok = (r: { error: { message: string } | null }, what: string) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
};

const profiles = await db.from("profiles").select("id, synthetic").eq("household_id", DEMO_HOUSEHOLD_ID);
ok(profiles, "profiles");
if (!profiles.data?.length || profiles.data.some((p) => !p.synthetic)) throw new Error("Refusing: the demo household isn't entirely synthetic.");

const alerts = await db.from("home_alerts").select("frame_paths").eq("household_id", DEMO_HOUSEHOLD_ID);
ok(alerts, "alerts");
const paths = (alerts.data ?? []).flatMap((a) => (a.frame_paths as string[]) ?? []);
if (paths.length) ok(await db.storage.from("home-alerts").remove(paths), "frames");
for (const [table, col] of [["home_alerts", "household_id"], ["home_status", "household_id"], ["place_events", "household_id"], ["locations", "household_id"]] as const) ok(await db.from(table).delete().eq(col, DEMO_HOUSEHOLD_ID), table);
ok(await db.from("kid_location").update({ paused_until: null }).eq("household_id", DEMO_HOUSEHOLD_ID), "pauses");
ok(await db.from("home_cameras").update({ last_frame_at: null, last_status_at: null }).eq("household_id", DEMO_HOUSEHOLD_ID), "cameras");
ok(await db.from("home_devices").update({ frames_day: null, frames_count: 0 }).eq("household_id", DEMO_HOUSEHOLD_ID), "budgets");
console.log(`Reset: removed ${paths.length} stored frames and today's points, arrivals, readings and alerts.`);
