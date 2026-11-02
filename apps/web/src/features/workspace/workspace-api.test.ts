import { listStock, postStockOperation } from './workspace-api';

const tenantId = '4a4d6d39-38cd-4f77-b67e-21ceac76b636';
const variantId = '6c1ee4d1-28f1-4f77-b67e-21ceac76b636';
const locationId = '7c1ee4d1-28f1-4f77-b67e-21ceac76b636';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('workspace API contracts', () => {
  it('sends the bearer token and idempotency key to the stock RPC endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: tenantId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await postStockOperation('access-token', tenantId, {
      operation_type: 'adjustment',
      reason: 'Correction',
      reference: null,
      lines: [{ variant_id: variantId, location_id: locationId, quantity_delta: '-1' }],
    }, 'operation-key-0001');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/tenants/${tenantId}/inventory/operations`);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('Idempotency-Key')).toBe('operation-key-0001');
  });

  it('validates the flat stock view returned by PostgREST', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      tenant_id: tenantId,
      variant_id: variantId,
      location_id: locationId,
      product_id: '8c1ee4d1-28f1-4f77-b67e-21ceac76b636',
      product_name: 'Eau',
      sku: 'EAU-001',
      location_name: 'Dépôt',
      location_code: 'PRINCIPAL',
      on_hand: 4,
      reserved: 1,
      available: 3,
      updated_at: new Date(0).toISOString(),
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await listStock('access-token', tenantId);
    expect(result[0]?.available).toBe(3);
  });
});
