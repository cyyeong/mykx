-- Demo household (synthetic, labelled in the UI). The parent's user_id is linked to a Supabase
-- Auth user by scripts/link-demo-parent.ts (run it after this seed); until then it is null.
-- The nicknames are the founder's stand-ins (AGENTS.md rule 10), never real names; all their data is made up.
insert into households (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Demo family');

-- Demo secrets (synthetic, public on purpose): Jordan's picture code is idle, cheer, pilot, dreamlight;
-- Abby's and Leonard's password is hackmuse (published for judges, founder 28 Oct). Hashes are scrypt (lib/auth/secrets.ts) and match
-- lib/auth/demo-family.ts.
insert into profiles (id, household_id, role, is_admin, nickname, band, level, pack, interests, voice_enabled, camera_enabled, daily_limit_min, synthetic, secret_kind, secret_hash, secret_set_at, secret_event) values
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'parent', true, 'Demo Parent', null, null, null, '{}', false, false, null, true, null, null, null, null),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'child', false, 'Jordan', 'junior', 'P3', 'terrarium', '{"Bugs and critters","Jets"}', true, false, 30, true,
    'pictures', 'scrypt$16384$8$1$R56ygih2QnUpKfvx2V-TAQ$PusjO4VBvo99NjoE2q9N0888tPwfuKQWnV8LWXPMe3E', now(), 'set'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'child', false, 'Abby', 'teen', 'P6', 'anime-sky', '{"Anime"}', true, false, 45, true,
    'password', 'scrypt$16384$8$1$PK5y3oBbecbqlyuJ2OeIrA$L2jsBBXoaBmmnRibFYBdL7Qut9EEpUrgaqSnExY7RdA', now(), 'set'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'child', false, 'Leonard', 'teen', 'Sec 2', 'idol-stage', '{"K-pop","Dance","Anime"}', true, false, 60, true,
    'password', 'scrypt$16384$8$1$ad2uDKiCeE4ILgvIFn5hfg$mkI3K-AHDmgmu8RUxnCbPjzkpdUU1zoxvGAf38QOLDE', now(), 'set');

-- Magic names for the sign-in page (founder, 29 Oct).
update profiles set username = lower(nickname) where household_id = '00000000-0000-4000-8000-000000000001' and role = 'child';

-- A sample "possibly losing focus" note for Jordan (synthetic; Your family labels it "Sample"), dated yesterday at
-- 4:12 pm Singapore time, so the grown-up's Focus card has something to show. Same id and words as
-- ARI_SAMPLE_FOCUS_NOTE in lib/auth/demo-family.ts. Jordan's camera stays off, as for every kid.
insert into signals (id, household_id, profile_id, kind, minute, until, evidence, confidence, synthetic)
select '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'focus-watch',
  t, t + interval '3 minutes',
  'In 3 minutes: looked away 1 min 50 s (usually about 15 s), eyes closed 3 times (usually none), 2 yawns (usually none). Focus about 55, against a usual 86.',
  'medium', true
from (select (date_trunc('day', (now() + interval '8 hours') at time zone 'UTC') - interval '1 day' + interval '8 hours 12 minutes') at time zone 'UTC' as t) yesterday;

-- Jordan's synthetic earlier history (frog quest): two answered stops, so Treasure opens earned, not empty.
-- Same rows as seedDemoHistory in lib/auth/store-demo.ts. Answer envelopes hold the raw response plus the
-- child's explanation; ledger keys are namespaced per kid because idempotency_key is unique table-wide.
-- Dated yesterday afternoon Singapore time, like the focus note above.
with yesterday as (select ((date_trunc('day', (now() + interval '8 hours') at time zone 'UTC') - interval '1 day' + interval '8 hours 4 minutes') at time zone 'UTC') as t)
insert into attempts (id, household_id, profile_id, skill_id, skill_version, item_id, topic, subskill, answer, marks, max_marks, correct, first_try, hints_used, revealed, idempotency_key, created_at)
select '00000000-0000-4000-8000-00000000a101'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, 'p3-science', '1.0.0', 'p3sci-demo-01', 'cycles.animal', 'three_stage', '{"response": 2, "explanation": "The egg comes first, then the tadpole.", "revised": false}'::jsonb, 2, 2, true, true, 0, false, 'seed:ari:p3sci-demo-01', t from yesterday
union all
select '00000000-0000-4000-8000-00000000a102'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, 'p3-science', '1.0.0', 'p3sci-demo-02', 'cycles.animal', 'stage_features', '{"response": 1, "explanation": null, "revised": false}'::jsonb, 0, 2, false, true, 0, false, 'seed:ari:p3sci-demo-02-try1', t + interval '2 minutes' from yesterday
union all
select '00000000-0000-4000-8000-00000000a103'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, 'p3-science', '1.0.0', 'p3sci-demo-02', 'cycles.animal', 'stage_features', '{"response": 2, "explanation": "Tadpoles swim with their tails; legs come later.", "revised": true}'::jsonb, 2, 2, true, false, 0, false, 'seed:ari:p3sci-demo-02-try2', t + interval '4 minutes' from yesterday
on conflict do nothing;

with yesterday as (select ((date_trunc('day', (now() + interval '8 hours') at time zone 'UTC') - interval '1 day' + interval '8 hours 4 minutes') at time zone 'UTC') as t)
insert into ledger (household_id, profile_id, kind, ref, amount, rule, idempotency_key, created_at)
select '00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, 'stars', 'p3sci-demo-01', 2, 'first_attempt', '00000000-0000-4000-8000-000000000011:first_attempt:p3sci-demo-01', t from yesterday
union all
select '00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000011'::uuid, 'stars', 'p3sci-demo-02', 3, 'retry_revised', '00000000-0000-4000-8000-000000000011:retry_revised:p3sci-demo-02', t + interval '4 minutes' from yesterday
on conflict do nothing;

-- Guardian (docs/prd/GUARDIAN.md): the demo family's synthetic Home and School pins in Sengkang and who shares
-- location (lib/auth/store-demo.ts DEMO_PLACES). No points: the Home simulator sends those.
insert into places (id, household_id, name, kind, lat, lng, radius_m) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'Home', 'home', 1.3895, 103.9003, 150),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'School', 'school', 1.3966, 103.8865, 200)
on conflict (id) do nothing;
insert into kid_location (profile_id, household_id, enabled, mode) values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', true, 'balanced'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', true, 'school'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', true, 'balanced')
on conflict (profile_id) do nothing;
insert into guardian_prefs (household_id, descriptions) values
  ('00000000-0000-4000-8000-000000000001', '{"00000000-0000-4000-8000-000000000011": "Youngest, about 9, short straight black hair, often a light blue T-shirt", "00000000-0000-4000-8000-000000000012": "About 12, curly chin-length hair, often a mustard-yellow T-shirt", "00000000-0000-4000-8000-000000000013": "About 14, long black ponytail and round glasses, often a grey hoodie"}')
on conflict (household_id) do nothing;
