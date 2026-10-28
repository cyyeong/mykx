-- Row-level security: a signed-in parent sees and changes only their own household.
-- The server's service role bypasses RLS for writes that must be deterministic (attempts, ledger,
-- model_runs are written by route handlers after validation, not by the browser).

-- The household of the signed-in parent; null for anyone else, or for a disabled account.
create or replace function public.my_household() returns uuid
  language sql stable security definer set search_path = public
as $$
  select household_id from profiles where user_id = auth.uid() and role = 'parent' and disabled_at is null limit 1
$$;

create or replace function public.i_am_admin() returns boolean
  language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from profiles where user_id = auth.uid() and disabled_at is null limit 1), false)
$$;

alter table households enable row level security;
alter table profiles enable row level security;
alter table attempts enable row level security;
alter table ledger enable row level security;
alter table creations enable row level security;
alter table shares enable row level security;
alter table summaries enable row level security;
alter table model_runs enable row level security;
alter table audit_log enable row level security;
alter table signals enable row level security;
alter table screen_beats enable row level security;
alter table kix_messages enable row level security;
alter table guardian_settings enable row level security;
alter table flags_seen enable row level security;
alter table family_messages enable row level security;
alter table game_progress enable row level security;
alter table skill_events enable row level security; -- server only: no policies
alter table notebook_pages enable row level security;
alter table notebook_revisions enable row level security;
alter table session_reads enable row level security;
alter table knowledge_uploads enable row level security;
alter table skill_updates enable row level security;
alter table paper_finds enable row level security;
alter table scout_runs enable row level security;
alter table guardian_prefs enable row level security;
alter table kid_location enable row level security;
alter table locations enable row level security;
alter table places enable row level security;
alter table place_events enable row level security;
alter table home_devices enable row level security;
alter table home_cameras enable row level security;
alter table home_status enable row level security;
alter table home_alerts enable row level security;

create policy households_own on households for select to authenticated using (id = my_household());

-- Parents read their household's profiles and may update children's settings (pack, interests,
-- voice, camera, limits). Creating profiles goes through the server.
create policy profiles_read on profiles for select to authenticated using (household_id = my_household());
create policy profiles_update on profiles for update to authenticated
  using (household_id = my_household()) with check (household_id = my_household());

-- Progress tables: read-only to the browser; the server writes them after validation.
create policy attempts_read on attempts for select to authenticated using (household_id = my_household());
create policy ledger_read on ledger for select to authenticated using (household_id = my_household());
create policy summaries_read on summaries for select to authenticated using (household_id = my_household());
create policy model_runs_read on model_runs for select to authenticated
  using (household_id = my_household() or i_am_admin());

-- The audit trail: admins read it; only the server (service role) writes it. Kid lockouts and family
-- changes are in here too, but `detail` never holds child content.
create policy audit_log_admin_read on audit_log for select to authenticated using (i_am_admin());

-- Wellbeing signals: the household's grown-ups read them and may delete one (PARENT_INSIGHTS §4.5); only the
-- server writes them, after validation, so a browser can't add a signal or change a count.
create policy signals_read on signals for select to authenticated using (household_id = my_household());
create policy signals_delete on signals for delete to authenticated using (household_id = my_household());

-- The guardian: grown-ups read their household's screen time, their kids' words to Kix, limits and seen flags,
-- and may delete a beat or a message (PARENT_INSIGHTS §4.5). Only the server writes them.
create policy screen_beats_read on screen_beats for select to authenticated using (household_id = my_household());
create policy screen_beats_delete on screen_beats for delete to authenticated using (household_id = my_household());
create policy kix_messages_read on kix_messages for select to authenticated using (household_id = my_household());
create policy kix_messages_delete on kix_messages for delete to authenticated using (household_id = my_household());
create policy guardian_settings_read on guardian_settings for select to authenticated using (household_id = my_household());
create policy flags_seen_read on flags_seen for select to authenticated using (household_id = my_household());

-- Family messages, the Notebook and session readings: the household's grown-ups read them and may delete
-- (wipe) them; only the server writes, after checks.
create policy game_progress_read on game_progress for select to authenticated using (household_id = my_household());
create policy game_progress_delete on game_progress for delete to authenticated using (household_id = my_household());
create policy family_messages_read on family_messages for select to authenticated using (household_id = my_household());
create policy family_messages_delete on family_messages for delete to authenticated using (household_id = my_household());
create policy notebook_pages_read on notebook_pages for select to authenticated using (household_id = my_household());
create policy notebook_pages_delete on notebook_pages for delete to authenticated using (household_id = my_household());
create policy notebook_revisions_read on notebook_revisions for select to authenticated using (household_id = my_household());
create policy session_reads_read on session_reads for select to authenticated using (household_id = my_household());
create policy session_reads_delete on session_reads for delete to authenticated using (household_id = my_household());

