create table if not exists public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  invoice_number text not null,
  invoice_date date not null,
  invoice_total numeric(12, 2) not null check (invoice_total >= 0),
  created_at timestamptz not null default now(),
  unique (supplier_name, invoice_number)
);

create table if not exists public.stock_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.stock_receipts(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  sell_price numeric(12, 2) not null check (sell_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists stock_receipts_invoice_date_idx
  on public.stock_receipts (invoice_date desc);

create index if not exists stock_receipt_items_receipt_id_idx
  on public.stock_receipt_items (receipt_id);

grant select, insert on public.stock_receipts to anon, authenticated;
grant select, insert on public.stock_receipt_items to anon, authenticated;
grant insert, update on public.products to anon, authenticated;

create or replace function public.receive_stock_invoice(
  p_supplier_name text,
  p_invoice_number text,
  p_invoice_date date,
  p_invoice_total numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_receipt_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_product_name text;
  v_quantity numeric;
  v_unit_cost numeric;
  v_sell_price numeric;
begin
  if nullif(trim(p_supplier_name), '') is null then
    raise exception 'Supplier name is required';
  end if;
  if nullif(trim(p_invoice_number), '') is null then
    raise exception 'Invoice number is required';
  end if;
  if p_invoice_date is null then
    raise exception 'Invoice date is required';
  end if;
  if p_invoice_total is null or p_invoice_total < 0 then
    raise exception 'Invoice total must be zero or greater';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'At least one invoice item is required';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'At least one invoice item is required';
  end if;

  insert into public.stock_receipts (supplier_name, invoice_number, invoice_date, invoice_total)
  values (trim(p_supplier_name), trim(p_invoice_number), p_invoice_date, p_invoice_total)
  returning id into v_receipt_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each invoice item must be an object';
    end if;

    v_product_name := nullif(trim(v_item ->> 'product_name'), '');
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_cost := (v_item ->> 'unit_cost')::numeric;
    v_sell_price := (v_item ->> 'sell_price')::numeric;

    if v_quantity is null or v_quantity <= 0 or v_quantity <> trunc(v_quantity) then
      raise exception 'Item quantity must be a positive whole number';
    end if;
    if v_unit_cost is null or v_unit_cost < 0 or v_sell_price is null or v_sell_price < 0 then
      raise exception 'Item prices must be zero or greater';
    end if;

    if nullif(v_item ->> 'product_id', '') is null then
      if v_product_name is null then
        raise exception 'A name is required for each new product';
      end if;

      insert into public.products (name, qty, cost_price, sell_price)
      values (v_product_name, v_quantity::integer, v_unit_cost, v_sell_price)
      returning id into v_product_id;
    else
      v_product_id := (v_item ->> 'product_id')::uuid;

      update public.products
      set qty = qty + v_quantity::integer,
          cost_price = v_unit_cost,
          sell_price = v_sell_price
      where id = v_product_id;

      if not found then
        raise exception 'Selected product no longer exists';
      end if;
    end if;

    insert into public.stock_receipt_items (
      receipt_id,
      product_id,
      product_name,
      quantity,
      unit_cost,
      sell_price
    )
    values (
      v_receipt_id,
      v_product_id,
      coalesce(v_product_name, (select name from public.products where id = v_product_id)),
      v_quantity::integer,
      v_unit_cost,
      v_sell_price
    );
  end loop;

  return v_receipt_id;
end;
$$;

create or replace function public.record_sale(
  p_product_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_sale_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Sale quantity must be a positive whole number';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Selected product no longer exists';
  end if;
  if v_product.qty < p_quantity then
    raise exception 'Not enough stock to complete this sale';
  end if;

  insert into public.sales (product_id, qty, total)
  values (p_product_id, p_quantity, p_quantity * v_product.sell_price)
  returning id into v_sale_id;

  update public.products
  set qty = qty - p_quantity
  where id = p_product_id;

  return v_sale_id;
end;
$$;

grant execute on function public.receive_stock_invoice(text, text, date, numeric, jsonb) to anon, authenticated;
grant execute on function public.record_sale(uuid, integer) to anon, authenticated;
