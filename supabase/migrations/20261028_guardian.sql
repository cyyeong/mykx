-- Guardian (docs/prd/GUARDIAN.md, 28 Oct 2026): where the kids are, Home watch and the family's preferences, with
-- row-level security by household. Locations kept 30 days, room statuses 14 days, flagged frames 24 h (rule 15).
-- Frames themselves never go in a table. For a database that already ran the earlier migrations; paste into the
-- Supabase SQL editor. Safe to run more than once.

-- The family's Guardian preferences: outing ideas (home area, radius, interests), camera hours and pause, and the
-- parent's own short description of each kid for the Home Reader ("likely Ari"; no face templates).
create table if not exists public.guardian_prefs (
  household_id uuid primary key references public.households (id) on delete cascade,
  home_area text not null default 'Sengkang' check (char_length(home_area) between 2 and 60),
  radius_km smallint not null default 3 check (radius_km in (1, 3, 5)),
  interests text[] not null default '{badminton,swimming,cycling,eating out}' check (cardinality(interests) <= 12),
  cam_days smallint[] not null default '{1,2,3,4,5}' check (cardinality(cam_days) <= 7),
  cam_from text not null default '14:00' check (cam_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  cam_to text not null default '19:00' check (cam_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  cams_paused_until timestamptz,
  descriptions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Each kid's location sharing, set by the parent; a teen may pause for 30 minutes.
create table if not exists public.kid_location (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  enabled boolean not null default false,
  mode text not null default 'balanced' check (mode in ('live', 'balanced', 'saver', 'school')),
  paused_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.locations (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real not null check (accuracy_m between 0 and 5000),
  speed real check (speed between 0 and 80),
  heading real check (heading between 0 and 360),
  motion text not null check (motion in ('still', 'walking', 'running', 'cycling', 'vehicle', 'playing', 'unknown')),
  source text not null check (source in ('web', 'android', 'sim')),
  battery smallint check (battery between 0 and 100),
  unique (profile_id, at)
);
create index if not exists locations_kid_at on public.locations (profile_id, at desc);

-- The parent's own pins, so no map service sees where a kid is.
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('home', 'school', 'other')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m smallint not null check (radius_m between 50 and 300),
  created_at timestamptz not null default now()
);

create table if not exists public.place_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  place_name text not null check (char_length(place_name) between 1 and 40),
  kind text not null check (kind in ('arrived', 'left')),
  at timestamptz not null
);
create index if not exists place_events_household_at on public.place_events (household_id, at desc);

-- Home Link computers and the Home simulator. Only hashes of the pairing code and the token are kept; the browser
-- can't read this table at all (server only).
create table if not exists public.home_devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('home-link', 'simulator')),
  token_hash text unique check (char_length(token_hash) = 64),
  pair_code_hash text unique check (char_length(pair_code_hash) = 64),
  pair_expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  frames_day date,
  frames_count integer not null default 0 check (frames_count >= 0)
);

create table if not exists public.home_cameras (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  device_id uuid not null references public.home_devices (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 40),
  room text not null check (char_length(room) between 1 and 40),
  room_kind text not null check (room_kind in ('living', 'kitchen', 'study', 'entrance', 'dining', 'other')),
  enabled boolean not null default true,
  last_frame_at timestamptz,
  last_status_at timestamptz,
  unique (device_id, key)
);

-- What the Home Reader (Muse Spark) said about a room: words only, never the picture.
create table if not exists public.home_status (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  camera_id uuid not null references public.home_cameras (id) on delete cascade,
  at timestamptz not null,
  reading jsonb not null,
  concern text not null check (concern in ('none', 'watch', 'urgent'))
);
create index if not exists home_status_household_at on public.home_status (household_id, at desc);

-- Watch and urgent alerts from the deterministic rules, with the frames' private Storage paths (deleted after 24 h)
-- and the parent's check.
create table if not exists public.home_alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  camera_id uuid not null references public.home_cameras (id) on delete cascade,
  at timestamptz not null,
  level text not null check (level in ('watch', 'urgent')),
  kind text not null check (char_length(kind) between 1 and 40),
  reason text not null check (char_length(reason) <= 300),
  confidence real not null check (confidence between 0 and 1),
  frame_paths text[] not null default '{}' check (cardinality(frame_paths) <= 6),
  frames_expire_at timestamptz,
  verdict text check (verdict in ('right', 'not-right')),
  verdict_at timestamptz,
  seen_at timestamptz
);
create index if not exists home_alerts_household_at on public.home_alerts (household_id, at desc);

alter table public.guardian_prefs enable row level security;
alter table public.kid_location enable row level security;
alter table public.locations enable row level security;
alter table public.places enable row level security;
alter table public.place_events enable row level security;
alter table public.home_devices enable row level security;
alter table public.home_cameras enable row level security;
alter table public.home_status enable row level security;
alter table public.home_alerts enable row level security;

drop policy if exists guardian_prefs_read on public.guardian_prefs;
drop policy if exists kid_location_read on public.kid_location;
drop policy if exists locations_read on public.locations;
drop policy if exists locations_delete on public.locations;
drop policy if exists places_read on public.places;
drop policy if exists place_events_read on public.place_events;
drop policy if exists home_cameras_read on public.home_cameras;
drop policy if exists home_status_read on public.home_status;
drop policy if exists home_status_delete on public.home_status;
drop policy if exists home_alerts_read on public.home_alerts;
drop policy if exists home_alerts_delete on public.home_alerts;
create policy guardian_prefs_read on public.guardian_prefs for select to authenticated using (household_id = my_household());
create policy kid_location_read on public.kid_location for select to authenticated using (household_id = my_household());
create policy locations_read on public.locations for select to authenticated using (household_id = my_household());
create policy locations_delete on public.locations for delete to authenticated using (household_id = my_household());
create policy places_read on public.places for select to authenticated using (household_id = my_household());
create policy place_events_read on public.place_events for select to authenticated using (household_id = my_household());
create policy home_cameras_read on public.home_cameras for select to authenticated using (household_id = my_household());
create policy home_status_read on public.home_status for select to authenticated using (household_id = my_household());
create policy home_status_delete on public.home_status for delete to authenticated using (household_id = my_household());
create policy home_alerts_read on public.home_alerts for select to authenticated using (household_id = my_household());
create policy home_alerts_delete on public.home_alerts for delete to authenticated using (household_id = my_household());
revoke all on public.guardian_prefs, public.kid_location, public.locations, public.places, public.place_events, public.home_devices, public.home_cameras, public.home_status, public.home_alerts from anon, authenticated;
grant select on public.guardian_prefs, public.kid_location, public.places, public.place_events, public.home_cameras to authenticated;
grant select, delete on public.locations, public.home_status, public.home_alerts to authenticated;
