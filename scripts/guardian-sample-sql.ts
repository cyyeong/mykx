// Prints Jordan's synthetic guardian week (lib/guardian/sample.ts) as SQL for the Supabase SQL editor, dated from
// now, so the parent dashboard shows "this week" in a demo. Replaces earlier sample rows; real rows are untouched.
// Sample data is labelled in the UI (AGENTS.md rule 8). Usage: node scripts/guardian-sample-sql.ts > sample.sql
import { JORDAN_ID, DEMO_HOUSEHOLD_ID } from "../lib/auth/demo-family.ts";
import { sampleGuardianWeek } from "../lib/guardian/sample.ts";

const { beats, messages } = sampleGuardianWeek();
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const out = [
  "-- Jordan's sample guardian week (synthetic). Safe to re-run: it replaces earlier sample rows only.",
  `delete from public.screen_beats where profile_id = ${q(JORDAN_ID)} and synthetic;`,
  `delete from public.kix_messages where profile_id = ${q(JORDAN_ID)} and synthetic;`,
  "insert into public.screen_beats (household_id, profile_id, slot, kind, idle, synthetic) values",
  beats.map((b) => `  (${q(DEMO_HOUSEHOLD_ID)}, ${q(JORDAN_ID)}, ${q(b.at)}, ${q(b.kind)}, ${b.idle}, true)`).join(",\n") + "\non conflict (profile_id, slot) do nothing;",
  "insert into public.kix_messages (household_id, profile_id, at, text, source, distress, self_talk, synthetic) values",
  messages.map((m) => `  (${q(DEMO_HOUSEHOLD_ID)}, ${q(JORDAN_ID)}, ${q(m.at)}, ${q(m.text)}, ${q(m.source)}, false, false, true)`).join(",\n") + ";",
];
console.log(out.join("\n"));
