-- The knowledge agent (28 Oct 2026): admin uploads and published pack updates, admins-only RLS. For a database
-- that already ran schema.sql and rls.sql; paste into the Supabase SQL editor. Safe to run more than once.

-- The knowledge agent (SKILL_ENGINE.md §6): admin uploads read by Muse Spark (Standard) into patterns, traps and
-- marking cues (never a school paper's questions, rule 10), each reviewed, then published as a pack's next minor
-- version that Kix reads. Platform content, not family data: admins only, written by the server.
create table if not exists public.knowledge_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
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
create index if not exists knowledge_uploads_pack on public.knowledge_uploads (pack, created_at desc);

-- Published pack updates: the approved patterns, traps, cues and items, one row per version.
create table if not exists public.skill_updates (
  id uuid primary key default gen_random_uuid(),
  pack text not null check (char_length(pack) <= 40),
  version text not null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  summary text not null check (char_length(summary) <= 300),
  payload jsonb not null, -- { archetypes, traps, markingCues, items }
  unique (pack, version)
);

alter table public.knowledge_uploads enable row level security;
alter table public.skill_updates enable row level security;
drop policy if exists knowledge_uploads_admin_read on public.knowledge_uploads;
drop policy if exists skill_updates_admin_read on public.skill_updates;

-- Knowledge uploads and pack updates: admins read them; only the server writes (after review).
create policy knowledge_uploads_admin_read on public.knowledge_uploads for select to authenticated using (i_am_admin());
create policy skill_updates_admin_read on public.skill_updates for select to authenticated using (i_am_admin());

revoke all on public.knowledge_uploads, public.skill_updates from anon, authenticated;
grant select on public.knowledge_uploads, public.skill_updates to authenticated;
