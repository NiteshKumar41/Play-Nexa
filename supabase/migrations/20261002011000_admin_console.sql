create or replace function public.require_active_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_admin() then
    raise exception 'Active administrator authorization is required'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_active_admin() from public, anon, authenticated;

create or replace function public.get_admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
begin
  perform public.require_active_admin();

  select jsonb_build_object(
    'players', (select count(*) from public.users where user_type <> 'admin'),
    'matches', (select count(*) from public.game_matches),
    'completed_matches', (select count(*) from public.game_matches where status in ('completed', 'settled')),
    'deposits_total', coalesce((select sum(amount) from public.wallet_transactions where transaction_type = 'ADD_MONEY' and status = 'completed'), 0),
    'withdrawals_total', coalesce((select sum(amount) from public.wallet_transactions where transaction_type = 'WITHDRAW' and status = 'SUCCESS'), 0),
    'platform_earnings', coalesce((select sum(platform_fee) from public.game_matches where status = 'settled'), 0),
    'pending_deposits', coalesce((select sum(amount) from public.deposits where status = 'PENDING'), 0),
    'pending_withdrawals', coalesce((select sum(amount) from public.wallet_transactions where transaction_type = 'WITHDRAW' and status = 'INITIATED'), 0),
    'pending_disputes', (select count(*) from public.game_matches where status = 'disputed'),
    'pending_tickets', (select count(*) from public.support_tickets where status in ('OPEN', 'IN_PROGRESS'))
  )
  into v_summary;

  return v_summary;
end;
$$;

