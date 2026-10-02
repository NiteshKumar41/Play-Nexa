create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  amount numeric(12, 2) not null
    check (amount > 0 and amount <= 9999999999.99),
  currency text not null default 'INR'
    check (currency = 'INR'),
  provider text not null
    check (length(btrim(provider)) > 0),
  provider_order_id text,
  provider_payment_id text,
  status text not null default 'CREATED'
    check (status in ('CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_orders_provider_order_unique
  on public.payment_orders (provider, provider_order_id)
  where provider_order_id is not null;

create unique index payment_orders_provider_payment_unique
  on public.payment_orders (provider, provider_payment_id)
  where provider_payment_id is not null;

create index payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);

create index payment_orders_status_created_idx
  on public.payment_orders (status, created_at desc)
  where status in ('CREATED', 'PENDING');

create trigger payment_orders_set_updated_at
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

alter table public.payment_orders enable row level security;
revoke all on table public.payment_orders from public, anon, authenticated;
grant select on table public.payment_orders to authenticated;
grant all on table public.payment_orders to service_role;

create policy "Users can read their own payment orders"
  on public.payment_orders for select to authenticated
  using ((select auth.uid()) = user_id);

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

create function public.process_verified_payment(
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
      'credit',
      v_order.amount,
      'completed',
      'Wallet top-up',
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
