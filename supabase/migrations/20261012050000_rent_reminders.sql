create table if not exists public.rent_reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default public.current_business_id()
    references public.businesses(id) on delete cascade,
  title text not null default 'Premises rent'
    check (length(trim(title)) between 1 and 100),
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rent_reminders_business_due_date_idx
  on public.rent_reminders (business_id, due_date)
  where paid_at is null;

alter table public.rent_reminders enable row level security;

drop policy if exists business_private_rent_reminders on public.rent_reminders;
create policy business_private_rent_reminders
  on public.rent_reminders
  for all
  to authenticated
  using (business_id = (select public.current_business_id()))
  with check (business_id = (select public.current_business_id()));

revoke all on public.rent_reminders from public, anon;
grant select, insert, update, delete on public.rent_reminders to authenticated;
