alter table public.game_matches
  add column winner_claimed_by uuid references public.users (id) on delete set null,
  add column winner_claim_status text
    check (winner_claim_status is null or winner_claim_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column winner_claim_path text,
  add column dispute_reason text,
  add column dispute_screenshot_path text,
  add column settled_at timestamptz,
  add constraint game_matches_winner_claim_details_check
    check (
      (winner_claimed_by is null and winner_claim_status is null and winner_claim_path is null)
      or (winner_claimed_by is not null and winner_claim_status is not null and winner_claim_path is not null)
    ),
  add constraint game_matches_dispute_details_check
    check (
      (dispute_reason is null and dispute_screenshot_path is null)
      or (dispute_reason is not null and dispute_screenshot_path is not null)
    );

create index game_matches_settlement_queue_idx
  on public.game_matches (status, created_at)
  where status in ('completed', 'disputed', 'under_review');

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
      'WITHDRAW',
      'GAME_WIN',
      'GAME_REFUND'
    ));

create unique index wallet_transactions_game_settlement_unique
  on public.wallet_transactions (wallet_id, reference_id)
  where transaction_type in ('GAME_WIN', 'GAME_REFUND');

revoke all on table public.game_matches from public, anon, authenticated;
grant select on table public.game_matches to authenticated;

drop policy if exists "Participants can read their matches and players can see open matches"
  on public.game_matches;
create policy "Participants and admins can read matches"
  on public.game_matches for select to authenticated
  using (
    status in ('open', 'active')
    or host_user_id = (select auth.uid())
    or opponent_user_id = (select auth.uid())
    or exists (
      select 1
      from public.users
      where users.id = (select auth.uid())
        and users.user_type = 'admin'
        and users.active
        and not users.is_blocked
    )
  );

drop policy if exists "Authenticated users can read playable games" on public.games;
create policy "Players and admins can read playable games"
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
    or exists (
      select 1
      from public.users
      where users.id = (select auth.uid())
        and users.user_type = 'admin'
        and users.active
        and not users.is_blocked
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('game_winners', 'game_winners', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('game_disputes', 'game_disputes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Match participants can upload their own winner evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'game_winners'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.game_matches
      where game_matches.id::text = (storage.foldername(name))[2]
        and (
          game_matches.host_user_id = (select auth.uid())
          or game_matches.opponent_user_id = (select auth.uid())
        )
    )
  );

create policy "Participants and admins can read winner evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'game_winners'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.game_matches
        where game_matches.id::text = (storage.foldername(name))[2]
          and (
            game_matches.host_user_id = (select auth.uid())
            or game_matches.opponent_user_id = (select auth.uid())
          )
      )
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

create policy "Owners can remove unsubmitted winner evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'game_winners'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.game_matches
      where game_matches.winner_claim_path = storage.objects.name
    )
  );

create policy "Match participants can upload their own dispute evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'game_disputes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.game_matches
      where game_matches.id::text = (storage.foldername(name))[2]
        and (
          game_matches.host_user_id = (select auth.uid())
          or game_matches.opponent_user_id = (select auth.uid())
        )
    )
  );

create policy "Participants and admins can read dispute evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'game_disputes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.game_matches
        where game_matches.id::text = (storage.foldername(name))[2]
          and (
            game_matches.host_user_id = (select auth.uid())
            or game_matches.opponent_user_id = (select auth.uid())
          )
      )
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

create policy "Owners can remove unsubmitted dispute evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'game_disputes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.game_matches
      where game_matches.dispute_screenshot_path = storage.objects.name
    )
  );

