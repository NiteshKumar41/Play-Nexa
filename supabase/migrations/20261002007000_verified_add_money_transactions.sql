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
      'ADD_MONEY'
    ));

create or replace function public.process_verified_payment(
  p_provider text,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_status text,
  p_amount numeric,
  p_currency text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.payment_orders%rowtype;
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_transaction_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Trusted payment processing is restricted to the server'
      using errcode = '42501';
  end if;

  if p_provider is null
    or p_provider_order_id is null
    or p_status is null
    or p_status not in ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')
    or p_amount is null
    or p_currency is null then
    raise exception 'Payment event is incomplete'
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.payment_orders
  where provider = p_provider
    and provider_order_id = p_provider_order_id
  for update;

  if not found then
    raise exception 'Payment order does not exist'
      using errcode = 'P0002';
  end if;

  if v_order.amount <> p_amount or v_order.currency <> p_currency then
    raise exception 'Verified payment amount or currency does not match the order'
      using errcode = '22023';
  end if;

  if v_order.status = 'SUCCESS' then
    if p_status = 'SUCCESS'
      and v_order.provider_payment_id is not distinct from p_provider_payment_id then
      return v_order.id;
    end if;
    raise exception 'Payment order has already been successfully processed'
      using errcode = '23505';
  end if;

  if v_order.status in ('FAILED', 'CANCELLED') and p_status <> 'SUCCESS' then
    return v_order.id;
  end if;

  if p_status = 'SUCCESS' then
    if p_provider_payment_id is null or length(btrim(p_provider_payment_id)) = 0 then
      raise exception 'Successful payment requires a provider payment ID'
        using errcode = '22023';
    end if;

    select id, balance
    into v_wallet_id, v_balance
    from public.wallets
    where user_id = v_order.user_id
    for update;

    if not found then
      raise exception 'Wallet does not exist'
        using errcode = 'P0002';
    end if;
    if v_balance > 9999999999.99 - v_order.amount then
      raise exception 'Payment would exceed the wallet balance limit'
        using errcode = '22003';
    end if;

    update public.wallets
    set balance = v_balance + v_order.amount
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
      'ADD_MONEY',
      v_order.amount,
      'completed',
      'Wallet top-up · verified payment',
      v_order.id::text,
      v_order.id
    )
    on conflict (wallet_id, idempotency_key) do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then
      raise exception 'Payment has already been credited'
        using errcode = '23505';
    end if;
  end if;

  update public.payment_orders
  set
    status = p_status,
    provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id),
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb)
  where id = v_order.id;

  return v_order.id;
end;
$$;

revoke all on function public.process_verified_payment(text, text, text, text, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_verified_payment(text, text, text, text, numeric, text, jsonb)
  to service_role;
