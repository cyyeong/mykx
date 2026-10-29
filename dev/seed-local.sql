-- Local Supabase only (scripts/local-supabase.ts appends this to supabase/seed.sql): a sign-in for the synthetic demo
-- family's grown-up, demo@mykx.ai, with the local-only password local-demo-only, linked to the seeded parent profile
-- (also the admin). The kids' local-only secrets are already in seed.sql. Never run this against production: its
-- sample family gets its own sign-ins from .env.local through scripts/set-demo-secrets.ts.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'demo@mykx.ai',
  extensions.crypt('local-demo-only', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(), '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1',
  '{"sub": "00000000-0000-4000-8000-0000000000a1", "email": "demo@mykx.ai", "email_verified": true}', 'email', now(), now(), now()
)
on conflict do nothing;

update public.profiles set user_id = '00000000-0000-4000-8000-0000000000a1' where id = '00000000-0000-4000-8000-000000000010';