create function public.submit_winner_claim(
  p_match_id uuid,
  p_screenshot_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.game_matches%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_match_id is null or p_screenshot_path is null
    or (storage.foldername(p_screenshot_path))[1] <> v_user_id::text
    or (storage.foldername(p_screenshot_path))[2] <> p_match_id::text then
    raise exception 'A valid winner screenshot for this match is required'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'game_winners' and name = p_screenshot_path
  ) then
    raise exception 'Winner screenshot was not uploaded'
      using errcode = '22023';
  end if;

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found
    or (
      v_user_id is distinct from v_match.host_user_id
      and v_user_id is distinct from v_match.opponent_user_id
    )
    or v_match.opponent_user_id is null
    or v_match.status <> 'in_progress'
    or v_match.winner_claim_status is not null then
    raise exception 'A winner claim is not allowed for this match'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.users
    where id = v_user_id and active and not is_blocked
  ) then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  update public.game_matches
  set
    winner_claimed_by = v_user_id,
    winner_claim_status = 'PENDING',
    winner_claim_path = p_screenshot_path,
    status = 'completed',
    finished_at = now()
  where id = p_match_id;

  return p_match_id;
end;
$$;

create function public.submit_match_dispute(
  p_match_id uuid,
  p_reason text,
  p_screenshot_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.game_matches%rowtype;
  v_clean_reason text := nullif(btrim(p_reason), '');
begin
  if v_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;
  if p_match_id is null
    or v_clean_reason is null
    or length(v_clean_reason) < 10
    or length(v_clean_reason) > 2000
    or p_screenshot_path is null
    or (storage.foldername(p_screenshot_path))[1] <> v_user_id::text
    or (storage.foldername(p_screenshot_path))[2] <> p_match_id::text then
    raise exception 'Dispute reason and screenshot are required'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'game_disputes' and name = p_screenshot_path
  ) then
    raise exception 'Dispute screenshot was not uploaded'
      using errcode = '22023';
  end if;

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found
    or (
      v_user_id is distinct from v_match.host_user_id
      and v_user_id is distinct from v_match.opponent_user_id
    )
    or v_match.opponent_user_id is null
    or v_match.status not in ('in_progress', 'completed')
    or v_match.dispute_reason is not null then
    raise exception 'A dispute is not allowed for this match'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.users
    where id = v_user_id and active and not is_blocked
  ) then
    raise exception 'Active account authorization is required'
      using errcode = '42501';
  end if;

  update public.game_matches
  set
    dispute_reason = v_clean_reason,
    dispute_screenshot_path = p_screenshot_path,
    status = 'disputed'
  where id = p_match_id;

  return p_match_id;
end;
$$;

create function public.declare_match_winner(
  p_match_id uuid,
  p_winner_user_id uuid
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
  v_match public.game_matches%rowtype;
  v_wallet_id uuid;
  v_balance numeric(12, 2);
  v_transaction_id uuid;
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

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match does not exist'
      using errcode = 'P0002';
  end if;
  if v_match.status = 'settled' then
    if v_match.winner_user_id = p_winner_user_id then
      return v_match.id;
    end if;
    raise exception 'Match has already been settled'
      using errcode = '23505';
  end if;
  if v_match.status not in ('completed', 'disputed')
    or v_match.winner_claim_status is distinct from 'PENDING'
    or p_winner_user_id is null
    or (
      p_winner_user_id is distinct from v_match.host_user_id
      and p_winner_user_id is distinct from v_match.opponent_user_id
    ) then
    raise exception 'Match has no pending claim eligible for winner settlement'
      using errcode = '22023';
  end if;

  select id, balance
  into v_wallet_id, v_balance
  from public.wallets
  where user_id = p_winner_user_id
  for update;

  if not found then
    raise exception 'Winner wallet does not exist'
      using errcode = 'P0002';
  end if;
  if v_balance > 9999999999.99 - v_match.winner_amount then
    raise exception 'Winner credit would exceed the wallet balance limit'
      using errcode = '22003';
  end if;

  update public.wallets
  set balance = v_balance + v_match.winner_amount
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
    'GAME_WIN',
    v_match.winner_amount,
    'completed',
    'Match winner prize',
    v_match.id::text,
    gen_random_uuid()
  )
  returning id into v_transaction_id;

  update public.game_matches
  set
    winner_user_id = p_winner_user_id,
    winner_claim_status = 'APPROVED',
    status = 'settled',
    settled_at = now()
  where id = v_match.id;

  return v_match.id;
