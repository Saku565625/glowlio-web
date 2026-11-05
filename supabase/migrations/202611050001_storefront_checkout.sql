-- Run this migration once in the Supabase SQL Editor before deploying the updated HTML.
-- It adds image-path tracking and a public checkout RPC that calculates prices in Postgres.

alter table public.products
  add column if not exists image_path text;

create or replace function public.create_store_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_items jsonb
)
returns table(order_number uuid, total_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product_id bigint;
  v_quantity integer;
  v_pack text;
  v_extra numeric(10,2);
  v_product public.products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_delivery numeric(10,2);
  v_order_id bigint;
  v_order_number uuid;
  v_final_total numeric(12,2);
begin
  if p_customer_name is null or length(btrim(p_customer_name)) < 2
     or length(p_customer_name) > 120 then
    raise exception 'Invalid customer name';
  end if;
  if p_phone is null or length(btrim(p_phone)) < 7 or length(p_phone) > 24 then
    raise exception 'Invalid phone number';
  end if;
  if p_address is null or length(btrim(p_address)) < 5
     or length(p_address) > 500 then
    raise exception 'Invalid delivery address';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Order items must be an array';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Order must contain between 1 and 20 lines';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items) as line(value)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::bigint;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Invalid product or quantity';
    end;

    v_pack := coalesce(v_item ->> 'pack', 'standard');
    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid quantity';
    end if;
    if v_pack not in ('standard', 'large') then
      raise exception 'Invalid product option';
    end if;

    select product_row.*
      into v_product
      from public.products as product_row
     where product_row.id = v_product_id
       and product_row.is_published = true
       and product_row.in_stock = true
     for share;
    if not found then
      raise exception 'A product is unavailable';
    end if;

    v_extra := case when v_pack = 'large' then 200 else 0 end;
    v_subtotal := v_subtotal + (v_product.price_num + v_extra) * v_quantity;
  end loop;

  select settings.delivery_charge
    into v_delivery
    from public.site_settings as settings
   where settings.id = 'store';
  if not found then
    v_delivery := 70;
  end if;
  v_final_total := v_subtotal + v_delivery;

  insert into public.orders as new_order (
    customer_name, phone, address, total_amount, status
  )
  values (
    btrim(p_customer_name), btrim(p_phone), btrim(p_address),
    v_final_total, 'Pending'
  )
  returning new_order.id, new_order.order_number
       into v_order_id, v_order_number;

  for v_item in
    select value from jsonb_array_elements(p_items) as line(value)
  loop
    v_product_id := (v_item ->> 'product_id')::bigint;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_pack := coalesce(v_item ->> 'pack', 'standard');
    v_extra := case when v_pack = 'large' then 200 else 0 end;

    select product_row.*
      into v_product
      from public.products as product_row
     where product_row.id = v_product_id;

    insert into public.order_items (
      order_id, product_id, product_name, quantity, unit_price
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name || case when v_pack = 'large' then ' (Large Pack)' else '' end,
      v_quantity,
      v_product.price_num + v_extra
    );
  end loop;

  return query select v_order_number, v_final_total;
end;
$$;

revoke all on function public.create_store_order(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_store_order(text, text, text, jsonb)
  to anon, authenticated;
