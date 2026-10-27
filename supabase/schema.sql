-- myKx core schema (stream B). Skills tables: supabase/skills.sql (stream C).
-- Family tables: supabase/family.sql (stream D). Row-level security: supabase/rls.sql.
-- Progress is deterministic: attempts and ledger are written by tested server code, never by a model.

-- gen_random_uuid() is built into Postgres 13+.

-- A family. Everything a child does belongs to exactly one household.
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- People in a household. The parent signs in with email (user_id = auth.users.id); children have
-- no email: they pick their door on a device the parent signed in on and enter a picture code
-- (junior) or password (teen), checked by the server (docs/prd/ACCOUNTS.md).
create table profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  role text not null check (role in ('parent', 'child')),
  is_admin boolean not null default false, -- skills admin (platform content team; the demo parent)
  nickname text not null, -- nicknames, never full names (hard rule 13)
  band text check (band in ('junior', 'teen')),
  level text check (level in ('P3', 'P6', 'Sec 2')),
  pack text check (pack in ('dreamlight', 'anime-sky', 'toon-pop', 'idol-stage', 'terrarium')),
  interests text[] not null default '{}',
  kix_url text,
  voice_enabled boolean not null default false,
  camera_enabled boolean not null default false, -- focus camera: on-device counts only, off until a grown-up turns it on
  daily_limit_min integer check (daily_limit_min between 5 and 240),
  synthetic boolean not null default false, -- demo data, labelled in the UI (hard rule 8)
  -- Kid sign-in (ACCOUNTS.md §5). The hash is scrypt, written only by the server (lib/auth/secrets.ts)
  -- and never readable by clients (rls.sql grants every other column). A null hash means the door
  -- needs setup: a picture code is chosen with the kid at their door; a reset clears it.
  secret_kind text check (secret_kind in ('pictures', 'password')),
  secret_hash text check (secret_hash like 'scrypt$%'),
  secret_set_at timestamptz,
  secret_event text check (secret_event in ('set', 'changed', 'reset')),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz, -- 5 wrong tries lock for a minute; an admin lock is far in the future
  disabled_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  check (role = 'parent' or (band is not null and level is not null)),
  check (char_length(btrim(nickname)) >= 1 and char_length(nickname) <= case when role = 'child' then 20 else 60 end),
  check (role = 'child' or (secret_kind is null and secret_hash is null)), -- parents use Supabase Auth
  check (secret_hash is null or secret_kind is not null),
  check (role = 'parent' or not is_admin)
);
create index profiles_household on profiles (household_id);
-- One door per name in a family, so "Who's learning?" is never ambiguous.
create unique index profiles_household_nickname on profiles (household_id, lower(nickname));

-- One submitted answer. Mastery is recomputed from these by lib/domain (PRD §6).
create table attempts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  skill_id text not null,
  skill_version text not null,
  item_id text not null,
  topic text not null,
  subskill text,
  answer jsonb not null,
  correct boolean not null,
  marks numeric(5, 2) not null check (marks >= 0),
  max_marks numeric(5, 2) not null check (max_marks > 0 and marks <= max_marks),
  first_try boolean not null,
  hints_used integer not null default 0 check (hints_used >= 0),
  revealed boolean not null default false,
  duration_ms integer check (duration_ms >= 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index attempts_profile_time on attempts (profile_id, created_at desc);
create index attempts_profile_subskill on attempts (profile_id, topic, subskill);

-- Rewards and unlocks. Deterministic rules only; the unique key makes every grant happen once.
create table ledger (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('stars', 'card', 'companion_stage', 'squadron_unlock')),
  ref text, -- card id, stage name or jet id
  amount integer not null default 0,
  rule text not null, -- which deterministic rule granted it
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index ledger_profile_time on ledger (profile_id, created_at desc);

-- Vibe Zone creations: validated JSON specs only (hard rule 4), every version kept.
create table creations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('flashcards', 'song')),
  title text not null,
  versions jsonb not null default '[]'::jsonb check (jsonb_typeof(versions) = 'array'),
  current_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A creation version shared with someone in the same household; revocable.
create table shares (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  creation_id uuid not null references creations (id) on delete cascade,
  version integer not null,
  recipient_profile_id uuid not null references profiles (id) on delete cascade,
  approved_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Tonight's summary: one visible result per child per Singapore date, revisions kept.
create table summaries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  local_date date not null, -- Asia/Singapore
  revision integer not null default 1,
  body jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  stale boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, local_date, revision)
);

-- Every model call, for "under the hood" and cost tracking. No prompts, outputs, audio or keys.
create table model_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households (id) on delete set null,
  profile_id uuid references profiles (id) on delete set null,
  route text not null,
  operation text not null,
  model text not null,
  request_id text,
  response_id text,
  latency_ms integer,
  first_token_ms integer,
  input_tokens integer,
  output_tokens integer,
  images integer,
  audio_seconds integer,
  cost_usd numeric(10, 6),
  ok boolean not null,
  error text,
  created_at timestamptz not null default now(),
  check (model not like '%contributor%') -- hard rule 1, enforced in the database too
);
create index model_runs_household_time on model_runs (household_id, created_at desc);

-- Wellbeing signals, shown to grown-ups only (docs/prd/PARENT_INSIGHTS.md, AGENTS.md rule 12). Today: the focus
-- camera's per-minute counts ('camera-minute') and its "possibly losing focus" notes ('focus-watch'), written by
-- the server after validation (app/api/signals/focus). Counts only: no column can hold an image, a video frame or
-- a landmark, and `counts` accepts just the four count keys. Signals never change mastery or rewards. Stream D
-- adds its kinds here. Migration for an existing database: supabase/migrations/20261028_focus_camera.sql.
create table signals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade, -- the kid
  kind text not null check (kind in ('camera-minute', 'focus-watch')),
  minute timestamptz not null, -- start of the minute; for a note, the start of its first minute
  until timestamptz, -- a note's end
  counts jsonb not null default '{}'::jsonb check (
    jsonb_typeof(counts) = 'object'
    and counts - array['awaySeconds', 'eyesClosedEvents', 'yawns', 'facePresentRatio'] = '{}'::jsonb
  ),
  evidence text check (char_length(evidence) <= 400), -- plain words, "possibly …" against the kid's own usual
  confidence text check (confidence in ('low', 'medium', 'high')),
  synthetic boolean not null default false, -- sample data, labelled in the UI (hard rule 8)
  created_at timestamptz not null default now(),
  unique (profile_id, kind, minute), -- a resent minute replaces the first; one note per run
  check (kind <> 'camera-minute' or (until is null and evidence is null and confidence is null)),
  check (kind <> 'focus-watch' or (until > minute and evidence is not null and confidence is not null))
);
create index signals_household_kind_time on signals (household_id, kind, minute desc);

-- Account actions: admin actions (always), family changes and kid lockouts. Append-only, written by
-- the server's service role; readable by admins (rls.sql). `detail` holds field names and reasons,
-- never a child's messages, answers, Notebook, nickname or secrets. No foreign keys, so the trail
-- outlives a removed profile.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid, -- profile id; null for the system (a lockout)
  actor_role text not null check (actor_role in ('parent', 'admin', 'kid', 'system')),
  action text not null check (action ~ '^[a-z]+\.[a-z-]+$'), -- e.g. admin.lock, kid.lockout
  target uuid, -- profile or household id
  household_id uuid, -- the target's household, for filtering
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_log_time on audit_log (created_at desc);
create index audit_log_target on audit_log (target, created_at desc);
