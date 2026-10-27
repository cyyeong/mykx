-- Parent PIN (28 Oct 2026): the 4-digit code set once in Your family, asked on grown-up pages while a kid
-- is signed in (USER_STORIES §8.4 fix 8). For a database that already ran schema.sql; paste it into the
-- Supabase SQL editor. Safe to run more than once. Fresh installs get the same from schema.sql
-- (supabase/schema.test.ts checks the migration agrees). Server only, like secret_hash: no grants here,
-- so clients can never read it; only the server (service role) writes it through app/api/auth/pin.
alter table public.profiles add column if not exists pin_hash text check (pin_hash like 'scrypt$%');
comment on column public.profiles.pin_hash is 'Parent PIN, scrypt hash of 4 digits. Server only: never grant.';
