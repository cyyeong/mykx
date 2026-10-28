-- Game progress for the Arcade (28 Oct 2026), with row-level security. For a database that already ran the
-- earlier migrations; paste into the Supabase SQL editor. Safe to run more than once.

-- Game progress (GAMES.md §3): one row per kid and game. Best stars per level, the furthest level unlocked, personal
-- bests and per-key tallies (shown to the grown-up as information only). Personal bests only: never compared
-- between children. Never mastery evidence (rule 5). Written by the server after each round.
create table if not exists public.game_progress (
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
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

alter table public.game_progress enable row level security;
drop policy if exists game_progress_read on public.game_progress;
drop policy if exists game_progress_delete on public.game_progress;
-- The household's grown-ups read it and may delete it; only the server writes.
create policy game_progress_read on public.game_progress for select to authenticated using (household_id = my_household());
create policy game_progress_delete on public.game_progress for delete to authenticated using (household_id = my_household());
revoke all on public.game_progress from anon, authenticated;
grant select, delete on public.game_progress to authenticated;
