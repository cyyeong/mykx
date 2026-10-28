-- Kids' magic names (founder, 29 Oct; docs/prd/ACCOUNTS.md): a unique, lowercase username a kid types on the
-- sign-in page to bring their door, with no email and no grown-up on the device. A grown-up sets it in Your family.
alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or (role = 'child' and username ~ '^[a-z][a-z0-9-]{2,23}$'));
create unique index if not exists profiles_username_unique on public.profiles (username) where username is not null;
grant select (username) on public.profiles to authenticated;

-- The synthetic demo family's kids (supabase/seed.sql): jordan, abby and leonard.
update public.profiles set username = lower(nickname)
  where household_id = '00000000-0000-4000-8000-000000000001' and role = 'child' and synthetic and username is null
    and lower(nickname) in ('jordan', 'abby', 'leonard');
