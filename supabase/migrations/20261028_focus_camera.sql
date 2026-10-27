-- Focus camera (28 Oct 2026): the grown-up's per-kid switch, the household-scoped `signals` table with its
-- row-level security, and one sample note for the demo learner Ari. For a database that already ran schema.sql,
-- rls.sql and seed.sql; paste it into the Supabase SQL editor. Safe to run more than once. Fresh installs get the
-- same from schema.sql, rls.sql and seed.sql (supabase/schema.test.ts checks both paths agree).
-- Privacy (AGENTS.md rule 12): faces are read in the browser only. This table holds per-minute counts and
-- "possibly losing focus" notes; no column can hold an image, a video frame or a landmark.

-- 1. The switch, off by default. The first schema.sql called it camera_signals: rename it if so (its column
--    grants follow the rename), otherwise add it.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'camera_signals')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'camera_enabled') then
    alter table public.profiles rename column camera_signals to camera_enabled;
  end if;
end $$;
alter table public.profiles add column if not exists camera_enabled boolean not null default false;
grant select (camera_enabled), update (camera_enabled) on public.profiles to authenticated;

-- 2. Wellbeing signals (same definition as schema.sql).
create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade, -- the kid
  kind text not null check (kind in ('camera-minute', 'focus-watch')),
  minute timestamptz not null, -- start of the minute; for a note, the start of its first minute
  until timestamptz, -- a note's end
  counts jsonb not null default '{}'::jsonb check (
    jsonb_typeof(counts) = 'object'
    and counts - array['awaySeconds', 'eyesClosedEvents', 'yawns', 'facePresentRatio'] = '{}'::jsonb
  ),
  evidence text check (char_length(evidence) <= 400),
  confidence text check (confidence in ('low', 'medium', 'high')),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, kind, minute),
  check (kind <> 'camera-minute' or (until is null and evidence is null and confidence is null)),
  check (kind <> 'focus-watch' or (until > minute and evidence is not null and confidence is not null))
);
create index if not exists signals_household_kind_time on public.signals (household_id, kind, minute desc);

-- 3. Row-level security (same as rls.sql): grown-ups read and delete their household's signals; only the
--    server (service role) writes them.
alter table public.signals enable row level security;
drop policy if exists signals_read on public.signals;
create policy signals_read on public.signals for select to authenticated using (household_id = public.my_household());
drop policy if exists signals_delete on public.signals;
create policy signals_delete on public.signals for delete to authenticated using (household_id = public.my_household());
revoke all on public.signals from anon, authenticated;
grant select, delete on public.signals to authenticated;

-- 4. Ari's sample note (synthetic, labelled "Sample"; same as seed.sql), only where the demo family exists.
insert into public.signals (id, household_id, profile_id, kind, minute, until, evidence, confidence, synthetic)
select '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'focus-watch',
  t, t + interval '3 minutes',
  'In 3 minutes: looked away 1 min 50 s (usually about 15 s), eyes closed 3 times (usually none), 2 yawns (usually none). Focus about 55, against a usual 86.',
  'medium', true
from (select (date_trunc('day', (now() + interval '8 hours') at time zone 'UTC') - interval '1 day' + interval '8 hours 12 minutes') at time zone 'UTC' as t) yesterday
where exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000011' and household_id = '00000000-0000-4000-8000-000000000001')
on conflict do nothing;
