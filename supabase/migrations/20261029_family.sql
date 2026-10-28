-- Family messages, Kix's Notebook and session readings (28 Oct 2026), with row-level security. For a database
-- that already ran the earlier migrations; paste into the Supabase SQL editor. Safe to run more than once.

-- Family messages (PARENT_INSIGHTS §3): grown-up ↔ kid inside the household, words and Kix stickers. Kix, the
-- Memory Keeper and every language model never read them (rule 12); a voice reply arrives as its transcript only.
create table if not exists public.family_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) <= 300),
  sticker text check (sticker in ('cheer', 'proud', 'hug', 'got-this', 'rest', 'think', 'party', 'love')),
  by_voice boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (body is not null or sticker is not null)
);
create index if not exists family_messages_household_time on public.family_messages (household_id, created_at desc);

-- Kix's Notebook (SKILL_ENGINE §5): a few short pages per kid, kept by the Memory Keeper as patch operations after
-- a session, never labels or diagnoses (rule 11). Every change is a revision a grown-up can read, edit or wipe.
create table if not exists public.notebook_pages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null check (slug in ('personality', 'asking', 'slips', 'moments')),
  body text not null default '' check (char_length(body) <= 4000),
  updated_at timestamptz not null default now(),
  unique (profile_id, slug)
);
create table if not exists public.notebook_revisions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  before text not null default '',
  after text not null default '',
  by text not null check (by in ('memory-keeper', 'grown-up')),
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists notebook_revisions_profile_time on public.notebook_revisions (profile_id, created_at desc);

-- After a session, Muse Spark (Standard) reads only the kid's own words to Kix in it: a mood with its words and
-- confidence, and whether anything worried it. Possibilities for the grown-up, never a diagnosis (rule 12).
create table if not exists public.session_reads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  session_start timestamptz not null,
  session_end timestamptz not null,
  mood text not null check (mood in ('calm', 'happy', 'curious', 'unsure', 'frustrated', 'tired', 'worried')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  evidence jsonb not null default '[]'::jsonb,
  concern boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, session_start)
);

alter table public.family_messages enable row level security;
alter table public.notebook_pages enable row level security;
alter table public.notebook_revisions enable row level security;
alter table public.session_reads enable row level security;
drop policy if exists family_messages_read on public.family_messages;
drop policy if exists family_messages_delete on public.family_messages;
drop policy if exists notebook_pages_read on public.notebook_pages;
drop policy if exists notebook_pages_delete on public.notebook_pages;
drop policy if exists notebook_revisions_read on public.notebook_revisions;
drop policy if exists session_reads_read on public.session_reads;
drop policy if exists session_reads_delete on public.session_reads;

-- Family messages, the Notebook and session readings: the household's grown-ups read them and may delete
-- (wipe) them; only the server writes, after checks.
create policy family_messages_read on public.family_messages for select to authenticated using (household_id = my_household());
create policy family_messages_delete on public.family_messages for delete to authenticated using (household_id = my_household());
create policy notebook_pages_read on public.notebook_pages for select to authenticated using (household_id = my_household());
create policy notebook_pages_delete on public.notebook_pages for delete to authenticated using (household_id = my_household());
create policy notebook_revisions_read on public.notebook_revisions for select to authenticated using (household_id = my_household());
create policy session_reads_read on public.session_reads for select to authenticated using (household_id = my_household());
create policy session_reads_delete on public.session_reads for delete to authenticated using (household_id = my_household());

revoke all on public.family_messages, public.notebook_pages, public.notebook_revisions, public.session_reads from anon, authenticated;
grant select, delete on public.family_messages, public.notebook_pages, public.session_reads to authenticated;
grant select on public.notebook_revisions to authenticated;
