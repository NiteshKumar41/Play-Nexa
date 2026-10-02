-- Store instants as timestamptz. Derive business dates with
-- (timestamp AT TIME ZONE 'Asia/Kolkata') when business-date logic is added.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_lower_unique
  on public.users (lower(email))
  where email is not null;

create unique index users_phone_unique
  on public.users (phone)
  where phone is not null;

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('deposit', 'withdrawal', 'match_entry', 'match_winning', 'refund', 'adjustment')),
  amount numeric(12, 2) not null check (amount <> 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'cancelled')),
  description text,
  reference_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wallet_transactions_wallet_created_idx
  on public.wallet_transactions (wallet_id, created_at desc);

create index wallet_transactions_status_created_idx
  on public.wallet_transactions (status, created_at desc);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  minimum_entry numeric(12, 2) not null default 0 check (minimum_entry >= 0),
  maximum_entry numeric(12, 2) check (maximum_entry is null or maximum_entry >= minimum_entry),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_active_category_idx
  on public.games (category, name)
  where is_active;

create table public.game_matches (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete restrict,
  host_user_id uuid references public.users (id) on delete set null,
  opponent_user_id uuid references public.users (id) on delete set null,
  winner_user_id uuid references public.users (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'awaiting_result', 'disputed', 'completed', 'cancelled')),
  entry_amount numeric(12, 2) not null check (entry_amount >= 0),
  prize_pool numeric(12, 2) not null default 0 check (prize_pool >= 0),
  platform_fee numeric(12, 2) not null default 0 check (platform_fee >= 0),
  winner_amount numeric(12, 2) not null default 0 check (winner_amount >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_user_id is null or opponent_user_id is null or host_user_id <> opponent_user_id)
);

create index game_matches_game_status_created_idx
  on public.game_matches (game_id, status, created_at desc);

create index game_matches_host_created_idx
  on public.game_matches (host_user_id, created_at desc);

create index game_matches_opponent_created_idx
  on public.game_matches (opponent_user_id, created_at desc)
  where opponent_user_id is not null;

create index game_matches_winner_idx
  on public.game_matches (winner_user_id)
  where winner_user_id is not null;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  provider text,
  upi_id text,
  payee_name text,
  qr_storage_path text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_methods_active_idx
  on public.payment_methods (is_active)
  where is_active;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subject text not null,
  description text not null,
  category text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);

create index support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

create trigger wallet_transactions_set_updated_at
  before update on public.wallet_transactions
  for each row execute function public.set_updated_at();

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create trigger game_matches_set_updated_at
  before update on public.game_matches
  for each row execute function public.set_updated_at();

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create function public.create_wallet_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger users_create_wallet
  after insert on public.users
  for each row execute function public.create_wallet_for_user();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, phone, full_name)
  values (
    new.id,
    new.email,
    new.phone,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.games enable row level security;
alter table public.game_matches enable row level security;
alter table public.payment_methods enable row level security;
alter table public.support_tickets enable row level security;

create policy "Users can read their own profile"
  on public.users for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.users for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their own wallet"
  on public.wallets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own wallet transactions"
  on public.wallet_transactions for select to authenticated
  using (
    exists (
      select 1
      from public.wallets
      where wallets.id = wallet_transactions.wallet_id
        and wallets.user_id = (select auth.uid())
    )
  );

create policy "Authenticated users can read active games"
  on public.games for select to authenticated
  using (is_active);

create policy "Participants can read their matches and players can see open matches"
  on public.game_matches for select to authenticated
  using (
    status = 'open'
    or host_user_id = (select auth.uid())
    or opponent_user_id = (select auth.uid())
  );

create policy "Users can read their own support tickets"
  on public.support_tickets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create support tickets for themselves"
  on public.support_tickets for insert to authenticated
  with check ((select auth.uid()) = user_id);
