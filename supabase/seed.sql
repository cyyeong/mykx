-- Demo household (synthetic, labelled in the UI). The parent's user_id is linked to a Supabase
-- Auth user by scripts/link-demo-parent.ts (run it after this seed); until then it is null.
-- Names are invented: never the founder's children.
insert into households (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Demo family');

-- Demo secrets (synthetic, public on purpose): Ari's picture code is idle, cheer, pilot, dreamlight;
-- Zara's password is stars123; Mei's is frogs123. Hashes are scrypt (lib/auth/secrets.ts) and match
-- lib/auth/demo-family.ts.
insert into profiles (id, household_id, role, is_admin, nickname, band, level, pack, interests, voice_enabled, camera_signals, daily_limit_min, synthetic, secret_kind, secret_hash, secret_set_at, secret_event) values
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'parent', true, 'Demo Parent', null, null, null, '{}', false, false, null, true, null, null, null, null),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'child', false, 'Ari', 'junior', 'P3', 'terrarium', '{"Bugs and critters","Jets"}', true, false, 30, true,
    'pictures', 'scrypt$16384$8$1$R56ygih2QnUpKfvx2V-TAQ$PusjO4VBvo99NjoE2q9N0888tPwfuKQWnV8LWXPMe3E', now(), 'set'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'child', false, 'Zara', 'teen', 'P6', 'idol-stage', '{"Music","Dance"}', true, false, 45, true,
    'password', 'scrypt$16384$8$1$FevcUegSzdBYFanzvoOZdw$sSUAUykHk2NcF_lnaMBDW4yjh4k6kkAw5j4X7k5zsVw', now(), 'set'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'child', false, 'Mei', 'teen', 'Sec 2', 'anime-sky', '{"Space","Drawing"}', true, false, 60, true,
    'password', 'scrypt$16384$8$1$pjXXCAkBz0et6aXl41WZOA$kkkXCpP2snjhWs21BhmbdWZ1hzBwhFqasgwGnZVdPOc', now(), 'set');
