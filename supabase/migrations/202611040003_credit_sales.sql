-- 202611040003_credit_sales.sql
-- ---------------------------------------------------------------------------
-- Ventes à crédit : savoir qui doit encore de l'argent et encaisser le reste.
--
--   1. `sale_payments` : chaque règlement reçu après coup (espèces ou Mobile
--      Money). Une vente à crédit naît sans règlement ; les paiements suivants
--      s'ajoutent ici, sans jamais modifier la vente d'origine.
--   2. `credit_sales_list` : les ventes à crédit qui ont encore un reste à
--      payer, avec le nom du client.
--   3. `add_sale_payment` : encaisse un montant, refuse de dépasser le reste
--      dû et renvoie le nouveau solde.
--
-- L'écriture passe uniquement par les fonctions (pas d'insert direct) : le
-- montant est revérifié côté base, jamais décidé par le navigateur.
-- ---------------------------------------------------------------------------
begin;

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null,
  amount numeric(19, 4) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'mobile_money')),
  reference text,
  received_at timestamptz not null default now(),
  created_by uuid,
  constraint sale_payments_sale_same_tenant foreign key (tenant_id, sale_id)
    references public.sales (tenant_id, id) on delete cascade,
  constraint sale_payments_tenant_id_id_unique unique (tenant_id, id)
);

create index if not exists sale_payments_sale_idx on public.sale_payments (tenant_id, sale_id);

alter table public.sale_payments enable row level security;

drop policy if exists sale_payments_read on public.sale_payments;
create policy sale_payments_read on public.sale_payments
  for select to authenticated
  using (
    public.has_tenant_permission(tenant_id, 'sales.read')
    or public.has_tenant_permission(tenant_id, 'sales.manage')
  );

revoke insert, update, delete, truncate on public.sale_payments from authenticated, anon;
grant select on public.sale_payments to authenticated;

-- 1. Les ventes à crédit qui attendent encore de l'argent.
create or replace function public.credit_sales_list(p_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
begin
  if not (
    public.has_tenant_permission(p_tenant_id, 'sales.read')
    or public.has_tenant_permission(p_tenant_id, 'sales.manage')
  ) then
    raise exception 'Vous n’avez pas accès aux ventes de cette entreprise.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', credit.id,
        'number', 'VTE-' || lpad(credit.seq::text, 6, '0'),
        'customer_name', credit.customer_name,
        'total', credit.total,
        'paid', credit.paid,
        'remaining', credit.total - credit.paid,
        'created_at', credit.created_at
      ) order by credit.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      sale.id,
      sale.seq,
      sale.customer_name,
      sale.total,
      sale.created_at,
      coalesce(sum(payment.amount), 0) as paid
    from public.sales as sale
    left join public.sale_payments as payment
      on payment.tenant_id = sale.tenant_id and payment.sale_id = sale.id
    where sale.tenant_id = p_tenant_id
      and sale.payment_method = 'credit'
      and sale.status = 'completed'
    group by sale.id, sale.seq, sale.customer_name, sale.total, sale.created_at
    having sale.total - coalesce(sum(payment.amount), 0) > 0
  ) as credit;

  return v_rows;
end;
$$;

-- 2. Encaisser le reste d'une vente à crédit.
create or replace function public.add_sale_payment(
  p_tenant_id uuid,
  p_sale_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales;
  v_paid numeric(19, 4);
  v_remaining numeric(19, 4);
  v_method text := coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'cash');
begin
  if not public.has_tenant_permission(p_tenant_id, 'sales.manage') then
    raise exception 'Seul un membre autorisé peut encaisser un règlement.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Indiquez un montant supérieur à zéro.' using errcode = '22023';
  end if;
  if v_method not in ('cash', 'mobile_money') then
    raise exception 'Moyen de paiement inconnu.' using errcode = '22023';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Vente introuvable pour cette entreprise.' using errcode = '22023';
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'Cette vente a été annulée : elle ne peut plus recevoir de règlement.' using errcode = '22023';
  end if;
  if v_sale.payment_method <> 'credit' then
    raise exception 'Cette vente a déjà été payée.' using errcode = '22023';
  end if;

  select coalesce(sum(payment.amount), 0) into v_paid
  from public.sale_payments as payment
  where payment.tenant_id = p_tenant_id and payment.sale_id = p_sale_id;

  v_remaining := v_sale.total - v_paid;
  if v_remaining <= 0 then
    raise exception 'Cette vente est déjà entièrement payée.' using errcode = '22023';
  end if;
  if p_amount > v_remaining then
    raise exception 'Le montant dépasse le reste à payer (%).', to_char(v_remaining, 'FM9999999990.00')
      using errcode = '22023';
  end if;

  insert into public.sale_payments (tenant_id, sale_id, amount, method, reference, created_by)
  values (p_tenant_id, p_sale_id, p_amount, v_method, nullif(btrim(coalesce(p_reference, '')), ''), auth.uid());

  return jsonb_build_object(
    'sale_id', p_sale_id,
    'paid', v_paid + p_amount,
    'remaining', v_remaining - p_amount
  );
end;
$$;

revoke all on function public.credit_sales_list(uuid) from public, anon;
revoke all on function public.add_sale_payment(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.credit_sales_list(uuid) to authenticated;
grant execute on function public.add_sale_payment(uuid, uuid, numeric, text, text) to authenticated;

commit;
