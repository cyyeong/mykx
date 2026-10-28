-- Skill Engine events (docs/prd/SKILL_ENGINE.md §5, lib/skills/runtime.ts): every skill load, refusal and tool
-- call an agent makes, for Under the hood. Ids, pack names and section ids only, never a child's words.
-- Written and read by the server only (no browser policies). Kept 30 days (/api/cron/guardian trims it).
create table if not exists public.skill_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  agent text not null check (agent in ('tutor', 'ask-kix')),
  kind text not null check (kind in ('load', 'unload', 'refuse', 'tool')),
  pack text check (char_length(pack) <= 40),
  tool text check (char_length(tool) <= 40),
  target text check (char_length(target) <= 120),
  ok boolean not null,
  note text check (char_length(note) <= 160),
  created_at timestamptz not null default now()
);
create index if not exists skill_events_created on public.skill_events (created_at desc);
alter table public.skill_events enable row level security;
revoke all on public.skill_events from anon, authenticated;
