-- Agents you can edit (founder, 29 Oct; docs/ARCHITECTURE.md §4.11, lib/agents): versions of each Muse Spark agent's
-- instructions, saved and published by admins in Under the hood. The built-in default is version 1 in code and is
-- never a row, so it can't be deleted. Safety guardrails stay in code. Platform content, never a child's data.
-- Written and read by the server only (no browser policies). Soft delete keeps the row for the audit trail.
create table if not exists public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null check (agent_id ~ '^[a-z][a-z-]{1,39}$'),
  version integer not null check (version >= 2),
  instructions text not null check (char_length(instructions) between 1 and 8000),
  note text check (char_length(note) <= 120),
  status text not null check (status in ('draft', 'published')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (agent_id, version)
);
create index if not exists agent_versions_live on public.agent_versions (agent_id, version desc) where deleted_at is null;
alter table public.agent_versions enable row level security;
revoke all on public.agent_versions from anon, authenticated;
