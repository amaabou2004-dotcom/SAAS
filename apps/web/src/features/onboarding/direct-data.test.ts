import { describe, expect, it } from 'vitest';
import { directApiFetch, isDirectRoute, type DirectClient } from './direct-data';

type Rows = Record<string, unknown[]>;

function makeClient(rows: Rows, rpcResult: unknown = { id: 'op-1' }) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const fromCalls: string[] = [];

  const builder = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve),
    };
    return chain;
  };

  const client = {
    from: (table: string) => {
      fromCalls.push(table);
      return builder(table);
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: rpcResult, error: null });
    },
  } as unknown as DirectClient;

  return { client, rpcCalls, fromCalls };
}

const TENANT_ID = '0969579a-c676-4542-b846-d9df6235f6e6';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_ID = '33333333-3333-4333-8333-333333333333';
const LOCATION_ID = '44444444-4444-4444-8444-444444444444';

describe('mode direct — routes reconnues', () => {
  it('accepte les routes de l’API et rejette les autres', () => {
    expect(isDirectRoute('/tenants/me')).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/catalog/products`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/inventory/operations/${PRODUCT_ID}/reversal`)).toBe(true);
    expect(isDirectRoute('/tenants/me/../../../etc/passwd')).toBe(false);
    expect(isDirectRoute('/health')).toBe(false);
  });
});

describe('mode direct — entreprises', () => {
  it('liste les entreprises accessibles avec la forme attendue', async () => {
    const { client } = makeClient({
      tenants: [
        {
          id: TENANT_ID,
          name: 'Boutique Test',
          slug: 'boutique-test',
          currency_code: 'XOF',
          timezone: 'Africa/Niamey',
          status: 'active',
          created_at: '2026-11-01T10:00:00Z',
        },
      ],
    });

    const tenants = await directApiFetch<Array<{ name: string; currency_code: string }>>('/tenants/me', undefined, client);
    expect(tenants).toHaveLength(1);
    expect(tenants[0]).toMatchObject({ name: 'Boutique Test', currency_code: 'XOF' });
  });

  it('crée une entreprise via la RPC create_tenant', async () => {
    const created = {
      id: TENANT_ID,
      name: 'Nouvelle',
      slug: 'nouvelle',
      currency_code: 'XOF',
      timezone: 'Africa/Niamey',
      status: 'active',
      created_at: '2026-11-02T10:00:00Z',
    };
    const { client, rpcCalls } = makeClient({}, created);

    const tenant = await directApiFetch<{ id: string }>(
      '/tenants',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Nouvelle', slug: 'nouvelle', currency_code: 'XOF', timezone: 'Africa/Niamey' }),
      },
      client,
    );

    expect(tenant.id).toBe(TENANT_ID);
    expect(rpcCalls[0]!).toMatchObject({ name: 'create_tenant', args: { p_name: 'Nouvelle', p_slug: 'nouvelle' } });
  });
});

