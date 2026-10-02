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
      'GAME_JOIN',
      'ADD_MONEY',
      'WITHDRAW'
    )),
  drop constraint wallet_transactions_status_check,
  add constraint wallet_transactions_status_check
    check (status in (
      'pending',
      'completed',
      'failed',
      'cancelled',
      'INITIATED',
      'SUCCESS',
      'FAILED'
    ));

alter table public.wallet_transactions
  add column payout_upi_id text,
  add column payout_utr text,
  add column payout_transaction_id text,
  add column withdrawal_refund_id uuid,
  add constraint wallet_transactions_withdrawal_refund_type_check
    check (withdrawal_refund_id is null or transaction_type = 'refund');

create unique index wallet_transactions_payout_utr_unique
  on public.wallet_transactions (lower(btrim(payout_utr)))
  where payout_utr is not null;

create unique index wallet_transactions_payout_transaction_id_unique
  on public.wallet_transactions (lower(btrim(payout_transaction_id)))
  where payout_transaction_id is not null;

create unique index wallet_transactions_withdrawal_refund_unique
  on public.wallet_transactions (withdrawal_refund_id)
  where withdrawal_refund_id is not null;

create or replace function public.create_withdrawal(
  p_amount numeric,
  p_upi_id text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_active boolean;
  v_blocked boolean;
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_existing public.wallet_transactions%rowtype;
  v_withdrawal_id uuid;
  v_clean_upi text := nullif(btrim(p_upi_id), '');
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;

  select active, is_blocked
  into v_active, v_blocked
  from public.users
  where id = v_user_id;

  if not found or not v_active or v_blocked then
    raise exception 'Active, unblocked account authorization is required'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 9999999999.99
    or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be positive and have at most two decimal places'
      using errcode = '22023';
  end if;
  if v_clean_upi is null or length(v_clean_upi) > 255
    or v_clean_upi !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,254}@[A-Za-z0-9][A-Za-z0-9.-]{0,63}$' then
    raise exception 'A valid UPI ID is required'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'Idempotency key is required'
      using errcode = '22004';
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
    if v_existing.transaction_type = 'WITHDRAW'
      and v_existing.amount = p_amount
      and v_existing.payout_upi_id = v_clean_upi then
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
    wallet_id,
    transaction_type,
    amount,
    status,
    description,
    reference_id,
    idempotency_key,
    payout_upi_id
  )
  values (
    v_wallet_id,
    'WITHDRAW',
    p_amount,
    'INITIATED',
    'UPI withdrawal request',
    null,
    p_idempotency_key,
    v_clean_upi
  )
  returning id into v_withdrawal_id;

  return v_withdrawal_id;
end;
$$;

create or replace function public.approve_withdrawal(
  p_withdrawal_id uuid,
  p_utr text,
  p_payout_transaction_id text
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
  v_withdrawal public.wallet_transactions%rowtype;
  v_utr text := nullif(btrim(p_utr), '');
  v_payout_transaction_id text := nullif(btrim(p_payout_transaction_id), '');
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
  if p_withdrawal_id is null then
    raise exception 'Withdrawal ID is required'
      using errcode = '22004';
  end if;
  if v_utr is null or length(v_utr) > 255
    or v_payout_transaction_id is null or length(v_payout_transaction_id) > 255 then
    raise exception 'UTR and payout transaction ID are required'
      using errcode = '22023';
  end if;

  select *
  into v_withdrawal
  from public.wallet_transactions
  where id = p_withdrawal_id
  for update;

  if not found or v_withdrawal.transaction_type <> 'WITHDRAW' then
    raise exception 'Withdrawal does not exist'
      using errcode = 'P0002';
  end if;

  if v_withdrawal.status = 'SUCCESS' then
    if v_withdrawal.payout_utr = v_utr
      and v_withdrawal.payout_transaction_id = v_payout_transaction_id then
      return v_withdrawal.id;
    end if;
    raise exception 'Withdrawal has already been approved with different payout details'
      using errcode = '23505';
  end if;
  if v_withdrawal.status <> 'INITIATED' then
    raise exception 'Only initiated withdrawals can be approved'
      using errcode = '22023';
  end if;

  update public.wallet_transactions
  set
    status = 'SUCCESS',
    payout_utr = v_utr,
    payout_transaction_id = v_payout_transaction_id,
    updated_at = now()
  where id = v_withdrawal.id;

  return v_withdrawal.id;
end;
$$;

create or replace function public.reject_withdrawal(
  p_withdrawal_id uuid
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
  v_withdrawal public.wallet_transactions%rowtype;
  v_wallet_balance numeric(12, 2);
  v_refund_id uuid;
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
  if p_withdrawal_id is null then
    raise exception 'Withdrawal ID is required'
      using errcode = '22004';
  end if;

  select *
  into v_withdrawal
  from public.wallet_transactions
  where id = p_withdrawal_id
  for update;

  if not found or v_withdrawal.transaction_type <> 'WITHDRAW' then
    raise exception 'Withdrawal does not exist'
      using errcode = 'P0002';
  end if;

  if v_withdrawal.status = 'FAILED' then
    select id
    into v_refund_id
    from public.wallet_transactions
    where withdrawal_refund_id = v_withdrawal.id;

    if not found then
      raise exception 'Failed withdrawal is missing its refund transaction'
        using errcode = 'XX000';
    end if;
    return v_refund_id;
  end if;
  if v_withdrawal.status <> 'INITIATED' then
    raise exception 'Only initiated withdrawals can be rejected'
      using errcode = '22023';
  end if;

  select balance
  into v_wallet_balance
  from public.wallets
  where id = v_withdrawal.wallet_id
  for update;

  if not found then
    raise exception 'Wallet does not exist'
      using errcode = 'P0002';
  end if;
  if v_wallet_balance > 9999999999.99 - v_withdrawal.amount then
    raise exception 'Refund would exceed the wallet balance limit'
      using errcode = '22003';
  end if;

  update public.wallets
  set balance = v_wallet_balance + v_withdrawal.amount
  where id = v_withdrawal.wallet_id;

  insert into public.wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    status,
    description,
    reference_id,
    idempotency_key,
    withdrawal_refund_id
  )
  values (
    v_withdrawal.wallet_id,
    'refund',
    v_withdrawal.amount,
    'SUCCESS',
    'Refund for rejected UPI withdrawal',
    v_withdrawal.id::text,
    gen_random_uuid(),
    v_withdrawal.id
  )
  returning id into v_refund_id;

  update public.wallet_transactions
  set status = 'FAILED', updated_at = now()
  where id = v_withdrawal.id;

  return v_refund_id;
end;
$$;

revoke all on function public.create_withdrawal(numeric, text, uuid)
  from public, anon, authenticated;
revoke all on function public.approve_withdrawal(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.reject_withdrawal(uuid)
  from public, anon, authenticated;

grant execute on function public.create_withdrawal(numeric, text, uuid)
  to authenticated;
grant execute on function public.approve_withdrawal(uuid, text, text)
  to authenticated;
grant execute on function public.reject_withdrawal(uuid)
  to authenticated;
