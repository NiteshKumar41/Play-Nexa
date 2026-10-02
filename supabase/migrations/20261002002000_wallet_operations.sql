alter table public.wallet_transactions
  add column idempotency_key uuid default gen_random_uuid();

update public.wallet_transactions
set idempotency_key = gen_random_uuid()
where idempotency_key is null;

alter table public.wallet_transactions
  alter column idempotency_key set not null;

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
      'debit'
    ));

create unique index wallet_transactions_wallet_idempotency_unique
  on public.wallet_transactions (wallet_id, idempotency_key);

revoke all on table public.wallets from public, anon, authenticated;
revoke all on table public.wallet_transactions from public, anon, authenticated;
grant select on table public.wallets to authenticated;
grant select on table public.wallet_transactions to authenticated;

create or replace function public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_idempotency_key uuid,
  p_reference_id text default null,
  p_description text default null
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
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_existing public.wallet_transactions%rowtype;
  v_transaction_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_user_id is null then
    raise exception 'Wallet user is required'
      using errcode = '22004';
  end if;

  select user_type, active, is_blocked
  into v_actor_type, v_actor_active, v_actor_blocked
  from public.users
  where id = v_actor_id;

  if not found or not v_actor_active or v_actor_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;
  if v_actor_type <> 'admin' then
    raise exception 'Only administrators may credit wallets'
      using errcode = '42501';
  end if;

  select id, balance
  into v_wallet_id, v_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet does not exist'
      using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive and have at most two decimal places'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required'
      using errcode = '22004';
  end if;

  select *
  into v_existing
  from public.wallet_transactions
  where wallet_id = v_wallet_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.transaction_type = 'credit'
      and v_existing.amount = p_amount
      and v_existing.reference_id is not distinct from p_reference_id then
      return v_existing.id;
    end if;
    raise exception 'Idempotency key was already used for a different operation'
      using errcode = '23505';
  end if;

  update public.wallets
  set balance = v_balance + p_amount
  where id = v_wallet_id;

  insert into public.wallet_transactions (
    wallet_id, transaction_type, amount, status, description, reference_id, idempotency_key
  )
  values (
    v_wallet_id, 'credit', p_amount, 'completed', p_description, p_reference_id, p_idempotency_key
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_idempotency_key uuid,
  p_reference_id text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_active boolean;
  v_actor_blocked boolean;
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_existing public.wallet_transactions%rowtype;
  v_transaction_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_user_id is null or p_user_id <> v_actor_id then
    raise exception 'Users may debit only their own wallet'
      using errcode = '42501';
  end if;

  select active, is_blocked
  into v_actor_active, v_actor_blocked
  from public.users
  where id = v_actor_id;

  if not found or not v_actor_active or v_actor_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  select id, balance
  into v_wallet_id, v_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet does not exist'
      using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive and have at most two decimal places'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required'
      using errcode = '22004';
  end if;

  select *
  into v_existing
  from public.wallet_transactions
  where wallet_id = v_wallet_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.transaction_type = 'debit'
      and v_existing.amount = p_amount
      and v_existing.reference_id is not distinct from p_reference_id then
      return v_existing.id;
    end if;
    raise exception 'Idempotency key was already used for a different operation'
      using errcode = '23505';
  end if;

  if v_balance < p_amount then
    raise exception 'Insufficient wallet balance'
      using errcode = '22023';
  end if;

  update public.wallets
  set balance = v_balance - p_amount
  where id = v_wallet_id;

  insert into public.wallet_transactions (
    wallet_id, transaction_type, amount, status, description, reference_id, idempotency_key
  )
  values (
    v_wallet_id, 'debit', p_amount, 'completed', p_description, p_reference_id, p_idempotency_key
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.refund_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_idempotency_key uuid,
  p_reference_id text default null,
  p_description text default null
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
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_existing public.wallet_transactions%rowtype;
  v_transaction_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_user_id is null then
    raise exception 'Wallet user is required'
      using errcode = '22004';
  end if;

  select user_type, active, is_blocked
  into v_actor_type, v_actor_active, v_actor_blocked
  from public.users
  where id = v_actor_id;

  if not found or not v_actor_active or v_actor_blocked then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;
  if v_actor_type <> 'admin' then
    raise exception 'Only administrators may refund wallets'
      using errcode = '42501';
  end if;

  select id, balance
  into v_wallet_id, v_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet does not exist'
      using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive and have at most two decimal places'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required'
      using errcode = '22004';
  end if;

  select *
  into v_existing
  from public.wallet_transactions
  where wallet_id = v_wallet_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.transaction_type = 'refund'
      and v_existing.amount = p_amount
      and v_existing.reference_id is not distinct from p_reference_id then
      return v_existing.id;
    end if;
    raise exception 'Idempotency key was already used for a different operation'
      using errcode = '23505';
  end if;

  update public.wallets
  set balance = v_balance + p_amount
  where id = v_wallet_id;

  insert into public.wallet_transactions (
    wallet_id, transaction_type, amount, status, description, reference_id, idempotency_key
  )
  values (
    v_wallet_id, 'refund', p_amount, 'completed', p_description, p_reference_id, p_idempotency_key
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke all on function public.credit_wallet(uuid, numeric, uuid, text, text) from public, anon, authenticated;
revoke all on function public.debit_wallet(uuid, numeric, uuid, text, text) from public, anon, authenticated;
revoke all on function public.refund_wallet(uuid, numeric, uuid, text, text) from public, anon, authenticated;
grant execute on function public.credit_wallet(uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.debit_wallet(uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.refund_wallet(uuid, numeric, uuid, text, text) to authenticated;
