import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getReport, type Report } from '../reports/reports-api';
import { getStorefrontSettings, listStorefrontOrders, type StorefrontOrder, type StorefrontSettings } from '../storefront/storefront-api';
import { listProducts, listStock, type Product } from '../workspace/workspace-api';
import { WorkspaceContext } from '../workspace/workspace-context';
import { DashboardPage } from './dashboard-page';

vi.mock('../reports/reports-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../reports/reports-api')>();
  return { ...actual, getReport: vi.fn() };
});

vi.mock('../workspace/workspace-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../workspace/workspace-api')>();
  return { ...actual, listStock: vi.fn(), listProducts: vi.fn() };
});

vi.mock('../storefront/storefront-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storefront/storefront-api')>();
  return { ...actual, listStorefrontOrders: vi.fn(), getStorefrontSettings: vi.fn() };
});

const tenant = {
  id: '0969579a-c676-4542-b846-d9df6235f6e6',
  name: 'Aïcha SARL',
  slug: 'aicha-sarl',
  currency_code: 'XOF',
  timezone: 'Africa/Niamey',
  status: 'active' as const,
  created_at: new Date(0).toISOString(),
};

const variantId = '33333333-3333-4333-8333-333333333333';
const locationId = '44444444-4444-4444-8444-444444444444';

const report: Report = {
  from: '2026-11-04',
  to: '2026-11-04',
  timezone: 'Africa/Niamey',
  totals: { sales: 2, revenue: 4800, cost: 2000, margin: 2800, items: 3, average_basket: 2400 },
  today: { sales: 2, revenue: 4800, margin: 2800 },
  daily: [{ day: '2026-11-04', sales: 2, revenue: 4800, margin: 2800 }],
  top_products: [],
  top_categories: [],
  dormant: [],
  stock_value: 125000,
  product_count: 33,
};

const stockRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  tenant_id: tenant.id,
  variant_id: variantId,
  location_id: locationId,
  product_id: '22222222-2222-4222-8222-222222222222',
  product_name: 'Savon parfumé',
  sku: 'SAV-001',
  location_name: 'Boutique',
  location_code: 'BOUT',
  on_hand: 0,
  reserved: 0,
  available: 0,
  updated_at: '2026-11-04T09:00:00Z',
  ...overrides,
});

const order = (status: StorefrontOrder['status'], id: string): StorefrontOrder => ({
  id,
  number: 'CMD-000001',
  status,
  customer_name: 'Aïcha',
  customer_phone: '+22790000001',
  note: null,
  subtotal: 800,
  total: 800,
  item_count: 1,
  sale_id: null,
  cancel_reason: null,
  created_at: '2026-11-04T09:00:00Z',
  confirmed_at: null,
  delivered_at: null,
  cancelled_at: null,
  items: [],
});

const product: Product = {
  id: '22222222-2222-4222-8222-222222222222',
  tenant_id: tenant.id,
  category_id: null,
  name: 'Savon parfumé',
  description: null,
  sale_price: 250,
  cost_price: 0,
  active: true,
  image_url: null,
  category: null,
  variants: [],
};

const shopSettings: StorefrontSettings = {
  tenant_id: tenant.id,
  slug: 'aicha-sarl',
  display_name: 'Aïcha SARL',
  whatsapp: null,
  published: true,
  default_location_id: locationId,
  public_path: '/b/aicha-sarl',
  logo_url: null,
  currency_code: 'XOF',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ tenant, accessToken: 'token' }}>
          <DashboardPage />
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getReport).mockResolvedValue(report);
  vi.mocked(listProducts).mockResolvedValue([product]);
  vi.mocked(getStorefrontSettings).mockResolvedValue(shopSettings);
  vi.mocked(listStock).mockResolvedValue([stockRow()]);
  vi.mocked(listStorefrontOrders).mockResolvedValue([
    order('pending', '55555555-5555-4555-8555-555555555555'),
    order('confirmed', '66666666-6666-4666-8666-666666666666'),
  ]);
});

describe('accueil du commerçant', () => {
  it('affiche les chiffres du jour, les commandes et les ruptures', async () => {
    renderPage();

    expect(await screen.findByText('Bonjour, Aïcha SARL')).toBeInTheDocument();
    expect(await screen.findByText(/4\s?800/)).toBeInTheDocument();
    expect(await screen.findByText('commande(s) à confirmer')).toBeInTheDocument();
    expect(await screen.findByText('Savon parfumé')).toBeInTheDocument();
    expect(screen.getByText('À réapprovisionner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nouvelle vente/ })).toHaveAttribute(
      'href',
      '/workspace/ventes/nouvelle',
    );
  });

  it('guide le commerçant tant que le parcours de départ n’est pas fini', async () => {
    vi.mocked(listProducts).mockResolvedValue([]);
    vi.mocked(listStock).mockResolvedValue([]);
    vi.mocked(getStorefrontSettings).mockResolvedValue({ ...shopSettings, published: false });

    renderPage();

    expect(await screen.findByText('Vos premiers pas · 0/3 fait')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: 'Ajoutez un produit' });
    const guide = heading.closest('section');
    expect(guide).not.toBeNull();
    expect(within(guide as HTMLElement).getByRole('link', { name: /Ajouter un produit/ })).toHaveAttribute(
      'href',
      '/workspace/produits',
    );
  });

  it('reste sur « ouvrir la boutique » quand les produits et le stock sont prêts', async () => {
    vi.mocked(listStock).mockResolvedValue([stockRow({ available: 12, on_hand: 12 })]);
    vi.mocked(getStorefrontSettings).mockResolvedValue({ ...shopSettings, published: false });

    renderPage();

    expect(await screen.findByText('Vos premiers pas · 2/3 fait')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ouvrez votre boutique en ligne' })).toBeInTheDocument();
  });

  it('masque le parcours une fois tout terminé', async () => {
    vi.mocked(listStock).mockResolvedValue([stockRow({ available: 12, on_hand: 12 })]);

    renderPage();

    expect(await screen.findByText(/4\s?800/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Vos premiers pas/)).not.toBeInTheDocument());
  });

  it('signale l’absence de chiffres sans bloquer le reste', async () => {
    vi.mocked(getReport).mockRejectedValue(new Error('Votre session ne permet pas cette opération.'));

    renderPage();

    expect(await screen.findByText(/nécessitent le droit de lire les ventes/)).toBeInTheDocument();
    // Les commandes restent visibles.
    expect(await screen.findByText(/commande\(s\) à confirmer/)).toBeInTheDocument();
  });

  it('n’affiche aucune rupture quand tout le stock est disponible', async () => {
    vi.mocked(listStock).mockResolvedValue([stockRow({ available: 12, on_hand: 12 })]);

    renderPage();

    expect(await screen.findByText('Bonjour, Aïcha SARL')).toBeInTheDocument();
    expect(screen.queryByText('À réapprovisionner')).not.toBeInTheDocument();
  });
});
