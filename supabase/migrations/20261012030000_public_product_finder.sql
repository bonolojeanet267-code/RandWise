alter table public.businesses
  add column if not exists location text;

alter table public.products
  add column if not exists public_listed boolean not null default false;

drop policy if exists business_owner_update on public.businesses;
create policy business_owner_update
  on public.businesses
  for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

grant update (name, location) on public.businesses to authenticated;

create or replace function public.search_public_products(
  p_search text default null,
  p_area text default null
)
returns table (
  product_id uuid,
  product_name text,
  price numeric,
  business_name text,
  business_location text,
  in_stock boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    product.id,
    product.name,
    product.sell_price,
    business.name,
    business.location,
    (product.qty > 0)
  from public.products as product
  join public.businesses as business
    on business.id = product.business_id
  where product.public_listed = true
    and product.qty > 0
    and (
      nullif(trim(p_search), '') is null
      or product.name ilike '%' || trim(p_search) || '%'
      or business.name ilike '%' || trim(p_search) || '%'
    )
    and (
      nullif(trim(p_area), '') is null
      or coalesce(business.location, '') ilike '%' || trim(p_area) || '%'
    )
  order by product.name, business.name
  limit 100
$$;

revoke all on function public.search_public_products(text, text) from public;
grant execute on function public.search_public_products(text, text) to anon, authenticated;
