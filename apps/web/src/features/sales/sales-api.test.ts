import { createSale, getSale, listSales, voidSale } from './sales-api';

const tenantId = '4a4d6d39-38cd-4f77-b67e-21ceac76b636';
const saleId = '5b4d6d39-38cd-4f77-b67e-21ceac76b636';
const variantId = '6c1ee4d1-28f1-4f77-b67e-21ceac76b636';
const locationId = '7c1ee4d1-28f1-4f77-b67e-21ceac76b636';
const itemId = '8c1ee4d1-28f1-4f77-b67e-21ceac76b636';

const salePayload = {
  id: saleId,
  tenant_id: tenantId,
  number: 'VTE-000001',
  status: 'completed',
  location_id: locationId,
  location_name: 'Boutique',
  payment_method: 'cash',
  payment_reference: null,
  customer_name: null,
  note: null,
  subtotal: 2400,
  total: 2400,
  total_cost: 1000,
  margin: 1400,
  item_count: 1,
  created_at: new Date(0).toISOString(),
  voided_at: null,
  items: [{
    id: itemId,
    sale_id: saleId,
    variant_id: variantId,
    product_name: 'Eau minérale',
    sku: 'EAU-001',
    unit_price: 1200,
    unit_cost: 500,
    quantity: 2,
    line_total: 2400,
  }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function requestBody(init?: RequestInit): Record<string, unknown> {
  return typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
}

function mockJson(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('API des ventes', () => {
  it('envoie la vente avec le jeton et la clé d’idempotence', async () => {
    const fetchMock = mockJson(salePayload);

    const sale = await createSale('access-token', tenantId, {
      location_id: locationId,
      payment_method: 'cash',
      payment_reference: null,
      customer_name: 'Aïcha',
      note: null,
      items: [{ variant_id: variantId, quantity: 2, unit_price: 1200 }],
    }, 'vente-cle-0001');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/tenants/${tenantId}/sales`);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('Idempotency-Key')).toBe('vente-cle-0001');
    expect(requestBody(init)).toMatchObject({
      location_id: locationId,
      payment_method: 'cash',
      items: [{ variant_id: variantId, quantity: 2, unit_price: 1200 }],
    });
    expect(sale.number).toBe('VTE-000001');
    expect(sale.items[0]?.line_total).toBe(2400);
  });

  it('annule une vente avec un motif et une clé dédiée', async () => {
    const fetchMock = mockJson({ ...salePayload, status: 'voided', voided_at: new Date(0).toISOString() });

    const sale = await voidSale('access-token', tenantId, saleId, 'Erreur de saisie', 'annulation-cle-1');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/tenants/${tenantId}/sales/${saleId}/void`);
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('annulation-cle-1');
    expect(requestBody(init)).toEqual({ reason: 'Erreur de saisie' });
    expect(sale.status).toBe('voided');
  });

  it('relit la liste et le détail avec les montants numériques', async () => {
    mockJson([salePayload]);

    const sales = await listSales('access-token', tenantId);
    expect(sales).toHaveLength(1);
    expect(sales[0]?.total).toBe(2400);

    const fetchMock = mockJson(salePayload);
    const detail = await getSale('access-token', tenantId, saleId);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/tenants/${tenantId}/sales/${saleId}`);
    expect(detail.items).toHaveLength(1);
  });

  it('refuse une vente incomplète envoyée par le serveur', async () => {
    mockJson({ ...salePayload, total: 'deux mille' });

    await expect(
      createSale('access-token', tenantId, {
        location_id: locationId,
        payment_method: 'cash',
        payment_reference: null,
        customer_name: null,
        note: null,
        items: [{ variant_id: variantId, quantity: 1 }],
      }, 'vente-cle-0002'),
    ).rejects.toThrow();
  });
});
