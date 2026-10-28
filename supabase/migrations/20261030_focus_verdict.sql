-- A grown-up's check on a focus-camera note (30 Oct 2026): after watching the face-free replay on the device, they
-- mark it "right" or "not-right". "not-right" notes stop counting as flags and make the child's own threshold a
-- little more forgiving (lib/signals/focus.ts withCorrections). Safe to run more than once.
alter table public.signals add column if not exists verdict text check (verdict in ('right', 'not-right'));
alter table public.signals add column if not exists verdict_at timestamptz;
