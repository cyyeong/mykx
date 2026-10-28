-- The weekly past-paper scout (28 Oct 2026): what it found on the admin-approved sites, and each run. Links and
-- download decisions only, never a paper (AGENTS.md rule 10). Platform content: admins read it, only the server
-- writes. For a database that already ran the earlier migrations; paste into the Supabase SQL editor. Safe to run
-- more than once.
create table if not exists public.paper_finds (
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
  upload_id uuid references public.knowledge_uploads (id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists paper_finds_seen on public.paper_finds (last_seen desc);

create table if not exists public.scout_runs (
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

alter table public.paper_finds enable row level security;
alter table public.scout_runs enable row level security;
drop policy if exists paper_finds_admin_read on public.paper_finds;
drop policy if exists scout_runs_admin_read on public.scout_runs;
create policy paper_finds_admin_read on public.paper_finds for select to authenticated using (i_am_admin());
create policy scout_runs_admin_read on public.scout_runs for select to authenticated using (i_am_admin());
revoke all on public.paper_finds, public.scout_runs from anon, authenticated;
grant select on public.paper_finds, public.scout_runs to authenticated;