end;
$$;

create function public.refund_match_players(
  p_match_id uuid
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
  v_match public.game_matches%rowtype;
  v_wallet record;
  v_wallet_count integer := 0;
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

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match does not exist'
      using errcode = 'P0002';
  end if;
  if v_match.status = 'cancelled' then
    if (
      select count(*)
      from public.wallet_transactions
      where reference_id = v_match.id::text
        and transaction_type = 'GAME_REFUND'
    ) = 2 then
      return v_match.id;
    end if;
    raise exception 'Match is cancelled without a completed refund settlement'
      using errcode = 'XX000';
  end if;
  if v_match.status not in ('completed', 'disputed')
    or v_match.opponent_user_id is null
    or v_match.host_user_id is null then
    raise exception 'Match is not eligible for a two-player refund'
      using errcode = '22023';
  end if;

  perform wallets.id
  from public.wallets
  where wallets.user_id in (v_match.host_user_id, v_match.opponent_user_id)
  order by wallets.user_id
  for update;

  select count(*)
  into v_wallet_count
  from public.wallets
  where wallets.user_id in (v_match.host_user_id, v_match.opponent_user_id);

  if v_wallet_count <> 2 then
    raise exception 'Both player wallets must exist'
      using errcode = 'P0002';
  end if;

  for v_wallet in
    select wallets.id, wallets.user_id, wallets.balance
    from public.wallets
    where wallets.user_id in (v_match.host_user_id, v_match.opponent_user_id)
    order by wallets.user_id
  loop
    if v_wallet.balance > 9999999999.99 - v_match.entry_amount then
      raise exception 'Refund would exceed a player wallet balance limit'
        using errcode = '22003';
    end if;

    update public.wallets
    set balance = v_wallet.balance + v_match.entry_amount
    where id = v_wallet.id;

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
      v_wallet.id,
      'GAME_REFUND',
      v_match.entry_amount,
      'completed',
      'Refund for match settlement',
      v_match.id::text,
      gen_random_uuid()
    );
  end loop;

  update public.game_matches
  set
    winner_claim_status = case
      when winner_claim_status = 'PENDING' then 'REJECTED'
      else winner_claim_status
    end,
    status = 'cancelled',
    settled_at = now()
  where id = v_match.id;

  return v_match.id;
end;
$$;

create function public.reject_match_winner_claim(
  p_match_id uuid
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
  v_match public.game_matches%rowtype;
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

  select *
  into v_match
  from public.game_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match does not exist'
      using errcode = 'P0002';
  end if;
  if v_match.winner_claim_status = 'REJECTED'
    and v_match.status = 'claim_rejected' then
    return v_match.id;
  end if;
  if v_match.status not in ('completed', 'disputed')
    or v_match.winner_claim_status is distinct from 'PENDING' then
    raise exception 'Match has no pending winner claim'
      using errcode = '22023';
  end if;

  update public.game_matches
  set
    winner_claim_status = 'REJECTED',
    status = 'claim_rejected'
  where id = v_match.id;

  return v_match.id;
end;
$$;

revoke all on function public.submit_winner_claim(uuid, text)
  from public, anon, authenticated;
revoke all on function public.submit_match_dispute(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.declare_match_winner(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.refund_match_players(uuid)
  from public, anon, authenticated;
revoke all on function public.reject_match_winner_claim(uuid)
  from public, anon, authenticated;

grant execute on function public.submit_winner_claim(uuid, text)
  to authenticated;
grant execute on function public.submit_match_dispute(uuid, text, text)
  to authenticated;
grant execute on function public.declare_match_winner(uuid, uuid)
  to authenticated;
grant execute on function public.refund_match_players(uuid)
  to authenticated;
grant execute on function public.reject_match_winner_claim(uuid)
  to authenticated;
