alter table public.invoices
  add column if not exists due_date date,
  add column if not exists paid_amount numeric(12, 2) not null default 0,
  add column if not exists paid_at timestamptz;

update public.invoices
set paid_amount = total
where lower(status) = 'paid'
  and paid_amount = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_paid_amount_range'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_paid_amount_range
      check (paid_amount >= 0 and paid_amount <= total);
  end if;
end;
$$;

create table if not exists public.procurement_opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default public.current_business_id()
    references public.businesses(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  organisation text not null check (length(trim(organisation)) between 1 and 160),
  sector text,
  closing_date date,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  notes text,
  status text not null default 'interested'
    check (status in ('interested', 'applied', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists procurement_opportunities_business_status_idx
  on public.procurement_opportunities (business_id, status, closing_date);

alter table public.procurement_opportunities enable row level security;

drop policy if exists business_private_procurement_opportunities
  on public.procurement_opportunities;
create policy business_private_procurement_opportunities
  on public.procurement_opportunities
  for all
  to authenticated
  using (business_id = (select public.current_business_id()))
  with check (business_id = (select public.current_business_id()));

revoke all on public.procurement_opportunities from public, anon;
grant select, insert, update, delete on public.procurement_opportunities to authenticated;
