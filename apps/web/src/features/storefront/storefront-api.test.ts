import {
  cancelStorefrontOrder,
  confirmStorefrontOrder,
  getShopCatalog,
  getShopInfo,
  getStorefrontSettings,
  isValidSlug,
  listStorefrontOrders,
  markStorefrontOrderDelivered,
  placeShopOrder,
  publicShopUrl,
  saveStorefrontSettings,
  slugify,
  whatsappShareUrl,
} from './storefront-api';

const tenantId = '0969579a-c676-4542-b846-d9df6235f6e6';
const variantId = '33333333-3333-4333-8333-333333333333';
const orderId = '55555555-5555-4555-8555-555555555555';
const locationId = '44444444-4444-4444-8444-444444444444';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(payload: unknown) {
  // Une réponse neuve par appel : un `Response` ne peut être lu qu'une fois.
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(json(payload)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Corps JSON d'une requête capturée par le faux `fetch`. */
function bodyOf(init: RequestInit | undefined): unknown {
  const body = init?.body;
  return typeof body === 'string' ? JSON.parse(body) : null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adresse de boutique', () => {
  it('transforme un nom en adresse valide', () => {
    expect(slugify('Chez Aïcha — Épicerie')).toBe('chez-aicha-epicerie');
    expect(slugify('  --Boutique  2026--  ')).toBe('boutique-2026');
    expect(isValidSlug('boutique-2026')).toBe(true);
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('Boutique')).toBe(false);
    expect(isValidSlug('boutique-')).toBe(false);
  });

  it('construit le lien public et le message WhatsApp', () => {
    expect(publicShopUrl('chez-aicha', 'https://stokari.app')).toBe('https://stokari.app/b/chez-aicha');
    expect(whatsappShareUrl('Bonjour', '+227 90 00 00 01')).toBe(
      `https://wa.me/22790000001?text=${encodeURIComponent('Bonjour')}`,
    );
    expect(whatsappShareUrl('Bonjour')).toBe(`https://wa.me/?text=${encodeURIComponent('Bonjour')}`);
  });
});

describe('boutique publique', () => {
  it('charge les informations sans jeton', async () => {
    const fetchMock = stubFetch({
      slug: 'boutique-test',
      display_name: 'Chez Aïcha',
      whatsapp: '+22790000001',
      currency_code: 'XOF',
      timezone: 'Africa/Niamey',
      tenant_name: 'Aïcha SARL',
    });

    const info = await getShopInfo('boutique-test');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/shop/boutique-test');
    expect(info?.display_name).toBe('Chez Aïcha');
    const headers = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ');
  });

  it('renvoie null quand la boutique est fermée', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(json(null)));
    await expect(getShopInfo('boutique-test')).resolves.toBeNull();
  });

  it('valide le catalogue', async () => {
    stubFetch([
      {
        product_id: '22222222-2222-4222-8222-222222222222',
        variant_id: variantId,
        name: 'Eau minérale 1,5 L',
        description: null,
        sku: 'EAU-001',
        category_name: 'Boissons',
        unit_price: 400,
        available: 12,
        currency_code: 'XOF',
      },
    ]);

    const catalog = await getShopCatalog('boutique-test');
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.unit_price).toBe(400);
  });

  it('envoie une commande avec une clé d’idempotence et sans prix', async () => {
    const fetchMock = stubFetch({
      id: orderId,
      number: 'CMD-000001',
      total: 800,
      item_count: 2,
      status: 'pending',
    });

    const receipt = await placeShopOrder(
      'boutique-test',
      {
        customer_name: 'Aïcha',
        customer_phone: '+22790000001',
        note: null,
        items: [{ variant_id: variantId, quantity: 2 }],
      },
      'cle-commande-0001',
    );

    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/v1/shop/boutique-test/orders');
    expect(init?.method).toBe('POST');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('cle-commande-0001');
    expect(bodyOf(init)).toStrictEqual({
      customer_name: 'Aïcha',
      customer_phone: '+22790000001',
      note: null,
      items: [{ variant_id: variantId, quantity: 2 }],
    });
    expect(receipt.number).toBe('CMD-000001');
  });
});

describe('boutique côté commerçant', () => {
  it('lit et enregistre les réglages', async () => {
    const settings = {
      tenant_id: tenantId,
      slug: 'boutique-test',
      display_name: 'Chez Aïcha',
      whatsapp: null,
      published: true,
      default_location_id: locationId,
      public_path: '/b/boutique-test',
      currency_code: 'XOF',
    };
    const fetchMock = stubFetch(settings);

    const loaded = await getStorefrontSettings('token', tenantId);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/tenants/${tenantId}/storefront`);
    expect(loaded.published).toBe(true);

    await saveStorefrontSettings('token', tenantId, {
      slug: 'boutique-test',
      display_name: 'Chez Aïcha',
      whatsapp: null,
      published: false,
      default_location_id: null,
    });
    const [path, init] = fetchMock.mock.calls[1] ?? [];
    expect(path).toBe(`/api/v1/tenants/${tenantId}/storefront`);
    expect(init?.method).toBe('POST');
    expect(bodyOf(init)).toMatchObject({ slug: 'boutique-test', published: false });
  });

  it('valide la liste des commandes', async () => {
    stubFetch([
      {
        id: orderId,
        number: 'CMD-000001',
        status: 'pending',
        customer_name: 'Aïcha',
        customer_phone: '+22790000001',
        note: 'Livrer le matin',
        subtotal: 800,
        total: 800,
        item_count: 2,
        sale_id: null,
        cancel_reason: null,
        created_at: '2026-11-04T09:00:00.000Z',
        confirmed_at: null,
        delivered_at: null,
        cancelled_at: null,
        items: [
          {
            variant_id: variantId,
            product_name: 'Eau minérale',
            sku: 'EAU-001',
            unit_price: 400,
            quantity: 2,
            line_total: 800,
          },
        ],
      },
    ]);

    const orders = await listStorefrontOrders('token', tenantId);
    expect(orders[0]?.items[0]?.product_name).toBe('Eau minérale');
    expect(orders[0]?.status).toBe('pending');
  });

  it('appelle les routes de traitement des commandes', async () => {
    const fetchMock = stubFetch({ ok: true });

    await confirmStorefrontOrder('token', tenantId, orderId, locationId);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/tenants/${tenantId}/storefront/orders/${orderId}/confirm`);
    expect(bodyOf(fetchMock.mock.calls[0]?.[1])).toStrictEqual({ location_id: locationId });

    await cancelStorefrontOrder('token', tenantId, orderId, 'Client injoignable');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/v1/tenants/${tenantId}/storefront/orders/${orderId}/cancel`);
    expect(bodyOf(fetchMock.mock.calls[1]?.[1])).toStrictEqual({ reason: 'Client injoignable' });

    await markStorefrontOrderDelivered('token', tenantId, orderId);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`/api/v1/tenants/${tenantId}/storefront/orders/${orderId}/delivered`);
  });
});