describe('mode direct — catalogue', () => {
  it('liste les catégories', async () => {
    const { client } = makeClient({
      categories: [{ id: CATEGORY_ID, tenant_id: TENANT_ID, name: 'Boissons', active: true }],
    });

    const categories = await directApiFetch<Array<{ name: string; active: boolean }>>(
      `/tenants/${TENANT_ID}/catalog/categories`,
      undefined,
      client,
    );

    expect(categories[0]).toMatchObject({ name: 'Boissons', active: true });
  });

  it('compose les produits avec leur catégorie et leurs variantes', async () => {
    const { client } = makeClient({
      products: [
        {
          id: PRODUCT_ID,
          tenant_id: TENANT_ID,
          category_id: CATEGORY_ID,
          name: 'Coca 1,5 L',
          description: null,
          sale_price: '750.00',
          cost_price: '500.00',
          active: true,
        },
      ],
      product_variants: [
        {
          id: VARIANT_ID,
          tenant_id: TENANT_ID,
          product_id: PRODUCT_ID,
          sku: 'COCA-15',
          barcode: null,
          attributes: null,
          active: true,
        },
      ],
      categories: [{ id: CATEGORY_ID, tenant_id: TENANT_ID, name: 'Boissons', active: true }],
    });

    const products = await directApiFetch<
      Array<{ name: string; sale_price: number; category: { name: string } | null; variants: Array<{ sku: string }> }>
    >(`/tenants/${TENANT_ID}/catalog/products`, undefined, client);

    expect(products[0]).toMatchObject({ name: 'Coca 1,5 L', sale_price: 750 });
    expect(products[0]?.category?.name).toBe('Boissons');
    expect(products[0]?.variants[0]?.sku).toBe('COCA-15');
  });

  it('enregistre un produit via upsert_product avec des nombres', async () => {
    const { client, rpcCalls } = makeClient({}, { product_id: PRODUCT_ID, variant_id: VARIANT_ID });

    await directApiFetch(
      `/tenants/${TENANT_ID}/catalog/products`,
      {
        method: 'POST',
        body: JSON.stringify({
          category_id: CATEGORY_ID,
          name: 'Coca 1,5 L',
          description: null,
          sale_price: '750.00',
          cost_price: '500.00',
          sku: 'COCA-15',
          barcode: null,
          attributes: {},
        }),
      },
      client,
    );

    expect(rpcCalls[0]!.name).toBe('upsert_product');
    expect(rpcCalls[0]!.args).toMatchObject({
      p_tenant_id: TENANT_ID,
      p_category_id: CATEGORY_ID,
      p_sale_price: 750,
      p_cost_price: 500,
      p_sku: 'COCA-15',
      p_active: true,
    });
  });

  it('remonte le message d’erreur de la base', async () => {
    const client = {
      from: () => {
        throw new Error('inutilisé');
      },
      rpc: () => Promise.resolve({ data: null, error: { message: 'catalog management permission required' } }),
    } as unknown as DirectClient;

    await expect(
      directApiFetch(`/tenants/${TENANT_ID}/catalog/categories`, { method: 'POST', body: '{"name":"X"}' }, client),
    ).rejects.toThrow('catalog management permission required');
  });
});

