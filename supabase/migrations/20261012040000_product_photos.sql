alter table public.products
  add column if not exists image_url text;

drop function if exists public.search_public_products(text, text);

create function public.search_public_products(
  p_search text default null,
  p_area text default null
)
returns table (
  product_id uuid,
  product_name text,
  price numeric,
  business_name text,
  business_location text,
  in_stock boolean,
  image_url text
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
    (product.qty > 0),
    product.image_url
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rw-product-images',
  'rw-product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_product_images_insert on storage.objects;
create policy business_product_images_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'rw-product-images'
    and (storage.foldername(name))[1] = (select public.current_business_id()::text)
  );

drop policy if exists business_product_images_update on storage.objects;
create policy business_product_images_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'rw-product-images'
    and (storage.foldername(name))[1] = (select public.current_business_id()::text)
  )
  with check (
    bucket_id = 'rw-product-images'
    and (storage.foldername(name))[1] = (select public.current_business_id()::text)
  );

drop policy if exists business_product_images_delete on storage.objects;
create policy business_product_images_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'rw-product-images'
    and (storage.foldername(name))[1] = (select public.current_business_id()::text)
  );
