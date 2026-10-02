create unique index payment_methods_single_active_unique
  on public.payment_methods ((is_active))
  where is_active;

revoke all on table public.payment_methods from public, anon, authenticated;
grant select on table public.payment_methods to authenticated;

create policy "Authenticated users can view the active payment method"
  on public.payment_methods for select to authenticated
  using (is_active);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  amount numeric(12, 2) not null
    check (amount >= 100 and amount <= 100000),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  proof_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(proof_path)) > 0)
);

create index deposits_user_created_idx
  on public.deposits (user_id, created_at desc);

create index deposits_review_queue_idx
  on public.deposits (created_at)
  where status = 'PENDING';

create trigger deposits_set_updated_at
  before update on public.deposits
  for each row execute function public.set_updated_at();

alter table public.deposits enable row level security;
revoke all on table public.deposits from public, anon, authenticated;
grant select, insert on table public.deposits to authenticated;

create policy "Users can view their own deposits"
  on public.deposits for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can submit their own pending deposits"
  on public.deposits for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'PENDING'
    and proof_path like (select auth.uid())::text || '/%'
    and exists (
      select 1
      from public.payment_methods
      where payment_methods.id = payment_method_id
        and payment_methods.is_active
        and payment_methods.provider = 'manual_upi'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deposit_proofs',
  'deposit_proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own deposit proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deposit_proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can view their own deposit proofs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'deposit_proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can view the active manual payment QR"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'deposit_proofs'
    and exists (
      select 1
      from public.payment_methods
      where payment_methods.is_active
        and payment_methods.provider = 'manual_upi'
        and payment_methods.qr_storage_path = storage.objects.name
    )
  );

create policy "Users can remove their own orphaned deposit proofs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'deposit_proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.payment_methods
      where payment_methods.is_active
        and payment_methods.provider = 'manual_upi'
        and payment_methods.qr_storage_path = storage.objects.name
    )
  );