describe('mode direct — stock', () => {
  it('convertit les niveaux de stock en nombres', async () => {
    const { client } = makeClient({
      stock_overview: [
        {
          tenant_id: TENANT_ID,
          variant_id: VARIANT_ID,
          location_id: LOCATION_ID,
          product_id: PRODUCT_ID,
          product_name: 'Coca 1,5 L',
          sku: 'COCA-15',
          location_name: 'Dépôt',
          location_code: 'DEPOT',
          on_hand: '12.000',
          reserved: '0.000',
          available: '12.000',
          updated_at: '2026-11-02T10:00:00Z',
        },
      ],
    });

    const stock = await directApiFetch<Array<{ on_hand: number; available: number }>>(
      `/tenants/${TENANT_ID}/inventory/stock`,
      undefined,
      client,
    );

    expect(stock[0]?.on_hand).toBe(12);
    expect(stock[0]?.available).toBe(12);
  });

  it('transmet la clé d’idempotence et des quantités numériques', async () => {
    const { client, rpcCalls } = makeClient({}, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    const result = await directApiFetch<{ id: string }>(
      `/tenants/${TENANT_ID}/inventory/operations`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': 'op-cle-1234' },
        body: JSON.stringify({
          operation_type: 'receipt',
          reason: 'Livraison fournisseur',
          reference: 'BL-42',
          lines: [{ variant_id: VARIANT_ID, location_id: LOCATION_ID, quantity_delta: '24' }],
        }),
      },
      client,
    );

    expect(result.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(rpcCalls[0]!.args).toMatchObject({
      p_operation_type: 'receipt',
      p_idempotency_key: 'op-cle-1234',
      p_reference: 'BL-42',
      p_lines: [{ variant_id: VARIANT_ID, location_id: LOCATION_ID, quantity_delta: 24 }],
    });
  });

  it('envoie une contre-passation avec l’opération d’origine', async () => {
    const operationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const { client, rpcCalls } = makeClient({}, operationId);

    await directApiFetch(
      `/tenants/${TENANT_ID}/inventory/operations/${operationId}/reversal`,
      { method: 'POST', headers: { 'Idempotency-Key': 'rev-cle-1234' }, body: JSON.stringify({ reason: 'Erreur de saisie' }) },
      client,
    );

    expect(rpcCalls[0]!.args).toMatchObject({
      p_operation_type: 'reversal',
      p_reverses_operation_id: operationId,
      p_reason: 'Erreur de saisie',
    });
  });
});

describe('mode direct — ventes', () => {
  const SALE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const saleRow = {
    id: SALE_ID,
    tenant_id: TENANT_ID,
    number: 'VTE-000001',
    status: 'completed',
    location_id: LOCATION_ID,
    location_name: 'Boutique',
    payment_method: 'cash',
    payment_reference: null,
    customer_name: null,
    note: null,
    subtotal: '2400.0000',
    total: '2400.0000',
    total_cost: '1000.0000',
    margin: '1400.0000',
    item_count: 1,
    created_at: '2026-11-03T10:00:00Z',
    voided_at: null,
  };
  const itemRow = {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    sale_id: SALE_ID,
    variant_id: VARIANT_ID,
    product_name: 'Eau minérale',
    sku: 'EAU-001',
    unit_price: '1200.0000',
    unit_cost: '500.0000',
    quantity: '2.0000',
    line_total: '2400.0000',
  };

  it('reconnaît les routes de vente', () => {
    expect(isDirectRoute(`/tenants/${TENANT_ID}/sales`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/sales/${SALE_ID}`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/sales/${SALE_ID}/void`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/sales/${SALE_ID}/void/plus`)).toBe(false);
  });

  it('liste les ventes avec des montants numériques', async () => {
    const { client } = makeClient({ sales_overview: [saleRow] });

    const sales = await directApiFetch<Array<{ number: string; total: number; status: string }>>(
      `/tenants/${TENANT_ID}/sales`,
      undefined,
      client,
    );

    expect(sales[0]).toMatchObject({ number: 'VTE-000001', total: 2400, status: 'completed' });
  });

  it('encaisse via la RPC post_sale puis relit le ticket', async () => {
    const { client, rpcCalls } = makeClient({ sales_overview: [saleRow], sale_items: [itemRow] }, SALE_ID);

    const sale = await directApiFetch<{ number: string; items: Array<{ sku: string; quantity: number }> }>(
      `/tenants/${TENANT_ID}/sales`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': 'vente-cle-0001' },
        body: JSON.stringify({
          location_id: LOCATION_ID,
          payment_method: 'mobile_money',
          payment_reference: 'MM-778899',
          customer_name: '  Aïcha  ',
          note: null,
          items: [{ variant_id: VARIANT_ID, quantity: '2', unit_price: '1200' }],
        }),
      },
      client,
    );

    expect(rpcCalls[0]!.name).toBe('post_sale');
    expect(rpcCalls[0]!.args).toMatchObject({
      p_tenant_id: TENANT_ID,
      p_idempotency_key: 'vente-cle-0001',
      p_location_id: LOCATION_ID,
      p_payment_method: 'mobile_money',
      p_payment_reference: 'MM-778899',
      p_customer_name: 'Aïcha',
      p_items: [{ variant_id: VARIANT_ID, quantity: 2, unit_price: 1200 }],
    });
    expect(sale.number).toBe('VTE-000001');
    expect(sale.items[0]).toMatchObject({ sku: 'EAU-001', quantity: 2 });
  });

  it('annule via la RPC void_sale et renvoie le ticket à jour', async () => {
    const { client, rpcCalls } = makeClient({ sales_overview: [saleRow], sale_items: [itemRow] }, SALE_ID);

    const sale = await directApiFetch<{ status: string }>(
      `/tenants/${TENANT_ID}/sales/${SALE_ID}/void`,
      { method: 'POST', headers: { 'Idempotency-Key': 'annulation-cle-1' }, body: JSON.stringify({ reason: 'Retour client' }) },
      client,
    );

    expect(rpcCalls[0]!.name).toBe('void_sale');
    expect(rpcCalls[0]!.args).toMatchObject({
      p_tenant_id: TENANT_ID,
      p_sale_id: SALE_ID,
      p_reason: 'Retour client',
      p_idempotency_key: 'annulation-cle-1',
    });
    expect(sale.status).toBe('completed');
  });
});

describe('mode direct — équipe', () => {
  const MEMBERSHIP_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const ROLE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const INVITATION_ID = '12345678-1234-4234-8234-123456789012';

  it('reconnaît les routes de l’équipe', () => {
    expect(isDirectRoute(`/tenants/${TENANT_ID}/members`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/members/${MEMBERSHIP_ID}`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/roles`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/invitations`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/invitations/${INVITATION_ID}/revoke`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/permissions/members.manage`)).toBe(true);
    expect(isDirectRoute('/invitations/accept')).toBe(true);
    expect(isDirectRoute('/invitations')).toBe(false);
  });

  it('liste les membres et les rôles via les RPC', async () => {
    const memberRow = {
      membership_id: MEMBERSHIP_ID,
      user_id: VARIANT_ID,
      full_name: 'Aïcha',
      email: 'aicha@exemple.com',
      role_id: ROLE_ID,
      role_name: 'Vendeur',
      status: 'active',
      created_at: '2026-11-03T10:00:00Z',
    };

    const members = makeClient({}, [memberRow]);
    const rows = await directApiFetch<Array<{ role_name: string; email: string }>>(
      `/tenants/${TENANT_ID}/members`,
      undefined,
      members.client,
    );

    expect(members.rpcCalls[0]).toEqual({ name: 'list_tenant_members', args: { p_tenant_id: TENANT_ID } });
    expect(rows[0]).toMatchObject({ role_name: 'Vendeur', email: 'aicha@exemple.com' });

    const roles = makeClient({}, [{
      id: ROLE_ID,
      name: 'Vendeur',
      description: 'Encaisse les ventes.',
      is_system: true,
      permissions: ['sales.read', 'sales.manage'],
      member_count: '1',
    }]);
    const roleRows = await directApiFetch<Array<{ name: string; member_count: number; permissions: string[] }>>(
      `/tenants/${TENANT_ID}/roles`,
      undefined,
      roles.client,
    );

    expect(roles.rpcCalls[0]).toEqual({ name: 'list_tenant_roles', args: { p_tenant_id: TENANT_ID } });
    expect(roleRows[0]).toEqual({
      id: ROLE_ID,
      name: 'Vendeur',
      description: 'Encaisse les ventes.',
      is_system: true,
      permissions: ['sales.read', 'sales.manage'],
      member_count: 1,
    });
  });

  it('invite, annule, change un rôle et retire un membre', async () => {
    const invite = makeClient({}, { status: 'invited', invitation_id: INVITATION_ID });
    const invited = await directApiFetch<{ status: string }>(
      `/tenants/${TENANT_ID}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify({ email: 'nouveau@exemple.com', role_id: ROLE_ID, full_name: '  Nouveau  ' }),
      },
      invite.client,
    );
    expect(invite.rpcCalls[0]).toEqual({
      name: 'invite_member',
      args: { p_tenant_id: TENANT_ID, p_email: 'nouveau@exemple.com', p_role_id: ROLE_ID, p_full_name: 'Nouveau' },
    });
    expect(invited.status).toBe('invited');

    const revoke = makeClient({}, null);
    await directApiFetch(`/tenants/${TENANT_ID}/invitations/${INVITATION_ID}/revoke`, { method: 'POST' }, revoke.client);
    expect(revoke.rpcCalls[0]!.name).toBe('revoke_invitation');

    const role = makeClient({}, null);
    await directApiFetch(
      `/tenants/${TENANT_ID}/members/${MEMBERSHIP_ID}`,
      { method: 'PATCH', body: JSON.stringify({ role_id: ROLE_ID }) },
      role.client,
    );
    expect(role.rpcCalls[0]).toEqual({
      name: 'update_member_role',
      args: { p_tenant_id: TENANT_ID, p_membership_id: MEMBERSHIP_ID, p_role_id: ROLE_ID },
    });

    const removal = makeClient({}, null);
    await directApiFetch(`/tenants/${TENANT_ID}/members/${MEMBERSHIP_ID}`, { method: 'DELETE' }, removal.client);
    expect(removal.rpcCalls[0]).toEqual({
      name: 'remove_member',
      args: { p_tenant_id: TENANT_ID, p_membership_id: MEMBERSHIP_ID },
    });
  });

  it('vérifie un droit et accepte les invitations', async () => {
    const permission = makeClient({}, true);
    const allowed = await directApiFetch<{ allowed: boolean }>(
      `/tenants/${TENANT_ID}/permissions/members.manage`,
      undefined,
      permission.client,
    );
    expect(permission.rpcCalls[0]).toEqual({
      name: 'has_tenant_permission',
      args: { target_tenant_id: TENANT_ID, target_permission: 'members.manage' },
    });
    expect(allowed).toEqual({ allowed: true });

    const accept = makeClient({}, { accepted: 2 });
    const result = await directApiFetch<{ accepted: number }>('/invitations/accept', { method: 'POST' }, accept.client);
    expect(accept.rpcCalls[0]!.name).toBe('accept_my_invitations');
    expect(result.accepted).toBe(2);
  });
});

describe('mode direct — rapports', () => {
  it('reconnaît la route, avec ou sans période', () => {
    expect(isDirectRoute(`/tenants/${TENANT_ID}/reports`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/reports?from=2026-11-01&to=2026-11-04`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/reports/extra`)).toBe(false);
  });

  it('transmet la période à report_summary', async () => {
    const { client, rpcCalls } = makeClient({}, { totals: { sales: 2, revenue: 4800 } });

    const report = await directApiFetch<{ totals: { sales: number } }>(
      `/tenants/${TENANT_ID}/reports?from=2026-11-01&to=2026-11-04`,
      undefined,
      client,
    );

    expect(rpcCalls[0]).toEqual({
      name: 'report_summary',
      args: { p_tenant_id: TENANT_ID, p_from: '2026-11-01', p_to: '2026-11-04' },
    });
    expect(report.totals.sales).toBe(2);
  });

  it('refuse une période invalide sans interroger la base', async () => {
    const { client, rpcCalls } = makeClient({}, {});

    await expect(
      directApiFetch(`/tenants/${TENANT_ID}/reports?from=hier&to=2026-11-04`, undefined, client),
    ).rejects.toThrow(/Période de rapport invalide/);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('mode direct — boutique publique', () => {
  const ORDER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const catalogRow = {
    product_id: PRODUCT_ID,
    variant_id: VARIANT_ID,
    name: 'Eau minérale',
    description: null,
    sku: 'EAU-001',
    category_name: 'Boissons',
    unit_price: '400.0000',
    available: '12.0000',
    currency_code: 'XOF',
  };

  it('reconnaît les routes de la boutique', () => {
    expect(isDirectRoute('/shop/boutique-test')).toBe(true);
    expect(isDirectRoute('/shop/boutique-test/catalog')).toBe(true);
    expect(isDirectRoute('/shop/boutique-test/orders')).toBe(true);
    expect(isDirectRoute('/shop/a')).toBe(false);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/storefront`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/storefront/orders`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/storefront/orders/${ORDER_ID}/confirm`)).toBe(true);
    expect(isDirectRoute(`/tenants/${TENANT_ID}/storefront/orders/${ORDER_ID}/supprimer`)).toBe(false);
  });

  it('charge les informations et le catalogue sans compte', async () => {
    const info = makeClient({}, { slug: 'boutique-test', display_name: 'Chez Aïcha' });
    const loaded = await directApiFetch<{ display_name: string } | null>(
      '/shop/boutique-test',
      undefined,
      info.client,
    );
    expect(info.rpcCalls[0]).toEqual({ name: 'storefront_info', args: { p_slug: 'boutique-test' } });
    expect(loaded?.display_name).toBe('Chez Aïcha');

    const catalog = makeClient({}, [catalogRow]);
    const items = await directApiFetch<Array<{ name: string; unit_price: number; available: number }>>(
      '/shop/boutique-test/catalog',
      undefined,
      catalog.client,
    );
    expect(items[0]).toMatchObject({ name: 'Eau minérale', unit_price: 400, available: 12 });
  });

  it('envoie une commande sans jamais transmettre de prix', async () => {
    const { client, rpcCalls } = makeClient({}, { id: ORDER_ID, number: 'CMD-000001', total: 800 });

    const receipt = await directApiFetch<{ number: string }>(
      '/shop/boutique-test/orders',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': 'cle-commande-0001' },
        body: JSON.stringify({
          customer_name: 'Aïcha',
          customer_phone: '+22790000001',
          note: null,
          items: [{ variant_id: VARIANT_ID, quantity: 2, unit_price: 1 }],
        }),
      },
      client,
    );

    expect(rpcCalls[0]).toEqual({
      name: 'place_storefront_order',
      args: {
        p_slug: 'boutique-test',
        p_idempotency_key: 'cle-commande-0001',
        p_customer_name: 'Aïcha',
        p_customer_phone: '+22790000001',
        p_note: null,
        p_items: [{ variant_id: VARIANT_ID, quantity: 2 }],
      },
    });
    expect(receipt.number).toBe('CMD-000001');
  });

  it('refuse une adresse de boutique invalide sans appeler la base', async () => {
    const { client, rpcCalls } = makeClient({}, {});
    await expect(directApiFetch('/shop/AB', undefined, client)).rejects.toThrow(/Adresse de boutique invalide/);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe('mode direct — boutique du commerçant', () => {
  const ORDER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const settings = {
    tenant_id: TENANT_ID,
    slug: 'boutique-test',
    display_name: 'Chez Aïcha',
    whatsapp: null,
    published: true,
    default_location_id: LOCATION_ID,
    public_path: '/b/boutique-test',
    currency_code: 'XOF',
  };

  it('lit et enregistre les réglages via les RPC', async () => {
    const read = makeClient({}, settings);
    const loaded = await directApiFetch<{ slug: string; published: boolean }>(
      `/tenants/${TENANT_ID}/storefront`,
      undefined,
      read.client,
    );
    expect(read.rpcCalls[0]).toEqual({ name: 'storefront_settings_get', args: { p_tenant_id: TENANT_ID } });
    expect(loaded).toMatchObject({ slug: 'boutique-test', published: true });

    const saved = makeClient({}, settings);
    await directApiFetch(
      `/tenants/${TENANT_ID}/storefront`,
      {
        method: 'POST',
        body: JSON.stringify({
          slug: 'boutique-test',
          display_name: ' Chez Aïcha ',
          whatsapp: '  ',
          published: true,
          default_location_id: LOCATION_ID,
        }),
      },
      saved.client,
    );
    expect(saved.rpcCalls[0]).toEqual({
      name: 'storefront_settings_save',
      args: {
        p_tenant_id: TENANT_ID,
        p_slug: 'boutique-test',
        p_display_name: 'Chez Aïcha',
        p_whatsapp: null,
        p_published: true,
        p_default_location_id: LOCATION_ID,
      },
    });
  });

  it('liste les commandes reçues', async () => {
    const { client, rpcCalls } = makeClient({}, [{ id: ORDER_ID, number: 'CMD-000001', status: 'pending' }]);
    const orders = await directApiFetch<Array<{ number: string }>>(
      `/tenants/${TENANT_ID}/storefront/orders`,
      undefined,
      client,
    );
    expect(rpcCalls[0]!.name).toBe('storefront_orders_list');
    expect(orders[0]?.number).toBe('CMD-000001');
  });

  it('confirme, annule et livre une commande', async () => {
    const confirm = makeClient({}, {});
    await directApiFetch(
      `/tenants/${TENANT_ID}/storefront/orders/${ORDER_ID}/confirm`,
      { method: 'POST', body: JSON.stringify({ location_id: LOCATION_ID }) },
      confirm.client,
    );
    expect(confirm.rpcCalls[0]).toEqual({
      name: 'storefront_confirm_order',
      args: { p_tenant_id: TENANT_ID, p_order_id: ORDER_ID, p_location_id: LOCATION_ID },
    });

    const cancel = makeClient({}, {});
    await directApiFetch(
      `/tenants/${TENANT_ID}/storefront/orders/${ORDER_ID}/cancel`,
      { method: 'POST', body: JSON.stringify({ reason: ' Client injoignable ' }) },
      cancel.client,
    );
    expect(cancel.rpcCalls[0]).toEqual({
      name: 'storefront_cancel_order',
      args: { p_tenant_id: TENANT_ID, p_order_id: ORDER_ID, p_reason: 'Client injoignable' },
    });

    const deliver = makeClient({}, {});
    await directApiFetch(
      `/tenants/${TENANT_ID}/storefront/orders/${ORDER_ID}/delivered`,
      { method: 'POST' },
      deliver.client,
    );
    expect(deliver.rpcCalls[0]).toEqual({
      name: 'storefront_mark_delivered',
      args: { p_tenant_id: TENANT_ID, p_order_id: ORDER_ID },
    });
  });
});
