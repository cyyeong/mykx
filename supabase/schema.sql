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
  -- Parent PIN (fix 8): scrypt hash of 4 digits, set once in Your family, asked on grown-up pages while a kid
  -- is signed in. Server only, like secret_hash: never granted below, never readable by clients.
  pin_hash text check (pin_hash like 'scrypt$%'),
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
  verdict text check (verdict in ('right', 'not-right')), -- a grown-up's check on a note, after the face-free replay
  verdict_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, kind, minute), -- a resent minute replaces the first; one note per run
  check (kind <> 'camera-minute' or (until is null and evidence is null and confidence is null)),
  check (kind <> 'focus-watch' or (until > minute and evidence is not null and confidence is not null))
);
create index signals_household_kind_time on signals (household_id, kind, minute desc);

-- The guardian (docs/prd/PARENT_INSIGHTS.md §1-2, AGENTS.md rule 12): screen time, the kid's own words to Kix,
-- the parent's limits, and which flags a grown-up has seen. Written by the server after validation only; never
-- read by a model except the kid's own words, through Standard models. Nothing here touches mastery or rewards.
-- One heartbeat per 30 s while a kid page is visible: what the kid is doing, and whether they've been idle.
create table screen_beats (
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade, -- the kid
  slot timestamptz not null, -- the start of the 30 s slot; a second tab in the same slot changes nothing
  kind text not null check (kind in ('learn', 'play', 'create', 'other')),
  idle boolean not null default false, -- no tap or key for a minute or more
  synthetic boolean not null default false, -- sample data, labelled in the UI (hard rule 8)
  primary key (profile_id, slot)
);
create index screen_beats_household_time on screen_beats (household_id, slot desc);

-- What the kid typed or said to Kix (Talk to Kix, and the "Because…" reasons). Never family messages.
create table kix_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  at timestamptz not null,
  text text not null check (char_length(text) between 1 and 500),
  source text not null check (source in ('talk', 'reason')),
  distress boolean not null default false, -- safety words: Kix's caring reply, helplines and an urgent flag
  self_talk boolean not null default false, -- "I'm stupid": a watch sign
  synthetic boolean not null default false
);
create index kix_messages_profile_time on kix_messages (profile_id, at desc);

-- The parent's guardian settings for one kid (Your family → Controls); the daily limit stays on profiles.
-- No row: the band's defaults.
create table guardian_settings (
  profile_id uuid primary key references profiles (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  quiet_from_hour integer not null check (quiet_from_hour between 0 and 23),
  quiet_to_hour integer not null check (quiet_to_hour between 0 and 23),
  break_every_min integer not null check (break_every_min between 10 and 60),
  learn_min_min integer not null check (learn_min_min between 0 and 240),
  play_max_min integer not null check (play_max_min between 0 and 240),
  updated_at timestamptz not null default now()
);

-- Flags a grown-up marked as seen (flags themselves are computed from the rows above, never stored).
create table flags_seen (
  household_id uuid not null references households (id) on delete cascade,
  flag_id text not null check (char_length(flag_id) <= 200),
  seen_at timestamptz not null default now(),
  primary key (household_id, flag_id)
);

-- The knowledge agent (SKILL_ENGINE.md §6): admin uploads read by Muse Spark (Standard) into patterns, traps and
-- marking cues (never a school paper's questions, rule 10), each reviewed, then published as a pack's next minor
-- version that Kix reads. Platform content, not family data: admins only, written by the server.
-- Family messages (PARENT_INSIGHTS §3): grown-up ↔ kid inside the household, words and Kix stickers. Kix, the
-- Memory Keeper and every language model never read them (rule 12); a voice reply arrives as its transcript only.
create table family_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  sender_profile_id uuid not null references profiles (id) on delete cascade,
  recipient_profile_id uuid not null references profiles (id) on delete cascade,
  body text check (char_length(body) <= 300),
  sticker text check (sticker in ('cheer', 'proud', 'hug', 'got-this', 'rest', 'think', 'party', 'love')),
  by_voice boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (body is not null or sticker is not null)
);
create index family_messages_household_time on family_messages (household_id, created_at desc);

-- Kix's Notebook (SKILL_ENGINE §5): a few short pages per kid, kept by the Memory Keeper as patch operations after
-- a session, never labels or diagnoses (rule 11). Every change is a revision a grown-up can read, edit or wipe.
create table notebook_pages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  slug text not null check (slug in ('personality', 'asking', 'slips', 'moments')),
  body text not null default '' check (char_length(body) <= 4000),
  updated_at timestamptz not null default now(),
  unique (profile_id, slug)
);
create table notebook_revisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  slug text not null,
  before text not null default '',
  after text not null default '',
  by text not null check (by in ('memory-keeper', 'grown-up')),
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
create index notebook_revisions_profile_time on notebook_revisions (profile_id, created_at desc);

