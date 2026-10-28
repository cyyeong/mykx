-- The guardian (28 Oct 2026): screen time heartbeats, the kid's own words to Kix, the parent's limits and seen
-- flags, with row-level security. For a database that already ran schema.sql, rls.sql and seed.sql; paste it into
-- the Supabase SQL editor. Safe to run more than once. Fresh installs get the same from schema.sql and rls.sql.
-- Privacy (AGENTS.md rule 12): only counts and the kid's own words to Kix; never family messages, images or audio.

-- The guardian (docs/prd/PARENT_INSIGHTS.md §1-2, AGENTS.md rule 12): screen time, the kid's own words to Kix,
-- the parent's limits, and which flags a grown-up has seen. Written by the server after validation only; never
-- read by a model except the kid's own words, through Standard models. Nothing here touches mastery or rewards.
-- One heartbeat per 30 s while a kid page is visible: what the kid is doing, and whether they've been idle.
create table if not exists public.screen_beats (
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade, -- the kid
  slot timestamptz not null, -- the start of the 30 s slot; a second tab in the same slot changes nothing
  kind text not null check (kind in ('learn', 'play', 'create', 'other')),
  idle boolean not null default false, -- no tap or key for a minute or more
  synthetic boolean not null default false, -- sample data, labelled in the UI (hard rule 8)
  primary key (profile_id, slot)
);
create index if not exists screen_beats_household_time on public.screen_beats (household_id, slot desc);

-- What the kid typed or said to Kix (Talk to Kix, and the "Because…" reasons). Never family messages.
create table if not exists public.kix_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null,
  text text not null check (char_length(text) between 1 and 500),
  source text not null check (source in ('talk', 'reason')),
  distress boolean not null default false, -- safety words: Kix's caring reply, helplines and an urgent flag
  self_talk boolean not null default false, -- "I'm stupid": a watch sign
  synthetic boolean not null default false
);
create index if not exists kix_messages_profile_time on public.kix_messages (profile_id, at desc);

-- The parent's guardian settings for one kid (Your family → Controls); the daily limit stays on profiles.
-- No row: the band's defaults.
create table if not exists public.guardian_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  quiet_from_hour integer not null check (quiet_from_hour between 0 and 23),
  quiet_to_hour integer not null check (quiet_to_hour between 0 and 23),
  break_every_min integer not null check (break_every_min between 10 and 60),
  learn_min_min integer not null check (learn_min_min between 0 and 240),
  play_max_min integer not null check (play_max_min between 0 and 240),
  updated_at timestamptz not null default now()
);

-- Flags a grown-up marked as seen (flags themselves are computed from the rows above, never stored).
create table if not exists public.flags_seen (
  household_id uuid not null references public.households (id) on delete cascade,
  flag_id text not null check (char_length(flag_id) <= 200),
  seen_at timestamptz not null default now(),
  primary key (household_id, flag_id)
);

alter table public.screen_beats enable row level security;
alter table public.kix_messages enable row level security;
alter table public.guardian_settings enable row level security;
alter table public.flags_seen enable row level security;
drop policy if exists screen_beats_read on public.screen_beats;
drop policy if exists screen_beats_delete on public.screen_beats;
drop policy if exists kix_messages_read on public.kix_messages;
drop policy if exists kix_messages_delete on public.kix_messages;
drop policy if exists guardian_settings_read on public.guardian_settings;
drop policy if exists flags_seen_read on public.flags_seen;

-- The guardian: grown-ups read their household's screen time, their kids' words to Kix, limits and seen flags,
-- and may delete a beat or a message (PARENT_INSIGHTS §4.5). Only the server writes them.
create policy screen_beats_read on public.screen_beats for select to authenticated using (household_id = my_household());
create policy screen_beats_delete on public.screen_beats for delete to authenticated using (household_id = my_household());
create policy kix_messages_read on public.kix_messages for select to authenticated using (household_id = my_household());
create policy kix_messages_delete on public.kix_messages for delete to authenticated using (household_id = my_household());
create policy guardian_settings_read on public.guardian_settings for select to authenticated using (household_id = my_household());
create policy flags_seen_read on public.flags_seen for select to authenticated using (household_id = my_household());

revoke all on public.screen_beats, public.kix_messages, public.guardian_settings, public.flags_seen from anon, authenticated;
grant select, delete on public.screen_beats, public.kix_messages to authenticated;
grant select on public.guardian_settings, public.flags_seen to authenticated;
