-- Skills you can edit, and knowledge that refines a skill (founder, 29 Oct; docs/prd/SKILL_ENGINE.md §6 and §7).
-- skill_versions: every edit, Muse enhancement, import, knowledge refinement and restore of a pack, as a whole
-- snapshot of its text files (skill.json, SKILL.md, references/*.md, items/*.json). The pack on disk is the default
-- and is never a row. The published version is the newest non-deleted published row; delete is a soft delete.
-- knowledge_sessions and two columns on knowledge_uploads: a review session groups uploads (a question paper now,
-- its answer sheet later) and keeps the admin's overrides, edits, pairing and Muse's cross-checks.
-- Platform content, written and read by the server only (no browser policies). Safe to run twice.
create table if not exists public.skill_versions (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null check (pack_id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  files jsonb not null check (jsonb_typeof(files) = 'object'),
  status text not null check (status in ('draft', 'published')),
  source text not null check (source in ('edit', 'enhance', 'import', 'knowledge', 'restore')),
  note text check (char_length(note) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  deleted_at timestamptz,
  unique (pack_id, version),
  check (status = 'draft' or published_at is not null)
);
create index if not exists skill_versions_pack on public.skill_versions (pack_id, created_at desc);
alter table public.skill_versions enable row level security;
revoke all on public.skill_versions from anon, authenticated;

create table if not exists public.knowledge_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  state jsonb not null default '{}'::jsonb -- { kixItems, published }: Kix's own questions per pack, what publishing made
);
alter table public.knowledge_sessions enable row level security;
revoke all on public.knowledge_sessions from anon, authenticated;

alter table public.knowledge_uploads add column if not exists session_id uuid references public.knowledge_sessions (id) on delete set null;
-- { overrides, pairWith, edits, checks, checkedAt, resolved }: the admin's review; never a school paper's questions
alter table public.knowledge_uploads add column if not exists state jsonb not null default '{}'::jsonb;
create index if not exists knowledge_uploads_session on public.knowledge_uploads (session_id, created_at);
