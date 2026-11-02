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
