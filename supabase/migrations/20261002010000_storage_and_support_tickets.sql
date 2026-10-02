alter table public.support_tickets
  add column resolution text,
  add column image_path text;

update public.support_tickets
set status = upper(status);

alter table public.support_tickets
  drop constraint support_tickets_status_check,
  add constraint support_tickets_status_check
    check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  add constraint support_tickets_resolution_length_check
    check (resolution is null or length(resolution) <= 4000);

alter table public.support_tickets enable row level security;
revoke all on table public.support_tickets from public, anon, authenticated;
grant select on table public.support_tickets to authenticated;

drop policy if exists "Users can read their own support tickets"
  on public.support_tickets;
create policy "Users and admins can read support tickets"
  on public.support_tickets for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.users
      where users.id = (select auth.uid())
        and users.user_type = 'admin'
        and users.active
        and not users.is_blocked
    )
  );

create function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and user_type = 'admin'
      and active
      and not is_blocked
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated;

create policy "Active admins can read player profiles for support"
  on public.users for select to authenticated
  using (public.is_active_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('deposit_proofs', 'deposit_proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('game_winners', 'game_winners', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('app_assets', 'app_assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('games', 'games', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('support_images', 'support_images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read app and game assets"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('app_assets', 'games'));

create policy "Active admins can upload app assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('app_assets', 'games')
    and exists (
      select 1 from public.users
      where users.id = (select auth.uid())
        and users.user_type = 'admin'
        and users.active
        and not users.is_blocked
    )
  );

create policy "Active admins can update app assets"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('app_assets', 'games')
    and exists (
      select 1 from public.users
      where users.id = (select auth.uid())
        and users.user_type = 'admin'
        and users.active
        and not users.is_blocked
    )
  )
  with check (
    bucket_id in ('app_assets', 'games')
    and exists (
      select 1 from public.users
      where users.id = (select auth.uid())
        and users.user_type = 'admin'
        and users.active
        and not users.is_blocked
    )
  );

create policy "Active admins can delete app assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('app_assets', 'games')
    and exists (
      select 1 from public.users
      where users.id = (select auth.uid())
        and users.user_type = 'admin'
        and users.active
        and not users.is_blocked
    )
  );

create policy "Ticket owners can upload support images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support_images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  );

create policy "Ticket owners and admins can read support images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'support_images'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.users
        where users.id = (select auth.uid())
          and users.user_type = 'admin'
          and users.active
          and not users.is_blocked
      )
    )
  );

create policy "Owners can delete unlinked support images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'support_images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.support_tickets
      where support_tickets.image_path = storage.objects.name
    )
  );

create function public.create_support_ticket(
  p_ticket_id uuid,
  p_subject text,
  p_category text,
  p_description text,
  p_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_subject text := nullif(btrim(p_subject), '');
  v_category text := nullif(btrim(p_category), '');
  v_description text := nullif(btrim(p_description), '');
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.users
    where id = v_user_id and active and not is_blocked
  ) then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;
  if p_ticket_id is null
    or v_subject is null or length(v_subject) > 160
    or v_category is null
    or v_category not in ('Match issue', 'Payments', 'Account', 'Other')
    or v_description is null or length(v_description) < 10 or length(v_description) > 4000 then
    raise exception 'Ticket subject, category, and description are invalid'
      using errcode = '22023';
  end if;
  if p_image_path is not null and (
    (storage.foldername(p_image_path))[1] <> v_user_id::text
    or (storage.foldername(p_image_path))[2] <> p_ticket_id::text
    or not exists (
      select 1 from storage.objects
      where bucket_id = 'support_images' and name = p_image_path
    )
  ) then
    raise exception 'Support image is invalid or was not uploaded'
      using errcode = '22023';
  end if;

  insert into public.support_tickets (
    id, user_id, subject, category, description, status, image_path
  )
  values (
    p_ticket_id, v_user_id, v_subject, v_category, v_description, 'OPEN', p_image_path
  );

  return p_ticket_id;
end;
$$;

create function public.update_support_ticket(
  p_ticket_id uuid,
  p_status text,
  p_resolution text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_type text;
  v_actor_active boolean;
  v_actor_blocked boolean;
  v_ticket public.support_tickets%rowtype;
  v_resolution text := nullif(btrim(p_resolution), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;

  select user_type, active, is_blocked
  into v_actor_type, v_actor_active, v_actor_blocked
  from public.users
  where id = v_actor_id;

  if not found or v_actor_type <> 'admin' or not v_actor_active or v_actor_blocked then
    raise exception 'Active administrator authorization is required'
      using errcode = '42501';
  end if;
  if p_status is null
    or p_status not in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')
    or (p_status in ('RESOLVED', 'CLOSED') and v_resolution is null)
    or (v_resolution is not null and length(v_resolution) > 4000) then
    raise exception 'Status or resolution is invalid'
      using errcode = '22023';
  end if;

  select *
  into v_ticket
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Support ticket does not exist'
      using errcode = 'P0002';
  end if;

  update public.support_tickets
  set status = p_status, resolution = v_resolution
  where id = v_ticket.id;

  return v_ticket.id;
end;
$$;

revoke all on function public.create_support_ticket(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.update_support_ticket(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_support_ticket(uuid, text, text, text, text)
  to authenticated;
grant execute on function public.update_support_ticket(uuid, text, text)
  to authenticated;
