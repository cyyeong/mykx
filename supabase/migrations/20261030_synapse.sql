-- Kix Synapse, the self-learning engine (founder, 29 Oct; docs/prd/SYNAPSE.md, lib/synapse). Kids' reports with the
-- de-identified words of the one turn they reported, learned cautions, eval cases and runs, the admin's settings, and
-- each family's "Help Kix learn" choice. Server only: no browser policies, no grants. Safe to run more than once.
create table if not exists public.synapse_reports (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (char_length(status) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  doc jsonb not null check (pg_column_size(doc) < 200000)
);
create index if not exists synapse_reports_time on public.synapse_reports (created_at desc);
create index if not exists synapse_reports_household on public.synapse_reports (household_id, created_at desc);

create table if not exists public.synapse_cautions (
  id uuid primary key,
  agent_id text not null check (agent_id ~ '^[a-z][a-z-]{1,39}$'),
  status text not null check (status in ('active', 'waiting', 'retired')),
  created_at timestamptz not null default now(),
  doc jsonb not null
);

create table if not exists public.synapse_evals (
  id uuid primary key,
  kind text not null check (kind in ('case', 'run')),
  created_at timestamptz not null default now(),
  doc jsonb not null check (pg_column_size(doc) < 200000)
);
create index if not exists synapse_evals_kind_time on public.synapse_evals (kind, created_at desc);

create table if not exists public.synapse_settings (
  id smallint primary key check (id = 1),
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.synapse_consents (
  household_id uuid primary key references public.households (id) on delete cascade,
  help_kix_learn boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.synapse_reports enable row level security;
alter table public.synapse_cautions enable row level security;
alter table public.synapse_evals enable row level security;
alter table public.synapse_settings enable row level security;
alter table public.synapse_consents enable row level security;
revoke all on public.synapse_reports, public.synapse_cautions, public.synapse_evals, public.synapse_settings, public.synapse_consents from anon, authenticated;

-- A fix Kix Synapse ships is a skill version with source 'synapse'.
alter table public.skill_versions drop constraint if exists skill_versions_source_check;
alter table public.skill_versions add constraint skill_versions_source_check check (source in ('edit', 'enhance', 'import', 'knowledge', 'restore', 'synapse'));
