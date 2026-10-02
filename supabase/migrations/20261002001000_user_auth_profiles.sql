alter table public.users
  add column dob date,
  add column gender text,
  add column upi_id text,
  add column user_type text not null default 'player'
    check (user_type in ('player', 'admin', 'moderator')),
  add column active boolean not null default true,
  add column is_blocked boolean not null default false;

update public.users as profile
set
  full_name = coalesce(profile.full_name, nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '')),
  email = coalesce(profile.email, auth_user.email),
  dob = coalesce(profile.dob, nullif(auth_user.raw_user_meta_data ->> 'dob', '')::date),
  gender = coalesce(profile.gender, nullif(auth_user.raw_user_meta_data ->> 'gender', '')),
  upi_id = coalesce(profile.upi_id, nullif(btrim(auth_user.raw_user_meta_data ->> 'upi_id'), ''))
from auth.users as auth_user
where profile.id = auth_user.id;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, phone, full_name, dob, gender, upi_id)
  values (
    new.id,
    coalesce(new.email, nullif(btrim(new.raw_user_meta_data ->> 'email'), '')),
    new.phone,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(new.raw_user_meta_data ->> 'dob', '')::date,
    nullif(new.raw_user_meta_data ->> 'gender', ''),
    nullif(btrim(new.raw_user_meta_data ->> 'upi_id'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on table public.users from public, anon, authenticated;
grant select on table public.users to authenticated;
grant update (full_name, dob, gender, upi_id) on table public.users to authenticated;
