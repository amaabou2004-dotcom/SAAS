import { buildReportCsv, getReport, periodRange, todayInTimezone, type Report } from './reports-api';

const tenantId = '4a4d6d39-38cd-4f77-b67e-21ceac76b636';
const variantId = '6c1ee4d1-28f1-4f77-b67e-21ceac76b636';

const payload: Report = {
  from: '2026-10-06',
  to: '2026-11-04',
  timezone: 'Africa/Niamey',
  totals: { sales: 3, revenue: 7200, cost: 3000, margin: 4200, items: 6, average_basket: 2400 },
  today: { sales: 1, revenue: 2400, margin: 1400 },
  daily: [
    { day: '2026-11-03', sales: 2, revenue: 4800, margin: 2800 },
    { day: '2026-11-04', sales: 1, revenue: 2400, margin: 1400 },
  ],
  top_products: [{
    variant_id: variantId,
    product_name: 'Eau minérale',
    sku: 'EAU-001',
    quantity: 6,
    revenue: 7200,
    margin: 4200,
  }],
  top_categories: [{
    category_id: null,
    category_name: 'Sans catégorie',
    quantity: 6,
    revenue: 7200,
    margin: 4200,
  }],
  dormant: [{
    variant_id: variantId,
    product_name: 'Savon; parfumé',
    sku: 'SAV-1',
    on_hand: 12,
    stock_value: 6000,
    last_sold_at: null,
  }],
  stock_value: 6000,
  product_count: 33,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('contrat des rapports', () => {
  it('envoie la période dans la requête et valide la réponse', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const report = await getReport('token', tenantId, '2026-10-06', '2026-11-04');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/v1/tenants/${tenantId}/reports?from=2026-10-06&to=2026-11-04`,
    );
    expect(report.totals.revenue).toBe(7200);
    expect(report.daily).toHaveLength(2);
  });

  it('refuse une réponse incomplète', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ totals: { sales: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    await expect(getReport('token', tenantId, '2026-10-06', '2026-11-04')).rejects.toThrow();
  });
});

describe('périodes', () => {
  it('calcule la date du jour dans le fuseau de l’entreprise', () => {
    // 23:30 UTC le 3 novembre = déjà le 4 novembre à Niamey (UTC+1).
    expect(todayInTimezone('Africa/Niamey', new Date('2026-11-03T23:30:00Z'))).toBe('2026-11-04');
    expect(todayInTimezone('UTC', new Date('2026-11-03T23:30:00Z'))).toBe('2026-11-03');
  });

  it('construit une période glissante bornes incluses', () => {
    const range = periodRange(30, 'Africa/Niamey', new Date('2026-11-04T10:00:00Z'));
    expect(range.to).toBe('2026-11-04');
    expect(range.from).toBe('2026-10-06');

    const week = periodRange(7, 'Africa/Niamey', new Date('2026-11-04T10:00:00Z'));
    expect(week.from).toBe('2026-10-29');
  });
});

describe('export CSV', () => {
  it('produit un CSV français, séparé par des points-virgules', () => {
    const csv = buildReportCsv(payload);

    expect(csv.split('\n')[0]).toBe('Rapport;du 2026-10-06;au 2026-11-04;fuseau Africa/Niamey');
    expect(csv).toContain('Jour;Ventes;Chiffre d’affaires;Marge');
    expect(csv).toContain('2026-11-04;1;2400;1400');
    expect(csv).toContain('Eau minérale;EAU-001;6;7200;4200');
    expect(csv).toContain('"Savon; parfumé"');
  });
});
