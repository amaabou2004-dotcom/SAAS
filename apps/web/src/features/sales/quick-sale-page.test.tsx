import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '../workspace/workspace-context';
import { listLocations, listProducts, listStock, type Product } from '../workspace/workspace-api';
import { QuickSalePage } from './quick-sale-page';
import { createSale, type SaleDetail } from './sales-api';

vi.mock('../workspace/workspace-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../workspace/workspace-api')>();
  return { ...actual, listProducts: vi.fn(), listStock: vi.fn(), listLocations: vi.fn() };
});

vi.mock('./sales-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sales-api')>();
  return { ...actual, createSale: vi.fn() };
});

const tenant = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'ABCHDD',
  slug: 'abchdd',
  currency_code: 'XOF',
  timezone: 'Africa/Niamey',
  status: 'active' as const,
  created_at: new Date(0).toISOString(),
};

const variantId = '55555555-5555-4555-8555-555555555555';
const locationId = '33333333-3333-4333-8333-333333333333';

const product: Product = {
  id: '44444444-4444-4444-8444-444444444444',
  tenant_id: tenant.id,
  category_id: null,
  name: 'Bague argent',
  description: null,
  sale_price: 2000,
  cost_price: 1000,
  active: true,
  image_url: null,
  category: null,
  variants: [
    {
      id: variantId,
      tenant_id: tenant.id,
      product_id: '44444444-4444-4444-8444-444444444444',
      sku: 'BAG-001',
      barcode: null,
      attributes: {},
      active: true,
    },
  ],
};

const sold: SaleDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: tenant.id,
  number: 'V-000001',
  status: 'completed',
  location_id: locationId,
  location_name: 'Boutique',
  payment_method: 'cash',
  payment_reference: null,
  customer_name: null,
  note: null,
  subtotal: 2000,
  total: 2000,
  total_cost: 1000,
  margin: 1000,
  item_count: 1,
  created_at: '2026-11-04T10:30:00Z',
  voided_at: null,
  items: [
    {
      id: '88888888-8888-4888-8888-888888888888',
      sale_id: '11111111-1111-4111-8111-111111111111',
      variant_id: variantId,
      product_name: 'Bague argent',
      sku: 'BAG-001',
      unit_price: 2000,
      unit_cost: 1000,
      quantity: 1,
      line_total: 2000,
    },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ tenant, accessToken: 'token' }}>
          <QuickSalePage />
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listProducts).mockResolvedValue([product]);
  vi.mocked(listLocations).mockResolvedValue([
    { id: locationId, tenant_id: tenant.id, name: 'Boutique', code: 'BOUT', active: true },
  ]);
  vi.mocked(listStock).mockResolvedValue([
    {
      tenant_id: tenant.id,
      variant_id: variantId,
      location_id: locationId,
      product_id: product.id,
      product_name: product.name,
      sku: 'BAG-001',
      location_name: 'Boutique',
      location_code: 'BOUT',
      on_hand: 5,
      reserved: 0,
      available: 5,
      updated_at: new Date(0).toISOString(),
    },
  ]);
  vi.mocked(createSale).mockResolvedValue(sold);
});

describe('caisse rapide', () => {
  it('ajoute un produit d’un seul toucher puis l’encaisse', async () => {
    const user = userEvent.setup();
    renderPage();

    const tile = await screen.findByRole('button', { name: /Ajouter Bague argent/ });
    await user.click(tile);

    expect(screen.getByText('reste 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Encaisser/ }));

    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1));
    const input = vi.mocked(createSale).mock.calls[0]![2];
    expect(input.location_id).toBe(locationId);
    expect(input.payment_method).toBe('cash');
    expect(input.items).toEqual([{ variant_id: variantId, quantity: 1, unit_price: 2000 }]);
  });

  it('propose d’envoyer le reçu sur WhatsApp une fois la vente faite', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Ajouter Bague argent/ }));
    await user.click(screen.getByRole('button', { name: /Encaisser/ }));

    const link = await screen.findByRole('link', { name: /Envoyer le reçu sur WhatsApp/ });
    expect(link.getAttribute('href')).toContain('https://wa.me/');
    expect(screen.getByText(/Vente V-000001 enregistrée/)).toBeInTheDocument();
  });
});
