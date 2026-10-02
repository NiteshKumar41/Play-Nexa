alter table public.games
  add column is_open boolean not null default true,
  add column image_url text;

alter table public.game_matches
  drop constraint game_matches_status_check,
  add constraint game_matches_status_check
    check (status in ('open', 'active', 'in_progress', 'awaiting_result', 'disputed', 'completed', 'cancelled')),
  add constraint game_matches_amount_range_check
    check (
      entry_amount <= 4999999999.99
      and prize_pool <= 9999999999.99
      and platform_fee <= 9999999999.99
      and winner_amount <= 9999999999.99
    );

alter table public.wallet_transactions
  drop constraint wallet_transactions_transaction_type_check,
  add constraint wallet_transactions_transaction_type_check
    check (transaction_type in (
      'deposit',
      'withdrawal',
      'match_entry',
      'match_winning',
      'refund',
      'adjustment',
      'credit',
      'debit',
      'GAME_CREATE',
      'GAME_JOIN'
    ));

create index games_open_active_idx
  on public.games (name)
  where is_active and is_open;

create index game_matches_open_game_created_idx
  on public.game_matches (game_id, created_at)
  where status = 'active';

drop policy if exists "Authenticated users can read active games" on public.games;
create policy "Authenticated users can read playable games"
  on public.games for select to authenticated
  using (
    (is_active and is_open)
    or exists (
      select 1
      from public.game_matches
      where game_matches.game_id = games.id
        and (
          game_matches.host_user_id = (select auth.uid())
          or game_matches.opponent_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Participants can read their matches and players can see open matches"
  on public.game_matches;
create policy "Participants can read their matches and players can see open matches"
  on public.game_matches for select to authenticated
  using (
    status in ('open', 'active')
    or host_user_id = (select auth.uid())
    or opponent_user_id = (select auth.uid())
  );

create or replace function public.create_match(
  p_game_id uuid,
  p_entry_amount numeric,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_active boolean;
  v_user_blocked boolean;
  v_game_active boolean;
  v_game_open boolean;
  v_minimum_entry numeric(12, 2);
  v_maximum_entry numeric(12, 2);
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_existing public.wallet_transactions%rowtype;
  v_existing_game_id uuid;
  v_match_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required'
      using errcode = '22004';
  end if;
  select active, is_blocked
  into v_user_active, v_user_blocked
  from public.users
  where id = v_user_id;

  if not found or not v_user_active or v_user_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  select is_active, is_open, minimum_entry, maximum_entry
  into v_game_active, v_game_open, v_minimum_entry, v_maximum_entry
  from public.games
  where id = p_game_id
  for share;

  if not found or not v_game_active or not v_game_open then
    raise exception 'Game is not currently open for matchmaking'
      using errcode = '22023';
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

  if p_entry_amount is null
    or p_entry_amount <= 0
    or p_entry_amount > 4999999999.99
    or p_entry_amount <> round(p_entry_amount, 2) then
    raise exception 'Entry amount must be positive, fit the money range, and have at most two decimal places'
      using errcode = '22023';
  end if;
  if p_entry_amount < v_minimum_entry
    or (v_maximum_entry is not null and p_entry_amount > v_maximum_entry) then
    raise exception 'Entry amount is outside the allowed range for this game'
      using errcode = '22023';
  end if;
  if p_entry_amount < v_minimum_entry
    or (v_maximum_entry is not null and p_entry_amount > v_maximum_entry) then
    raise exception 'Entry amount is outside the allowed range for this game'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.wallet_transactions
  where wallet_id = v_wallet_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.transaction_type = 'GAME_CREATE'
      and v_existing.reference_id is not null then
      select game_id
      into v_existing_game_id
      from public.game_matches
      where id = v_existing.reference_id::uuid
        and host_user_id = v_user_id;
    end if;

    if v_existing.transaction_type = 'GAME_CREATE'
      and v_existing.amount = p_entry_amount
      and v_existing_game_id = p_game_id then
      return v_existing.reference_id::uuid;
    end if;
    raise exception 'Idempotency key was already used for a different operation'
      using errcode = '23505';
  end if;

  if v_balance < p_entry_amount then
    raise exception 'Insufficient wallet balance'
      using errcode = '22023';
  end if;

  update public.wallets
  set balance = v_balance - p_entry_amount
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
    'GAME_CREATE',
    p_entry_amount,
    'completed',
    'Match creation entry fee',
    v_match_id::text,
    p_idempotency_key
  );

  insert into public.game_matches (
    id,
    game_id,
    host_user_id,
    status,
    entry_amount,
    prize_pool,
    platform_fee,
    winner_amount
  )
  values (
    v_match_id,
    p_game_id,
    v_user_id,
    'active',
    p_entry_amount,
    0,
    0,
    0
  );

  return v_match_id;
end;
$$;

create or replace function public.join_match(
  p_match_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_active boolean;
  v_user_blocked boolean;
  v_host_user_id uuid;
  v_game_id uuid;
  v_match_status text;
  v_game_active boolean;
  v_game_open boolean;
  v_entry_amount numeric(12, 2);
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_gross_pool numeric(12, 2);
  v_platform_fee numeric(12, 2);
  v_winner_amount numeric(12, 2);
  v_existing public.wallet_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_match_id is null or p_idempotency_key is null then
    raise exception 'Match and idempotency key are required'
      using errcode = '22004';
  end if;

  select host_user_id, entry_amount, game_id, status
  into v_host_user_id, v_entry_amount, v_game_id, v_match_status
  from public.game_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match is not active or no longer available'
      using errcode = 'P0002';
  end if;
  if v_host_user_id = v_user_id then
    raise exception 'Match creators cannot join their own match'
      using errcode = '42501';
  end if;

  select active, is_blocked
  into v_user_active, v_user_blocked
  from public.users
  where id = v_user_id;

  if not found or not v_user_active or v_user_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  select is_active, is_open
  into v_game_active, v_game_open
  from public.games
  where id = v_game_id
  for share;

  if not found or not v_game_active or not v_game_open then
    raise exception 'Game is no longer open for matchmaking'
      using errcode = '22023';
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

  select *
  into v_existing
  from public.wallet_transactions
  where wallet_id = v_wallet_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.transaction_type = 'GAME_JOIN'
      and v_existing.amount = v_entry_amount
      and v_existing.reference_id = p_match_id::text then
      return p_match_id;
    end if;
    raise exception 'Idempotency key was already used for a different operation'
      using errcode = '23505';
  end if;

  if v_match_status <> 'active' then
    raise exception 'Match is not active or no longer available'
      using errcode = 'P0002';
  end if;

  if v_entry_amount <= 0
    or v_entry_amount > 4999999999.99
    or v_entry_amount <> round(v_entry_amount, 2) then
    raise exception 'Match entry amount is invalid'
      using errcode = '22023';
  end if;

  if v_balance < v_entry_amount then
    raise exception 'Insufficient wallet balance'
      using errcode = '22023';
  end if;

  v_gross_pool := v_entry_amount * 2;
  v_platform_fee := round(
    v_gross_pool * case when v_entry_amount < 100 then 0.20 else 0.03 end,
    2
  );
  v_winner_amount := v_gross_pool - v_platform_fee;

  update public.wallets
  set balance = v_balance - v_entry_amount
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
    'GAME_JOIN',
    v_entry_amount,
    'completed',
    'Match joining entry fee',
    p_match_id::text,
    p_idempotency_key
  );

  update public.game_matches
  set
    opponent_user_id = v_user_id,
    status = 'in_progress',
    prize_pool = v_gross_pool,
    platform_fee = v_platform_fee,
    winner_amount = v_winner_amount,
    started_at = now()
  where id = p_match_id;

  return p_match_id;
end;
$$;

revoke all on function public.create_match(uuid, numeric, uuid) from public, anon, authenticated;
revoke all on function public.join_match(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_match(uuid, numeric, uuid) to authenticated;
grant execute on function public.join_match(uuid, uuid) to authenticated;
