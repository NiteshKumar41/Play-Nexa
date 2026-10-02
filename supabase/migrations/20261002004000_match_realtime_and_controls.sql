alter table public.game_matches
  add column room_code text,
  drop constraint game_matches_status_check,
  add constraint game_matches_status_check
    check (status in (
      'open',
      'active',
      'in_progress',
      'awaiting_result',
      'disputed',
      'under_review',
      'completed',
      'settled',
      'refunded',
      'claim_rejected',
      'cancelled'
    ));

revoke all on table public.game_matches from public, anon, authenticated;
grant select on table public.game_matches to authenticated;

drop policy if exists "Participants can read their matches and players can see open matches"
  on public.game_matches;
create policy "Participants can read their matches and players can see open matches"
  on public.game_matches for select to authenticated
  using (
    status in ('open', 'active')
    or host_user_id = (select auth.uid())
    or opponent_user_id = (select auth.uid())
  );

alter table public.game_matches replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_matches'
  ) then
    alter publication supabase_realtime add table public.game_matches;
  end if;
end;
$$;

create policy "Authenticated users can receive game lobby match changes"
  on realtime.messages for select to authenticated
  using (
    exists (
      select 1
      from public.games
      where games.id::text = split_part((select realtime.topic()), ':', 2)
    )
    and (select realtime.topic()) like 'game-lobby:%'
  );

create function public.broadcast_match_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'match_id', new.id,
      'game_id', new.game_id,
      'status', new.status
    ),
    tg_op,
    'game-lobby:' || new.game_id::text,
    true
  );
  return new;
end;
$$;

create trigger game_matches_broadcast_changes
  after insert or update on public.game_matches
  for each row execute function public.broadcast_match_change();

create function public.submit_room_code(
  p_match_id uuid,
  p_room_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.game_matches%rowtype;
  v_user_active boolean;
  v_user_blocked boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_room_code is null or btrim(p_room_code) = '' or length(btrim(p_room_code)) > 64 then
    raise exception 'Room code must contain between 1 and 64 characters'
      using errcode = '22023';
  end if;

  select active, is_blocked
  into v_user_active, v_user_blocked
  from public.users
  where id = v_user_id;

  if not found or not v_user_active or v_user_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found
    or v_match.host_user_id is distinct from v_user_id
    or v_match.opponent_user_id is null
    or v_match.status <> 'in_progress'
    or nullif(btrim(v_match.room_code), '') is not null then
    raise exception 'Only the creator may submit a room code after an opponent joins and before one is set'
      using errcode = '42501';
  end if;

  update public.game_matches
  set room_code = btrim(p_room_code)
  where id = p_match_id;
end;
$$;

create function public.leave_match(
  p_match_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.game_matches%rowtype;
  v_user_active boolean;
  v_user_blocked boolean;
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;

  select active, is_blocked
  into v_user_active, v_user_blocked
  from public.users
  where id = v_user_id;

  if not found or not v_user_active or v_user_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found
    or v_match.opponent_user_id is distinct from v_user_id
    or v_match.status <> 'in_progress'
    or nullif(btrim(v_match.room_code), '') is not null then
    raise exception 'Only the joined opponent may leave before a room code is set'
      using errcode = '42501';
  end if;

  select id, balance
  into v_wallet_id, v_balance
  from public.wallets
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet does not exist'
      using errcode = 'P0002';
  end if;
  if v_balance > 9999999999.99 - v_match.entry_amount then
    raise exception 'Refund would exceed the wallet balance limit'
      using errcode = '22003';
  end if;

  update public.wallets
  set balance = v_balance + v_match.entry_amount
  where id = v_wallet_id;

  insert into public.wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    description,
    reference_id,
    idempotency_key
  )
  values (
    v_wallet_id,
    'refund',
    v_match.entry_amount,
    'completed',
    'Refund for leaving match before room code submission',
    p_match_id::text,
    gen_random_uuid()
  )
  returning id into v_transaction_id;

  update public.game_matches
  set status = 'cancelled'
  where id = p_match_id;

  return v_transaction_id;
end;
$$;

create function public.cancel_match(
  p_match_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.game_matches%rowtype;
  v_user_active boolean;
  v_user_blocked boolean;
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;

  select active, is_blocked
  into v_user_active, v_user_blocked
  from public.users
  where id = v_user_id;

  if not found or not v_user_active or v_user_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found
    or v_match.host_user_id is distinct from v_user_id
    or v_match.opponent_user_id is not null
    or v_match.status <> 'active'
    or nullif(btrim(v_match.room_code), '') is not null then
    raise exception 'Only the creator may cancel an unjoined match before a room code is set'
      using errcode = '42501';
  end if;

  select id, balance
  into v_wallet_id, v_balance
  from public.wallets
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wallet does not exist'
      using errcode = 'P0002';
  end if;
  if v_balance > 9999999999.99 - v_match.entry_amount then
    raise exception 'Refund would exceed the wallet balance limit'
      using errcode = '22003';
  end if;

  update public.wallets
  set balance = v_balance + v_match.entry_amount
  where id = v_wallet_id;

  insert into public.wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    description,
    reference_id,
    idempotency_key
  )
  values (
    v_wallet_id,
    'refund',
    v_match.entry_amount,
    'completed',
    'Refund for creator-cancelled match',
    p_match_id::text,
    gen_random_uuid()
  )
  returning id into v_transaction_id;

  update public.game_matches
  set status = 'cancelled'
  where id = p_match_id;

  return v_transaction_id;
end;
$$;

revoke all on function public.submit_room_code(uuid, text) from public, anon, authenticated;
revoke all on function public.leave_match(uuid) from public, anon, authenticated;
revoke all on function public.cancel_match(uuid) from public, anon, authenticated;
grant execute on function public.submit_room_code(uuid, text) to authenticated;
grant execute on function public.leave_match(uuid) to authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;
