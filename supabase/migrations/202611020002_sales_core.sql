-- Ventes : tables, vues de lecture, sécurité et droits.
--
-- Une vente est un document commercial immuable : elle porte ses lignes, ses
-- montants figés (prix et coût au moment de la vente) et le lien vers
-- l'opération de stock qui l'a accompagnée. L'annulation ne supprime rien :
-- elle crée une contre-passation et marque la vente « voided ».

begin;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  seq bigint generated always as identity,
  status text not null default 'completed',
  location_id uuid not null,
  operation_id uuid,
  reversal_operation_id uuid,
  payment_method text not null,
  payment_reference text,
  customer_name text,
  note text,
  subtotal numeric(19, 4) not null default 0,
  total numeric(19, 4) not null default 0,
  total_cost numeric(19, 4) not null default 0,
  item_count integer not null default 0,
  idempotency_key text not null,
  request_fingerprint text not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  constraint sales_tenant_id_id_unique unique (tenant_id, id),
  constraint sales_tenant_key_unique unique (tenant_id, idempotency_key),
  constraint sales_seq_unique unique (seq),
  constraint sales_location_same_tenant foreign key (tenant_id, location_id)
    references public.stock_locations(tenant_id, id) on delete restrict,
  constraint sales_operation_same_tenant foreign key (tenant_id, operation_id)
    references public.stock_operations(tenant_id, id) on delete restrict,
  constraint sales_reversal_same_tenant foreign key (tenant_id, reversal_operation_id)
    references public.stock_operations(tenant_id, id) on delete restrict,
  constraint sales_status_valid check (status in ('completed', 'voided')),
  constraint sales_payment_valid check (payment_method in ('cash', 'mobile_money', 'credit')),
  constraint sales_amounts_valid check (
    subtotal >= 0 and total >= 0 and total_cost >= 0 and total = subtotal
  ),
  constraint sales_key_valid check (
    idempotency_key = btrim(idempotency_key) and char_length(idempotency_key) between 8 and 100
  ),
  constraint sales_customer_valid check (
    customer_name is null or char_length(btrim(customer_name)) between 2 and 120
  ),
  constraint sales_note_valid check (note is null or char_length(note) <= 500),
  constraint sales_reference_valid check (
    payment_reference is null or char_length(btrim(payment_reference)) between 4 and 120
  ),
  constraint sales_void_consistent check (
    (status = 'completed' and voided_at is null and reversal_operation_id is null)
    or (status = 'voided' and voided_at is not null)
  )
);
create index sales_tenant_created_idx on public.sales (tenant_id, created_at desc);
create index sales_tenant_status_idx on public.sales (tenant_id, status);

comment on table public.sales is
  'Vente encaissée : montants figés, ligne de stock liée, annulation par contre-passation.';
comment on column public.sales.seq is
  'Compteur global utilisé pour numéroter les ventes (VTE-000123).';

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null,
  variant_id uuid not null,
  product_name text not null,
  sku text not null,
  unit_price numeric(19, 4) not null,
  unit_cost numeric(19, 4) not null,
  quantity numeric(19, 4) not null,
  line_total numeric(19, 4) not null,
  created_at timestamptz not null default now(),
  constraint sale_items_sale_same_tenant foreign key (tenant_id, sale_id)
    references public.sales(tenant_id, id) on delete cascade,
  constraint sale_items_variant_same_tenant foreign key (tenant_id, variant_id)
    references public.product_variants(tenant_id, id) on delete restrict,
  constraint sale_items_sale_variant_unique unique (sale_id, variant_id),
  constraint sale_items_quantity_positive check (quantity > 0),
  constraint sale_items_amounts_valid check (
    unit_price >= 0 and unit_cost >= 0 and line_total >= 0
  )
);
create index sale_items_sale_idx on public.sale_items (sale_id);

-- Lecture : la vue expose le numéro lisible et le reste à encaisser.
create or replace view public.sales_overview
with (security_invoker = true) as
select
  sale.id,
  sale.tenant_id,
  'VTE-' || lpad(sale.seq::text, 6, '0') as number,
  sale.status,
  sale.location_id,
  location.name as location_name,
  sale.payment_method,
  sale.payment_reference,
  sale.customer_name,
  sale.note,
  sale.subtotal,
  sale.total,
  sale.total_cost,
  sale.total - sale.total_cost as margin,
  sale.item_count,
  sale.operation_id,
  sale.reversal_operation_id,
  sale.actor_user_id,
  sale.created_at,
  sale.voided_at
from public.sales as sale
join public.stock_locations as location
  on location.tenant_id = sale.tenant_id and location.id = sale.location_id;

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy sales_read_permission on public.sales
for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'sales.read')
  or public.has_tenant_permission(tenant_id, 'sales.manage')
);

create policy sale_items_read_permission on public.sale_items
for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'sales.read')
  or public.has_tenant_permission(tenant_id, 'sales.manage')
);

grant select on table public.sales to authenticated;
grant select on table public.sale_items to authenticated;
grant select on table public.sales_overview to authenticated;

commit;
