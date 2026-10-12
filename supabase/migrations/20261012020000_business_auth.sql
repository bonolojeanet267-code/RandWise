create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

drop policy if exists business_owner_select on public.businesses;
create policy business_owner_select
  on public.businesses
  for select
  to authenticated
  using (owner_user_id = (select auth.uid()));

create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from public.businesses
  where owner_user_id = auth.uid()
  limit 1
$$;

create or replace function public.bootstrap_business(p_business_name text default 'My Business')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before setting up a business';
  end if;

  v_name := nullif(trim(p_business_name), '');
  if v_name is null then
    v_name := 'My Business';
  end if;

  insert into public.businesses (owner_user_id, name)
  values (auth.uid(), v_name)
  on conflict (owner_user_id) do update
    set owner_user_id = excluded.owner_user_id
  returning id into v_business_id;

  return v_business_id;
end;
$$;

revoke all on function public.current_business_id() from public, anon;
revoke all on function public.bootstrap_business(text) from public, anon;
grant execute on function public.current_business_id() to authenticated;
grant execute on function public.bootstrap_business(text) to authenticated;
grant select on public.businesses to authenticated;

do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'products',
    'sales',
    'expenses',
    'budgets',
    'invoices',
    'stock_receipts',
    'service_requests'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format(
        'alter table public.%I add column if not exists business_id uuid references public.businesses(id) on delete cascade',
        v_table
      );
      execute format(
        'alter table public.%I alter column business_id set default public.current_business_id()',
        v_table
      );
      execute format('alter table public.%I enable row level security', v_table);

      for v_policy in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = v_table
      loop
        execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
      end loop;

      execute format(
        'create policy business_private_rows on public.%I for all to authenticated using (business_id = (select public.current_business_id())) with check (business_id = (select public.current_business_id()))',
        v_table
      );

      execute format('revoke all on public.%I from public, anon', v_table);
      execute format('grant select, insert, update, delete on public.%I to authenticated', v_table);
    end if;
  end loop;
end;
$$;

alter table public.stock_receipt_items enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'stock_receipt_items'
  loop
    execute format('drop policy %I on public.stock_receipt_items', v_policy.policyname);
  end loop;
end;
$$;

create policy business_private_stock_receipt_items
  on public.stock_receipt_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.stock_receipts receipt
      where receipt.id = receipt_id
        and receipt.business_id = (select public.current_business_id())
    )
  )
  with check (
    exists (
      select 1
      from public.stock_receipts receipt
      where receipt.id = receipt_id
        and receipt.business_id = (select public.current_business_id())
    )
  );

revoke all on public.stock_receipt_items from public, anon;
grant select, insert, update, delete on public.stock_receipt_items to authenticated;

do $$
begin
  if to_regclass('public.budgets') is not null then
    alter table public.budgets drop constraint if exists budgets_category_key;
    create unique index if not exists budgets_business_category_unique
      on public.budgets (business_id, category);
  end if;
end;
$$;

do $$
declare
  v_policy record;
begin
  if to_regclass('public.it_providers') is not null then
    alter table public.it_providers enable row level security;

    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'it_providers'
    loop
      execute format('drop policy %I on public.it_providers', v_policy.policyname);
    end loop;

    create policy public_provider_directory_read
      on public.it_providers
      for select
      to anon, authenticated
      using (true);

    revoke insert, update, delete on public.it_providers from public, anon, authenticated;
    grant select on public.it_providers to anon, authenticated;
  end if;
end;
$$;

revoke all on all sequences in schema public from public, anon;
grant usage, select on all sequences in schema public to authenticated;

alter table public.stock_receipts
  drop constraint if exists stock_receipts_supplier_name_invoice_number_key;

create unique index if not exists stock_receipts_business_invoice_unique
  on public.stock_receipts (business_id, supplier_name, invoice_number)
  where business_id is not null;

revoke all on function public.receive_stock_invoice(text, text, date, numeric, jsonb) from public, anon;
revoke all on function public.record_sale(uuid, integer) from public, anon;
grant execute on function public.receive_stock_invoice(text, text, date, numeric, jsonb) to authenticated;
grant execute on function public.record_sale(uuid, integer) to authenticated;