-- Knowledge uploads and pack updates: admins read them; only the server writes (after review).
create policy knowledge_uploads_admin_read on knowledge_uploads for select to authenticated using (i_am_admin());
create policy skill_updates_admin_read on skill_updates for select to authenticated using (i_am_admin());
create policy paper_finds_admin_read on paper_finds for select to authenticated using (i_am_admin());
create policy scout_runs_admin_read on scout_runs for select to authenticated using (i_am_admin());
-- Guardian: the household reads; only the server writes (and the parent may delete points, statuses and alerts).
create policy guardian_prefs_read on guardian_prefs for select to authenticated using (household_id = my_household());
create policy kid_location_read on kid_location for select to authenticated using (household_id = my_household());
create policy locations_read on locations for select to authenticated using (household_id = my_household());
create policy locations_delete on locations for delete to authenticated using (household_id = my_household());
create policy places_read on places for select to authenticated using (household_id = my_household());
create policy place_events_read on place_events for select to authenticated using (household_id = my_household());
create policy home_cameras_read on home_cameras for select to authenticated using (household_id = my_household());
create policy home_status_read on home_status for select to authenticated using (household_id = my_household());
create policy home_status_delete on home_status for delete to authenticated using (household_id = my_household());
create policy home_alerts_read on home_alerts for select to authenticated using (household_id = my_household());
create policy home_alerts_delete on home_alerts for delete to authenticated using (household_id = my_household());

-- Creations and shares stay inside the household.
create policy creations_all on creations for all to authenticated
  using (household_id = my_household()) with check (household_id = my_household());
create policy shares_all on shares for all to authenticated
  using (household_id = my_household()) with check (
    household_id = my_household()
    and exists (select 1 from profiles p where p.id = recipient_profile_id and p.household_id = my_household())
    and exists (select 1 from creations c where c.id = creation_id and c.household_id = my_household())
  );

-- Supabase grants every role everything on new public tables by default, so start from nothing and
-- grant exactly what the browser needs. RLS still scopes every row by household.
revoke all on households, profiles, attempts, ledger, creations, shares, summaries, model_runs, audit_log, signals, screen_beats, kix_messages, guardian_settings, flags_seen, knowledge_uploads, skill_updates, paper_finds, scout_runs, guardian_prefs, kid_location, locations, places, place_events, home_devices, home_cameras, home_status, home_alerts, family_messages, notebook_pages, notebook_revisions, session_reads, game_progress, skill_events from anon, authenticated;
grant usage on schema public to authenticated;
grant select on households, attempts, ledger, summaries, model_runs, audit_log to authenticated;
-- Every profile column except secret_hash and pin_hash (kid secrets and the parent PIN are checked by the server only).
grant select (
  id, household_id, user_id, role, is_admin, nickname, username, band, level, pack, interests, kix_url,
  voice_enabled, camera_enabled, daily_limit_min, synthetic, secret_kind, secret_set_at, secret_event,
  failed_attempts, locked_until, disabled_at, last_sign_in_at, created_at
) on profiles to authenticated;
-- Settings a parent may change directly. Nicknames, secrets, locks and the admin flag go through
-- server routes (app/api/family, app/api/me, app/api/admin), which write the audit log.
grant update (pack, interests, kix_url, voice_enabled, camera_enabled, daily_limit_min) on profiles to authenticated;
grant select, insert, update, delete on creations, shares to authenticated;
grant select, delete on signals to authenticated;
grant select, delete on screen_beats, kix_messages to authenticated;
grant select on guardian_settings, flags_seen to authenticated;
grant select on knowledge_uploads, skill_updates, paper_finds, scout_runs to authenticated;
grant select on guardian_prefs, kid_location, places, place_events, home_cameras to authenticated;
grant select, delete on locations, home_status, home_alerts to authenticated;
grant select, delete on family_messages, notebook_pages, session_reads to authenticated;
grant select on notebook_revisions to authenticated;
grant select, delete on game_progress to authenticated;