-- After a session, Muse Spark (Standard) reads only the kid's own words to Kix in it: a mood with its words and
-- confidence, and whether anything worried it. Possibilities for the grown-up, never a diagnosis (rule 12).
create table session_reads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  session_start timestamptz not null,
  session_end timestamptz not null,
  mood text not null check (mood in ('calm', 'happy', 'curious', 'unsure', 'frustrated', 'tired', 'worried')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  evidence jsonb not null default '[]'::jsonb,
  concern boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, session_start)
);

create table knowledge_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references profiles (id) on delete cascade,
  file_name text not null check (char_length(file_name) <= 200),
  bytes integer not null check (bytes >= 0),
  rights text not null check (rights in ('school-private', 'own', 'licensed')),
  source_url text check (char_length(source_url) <= 500),
  status text not null check (status in ('ready', 'failed')),
  pack text check (char_length(pack) <= 40),
  pack_is_new boolean not null default false,
  extraction jsonb, -- lib/knowledge/knowledge.ts extractionSchema; items always empty for school-private
  review jsonb not null default '{}'::jsonb,
  published_in text,
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now()
);
create index knowledge_uploads_pack on knowledge_uploads (pack, created_at desc);

-- Published pack updates: the approved patterns, traps, cues and items, one row per version.
create table skill_updates (
  id uuid primary key default gen_random_uuid(),
  pack text not null check (char_length(pack) <= 40),
  version text not null,
  published_by uuid references profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  summary text not null check (char_length(summary) <= 300),
  payload jsonb not null, -- { archetypes, traps, markingCues, items }
  unique (pack, version)
);

-- The weekly past-paper scout (lib/papers/scan.ts, app/api/cron/papers): links and download decisions only, never a
-- paper (rule 10).
create table paper_finds (
  id uuid primary key default gen_random_uuid(),
  -- site + the file link, or the page when there's no file link (one page can list several papers)
  key text not null unique check (char_length(key) <= 650),
  site text not null check (char_length(site) <= 40),
  title text not null check (char_length(title) <= 300),
  level text check (char_length(level) <= 10),
  subject text check (char_length(subject) <= 40),
  year integer,
  exam_type text check (char_length(exam_type) <= 20),
  school text check (char_length(school) <= 120),
  page_url text not null check (char_length(page_url) <= 600),
  file_url text check (char_length(file_url) <= 600),
  fetch_mode text not null check (fetch_mode in ('auto', 'manual', 'skip')),
  reason text not null check (char_length(reason) <= 400),
  pack text check (char_length(pack) <= 40),
  pack_is_new boolean not null default false,
  status text not null default 'new' check (status in ('new', 'seen', 'dismissed', 'read')),
  upload_id uuid references knowledge_uploads (id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index paper_finds_seen on paper_finds (last_seen desc);

create table scout_runs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  trigger text not null check (trigger in ('weekly', 'admin')),
  found integer not null default 0,
  fresh integer not null default 0,
  auto integer not null default 0,
  manual integer not null default 0,
  skip integer not null default 0,
  problems jsonb not null default '[]'::jsonb
);

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

-- Game progress (GAMES.md §3): one row per kid and game. Best stars per level, the furthest level unlocked, personal
-- bests and per-key tallies (shown to the grown-up as information only). Personal bests only: never compared
-- between children. Never mastery evidence (rule 5). Written by the server after each round.
create table game_progress (
  household_id uuid not null references households (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  game text not null check (char_length(game) <= 40),
  stage integer not null default 1 check (stage between 1 and 9),
  level integer not null default 1 check (level between 1 and 5),
  stars jsonb not null default '{}'::jsonb,
  best_accuracy numeric(5, 4) not null default 0,
  best_wpm integer not null default 0,
  keys jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, game)
);