create or replace function public.process_manual_deposit(
  p_deposit_id uuid,
  p_approve boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deposit public.deposits%rowtype;
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_transaction_id uuid;
begin
  perform public.require_active_admin();
  if p_approve is null then
    raise exception 'Deposit decision is required'
      using errcode = '22004';
  end if;

  select *
  into v_deposit
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'Deposit does not exist'
      using errcode = 'P0002';
  end if;

  if v_deposit.status in ('APPROVED', 'REJECTED') then
    if (p_approve and v_deposit.status = 'APPROVED')
      or (not p_approve and v_deposit.status = 'REJECTED') then
      return v_deposit.id;
    end if;
    raise exception 'Deposit has already been processed'
      using errcode = '23505';
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'Only pending deposits can be reviewed'
      using errcode = '22023';
  end if;

  if p_approve then
    select id, balance
    into v_wallet_id, v_balance
    from public.wallets
    where user_id = v_deposit.user_id
    for update;

    if not found then
      raise exception 'Wallet does not exist'
        using errcode = 'P0002';
    end if;
    if v_balance > 9999999999.99 - v_deposit.amount then
      raise exception 'Deposit would exceed the wallet balance limit'
        using errcode = '22003';
    end if;

    update public.wallets
    set balance = v_balance + v_deposit.amount
    where id = v_wallet_id;

    insert into public.wallet_transactions (
      wallet_id, transaction_type, amount, status, description, reference_id, idempotency_key
    )
    values (
      v_wallet_id,
      'ADD_MONEY',
      v_deposit.amount,
      'completed',
      'Wallet top-up · approved manual UPI deposit',
      v_deposit.id::text,
      v_deposit.id
    )
    on conflict (wallet_id, idempotency_key) do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then
      raise exception 'Deposit has already been credited'
        using errcode = '23505';
    end if;

    update public.deposits
    set status = 'APPROVED'
    where id = v_deposit.id;
  else
    update public.deposits
    set status = 'REJECTED'
    where id = v_deposit.id;
  end if;

  return v_deposit.id;
end;
$$;

revoke all on function public.process_manual_deposit(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.process_manual_deposit(uuid, boolean)
  to authenticated;
revoke all on function public.get_admin_dashboard_summary()
  from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_summary()
  to authenticated;

drop policy if exists "Users can view their own deposits" on public.deposits;
create policy "Users and admins can view deposits"
  on public.deposits for select to authenticated
  using (user_id = (select auth.uid()) or public.is_active_admin());

create policy "Active admins can read all wallets"
  on public.wallets for select to authenticated
  using (public.is_active_admin());

create policy "Active admins can read all wallet transactions"
  on public.wallet_transactions for select to authenticated
  using (public.is_active_admin());

create policy "Active admins can read admin payment methods"
  on public.payment_methods for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Authenticated users can view the active payment method"
  on public.payment_methods;
create policy "Authenticated users can view active payment methods"
  on public.payment_methods for select to authenticated
  using (is_active or public.is_active_admin());

revoke all on table public.games from public, anon, authenticated;
grant select on table public.games to authenticated;
drop policy if exists "Players and admins can read playable games" on public.games;
create policy "Players and admins can read playable games"
  on public.games for select to authenticated
  using (
    (is_active and is_open)
    or exists (
      select 1 from public.game_matches
      where game_matches.game_id = games.id
        and (game_matches.host_user_id = (select auth.uid()) or game_matches.opponent_user_id = (select auth.uid()))
    )
    or public.is_active_admin()
  );

create function public.admin_save_game(
  p_game_id uuid,
  p_slug text,
  p_name text,
  p_category text,
  p_minimum_entry numeric,
  p_maximum_entry numeric,
  p_is_active boolean,
  p_is_open boolean,
  p_image_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_game_id, gen_random_uuid());
  v_slug text := lower(btrim(p_slug));
  v_name text := nullif(btrim(p_name), '');
  v_category text := nullif(btrim(p_category), '');
begin
  perform public.require_active_admin();
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or v_name is null or length(v_name) > 120
    or v_category is null or length(v_category) > 80
    or p_minimum_entry is null or p_minimum_entry < 0 or p_minimum_entry > 4999999999.99
    or p_minimum_entry <> round(p_minimum_entry, 2)
    or (p_maximum_entry is not null and (
      p_maximum_entry < p_minimum_entry or p_maximum_entry > 4999999999.99
      or p_maximum_entry <> round(p_maximum_entry, 2)
    ))
    or p_is_active is null or p_is_open is null
    or (p_image_url is not null and length(p_image_url) > 2048) then
    raise exception 'Game details are invalid'
      using errcode = '22023';
  end if;

  insert into public.games (
    id, slug, name, category, minimum_entry, maximum_entry, is_active, is_open, image_url
  )
  values (
    v_id, v_slug, v_name, v_category, p_minimum_entry, p_maximum_entry, p_is_active, p_is_open, p_image_url
  )
  on conflict (id) do update set
    slug = excluded.slug,
    name = excluded.name,
    category = excluded.category,
    minimum_entry = excluded.minimum_entry,
    maximum_entry = excluded.maximum_entry,
    is_active = excluded.is_active,
    is_open = excluded.is_open,
    image_url = excluded.image_url;

  return v_id;
end;
$$;

create function public.admin_save_payment_method(
  p_method_id uuid,
  p_display_name text,
  p_provider text,
  p_upi_id text,
  p_payee_name text,
  p_qr_storage_path text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_method_id, gen_random_uuid());
  v_provider text := nullif(btrim(p_provider), '');
begin
  perform public.require_active_admin();
  if nullif(btrim(p_display_name), '') is null or length(btrim(p_display_name)) > 160
    or v_provider not in ('manual_upi', 'gateway')
    or p_is_active is null
    or (v_provider = 'manual_upi' and (
      nullif(btrim(p_upi_id), '') is null or nullif(btrim(p_payee_name), '') is null
    ))
    or (p_qr_storage_path is not null and not exists (
      select 1 from storage.objects
      where bucket_id = 'deposit_proofs' and name = p_qr_storage_path
    )) then
    raise exception 'Payment method details are invalid'
      using errcode = '22023';
  end if;

  if p_is_active then
    update public.payment_methods set is_active = false where is_active and id <> v_id;
  end if;

  insert into public.payment_methods (
    id, display_name, provider, upi_id, payee_name, qr_storage_path, is_active
  )
  values (
    v_id, btrim(p_display_name), v_provider, nullif(btrim(p_upi_id), ''),
    nullif(btrim(p_payee_name), ''), p_qr_storage_path, p_is_active
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    provider = excluded.provider,
    upi_id = excluded.upi_id,
    payee_name = excluded.payee_name,
    qr_storage_path = excluded.qr_storage_path,
    is_active = excluded.is_active;

  return v_id;
end;
$$;

create function public.admin_update_user(
  p_user_id uuid,
  p_active boolean default null,
  p_is_blocked boolean default null,
  p_user_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_user public.users%rowtype;
  v_admin_count integer;
begin
  perform public.require_active_admin();
  if p_user_id is null
    or (p_active is null and p_is_blocked is null and p_user_type is null)
    or (p_user_type is not null and p_user_type not in ('player', 'admin', 'moderator')) then
    raise exception 'User update is invalid'
      using errcode = '22023';
  end if;
  if p_user_id = v_actor_id then
    raise exception 'Administrators cannot change their own access or role'
      using errcode = '42501';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User does not exist'
      using errcode = 'P0002';
  end if;

  if v_user.user_type = 'admin'
    and (p_user_type = 'player' or p_user_type = 'moderator' or p_active = false or p_is_blocked = true) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('playnexa-admin-role-change')
    );
    select count(*) into v_admin_count
    from public.users
    where user_type = 'admin'
      and active
      and not is_blocked
      and id <> p_user_id;
    if v_admin_count = 0 then
      raise exception 'The last active administrator cannot be disabled, blocked, or demoted'
        using errcode = '42501';
    end if;
  end if;

  update public.users
  set active = coalesce(p_active, active),
      is_blocked = coalesce(p_is_blocked, is_blocked),
      user_type = coalesce(p_user_type, user_type)
  where id = p_user_id;

  return p_user_id;
end;
$$;

revoke all on function public.admin_save_game(uuid, text, text, text, numeric, numeric, boolean, boolean, text)
  from public, anon, authenticated;
revoke all on function public.admin_save_payment_method(uuid, text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_update_user(uuid, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.admin_save_game(uuid, text, text, text, numeric, numeric, boolean, boolean, text)
  to authenticated;
grant execute on function public.admin_save_payment_method(uuid, text, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.admin_update_user(uuid, boolean, boolean, text)
  to authenticated;

drop policy if exists "Active admins can upload app assets" on storage.objects;
create policy "Active admins can upload app assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('app_assets', 'games')
    and public.is_active_admin()
  );

drop policy if exists "Active admins can update app assets" on storage.objects;
create policy "Active admins can update app assets"
  on storage.objects for update to authenticated
  using (bucket_id in ('app_assets', 'games') and public.is_active_admin())
  with check (bucket_id in ('app_assets', 'games') and public.is_active_admin());

drop policy if exists "Active admins can delete app assets" on storage.objects;
create policy "Active admins can delete app assets"
  on storage.objects for delete to authenticated
  using (bucket_id in ('app_assets', 'games') and public.is_active_admin());

create policy "Active admins can read deposit proofs"
  on storage.objects for select to authenticated
  using (bucket_id = 'deposit_proofs' and public.is_active_admin());

create policy "Active admins can upload payment QR images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deposit_proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_admin()
  );

create policy "Active admins can read all support ticket images"
  on storage.objects for select to authenticated
  using (bucket_id = 'support_images' and public.is_active_admin());
