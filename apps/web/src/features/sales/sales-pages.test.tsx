import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '../workspace/workspace-context';
import { listLocations, listProducts, listStock } from '../workspace/workspace-api';
import { createSale, getSale, listSales, voidSale } from './sales-api';
import { NewSalePage } from './new-sale-page';
import { SalesPage } from './sales-page';

vi.mock('../workspace/workspace-api', () => ({
  listLocations: vi.fn(),
  listProducts: vi.fn(),
  listStock: vi.fn(),
}));

vi.mock('./sales-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sales-api')>();
  return {
    ...actual,
    createSale: vi.fn(),
    getSale: vi.fn(),
    listSales: vi.fn(),
    voidSale: vi.fn(),
  };
});

const tenant = {
  id: '4a4d6d39-38cd-4e1f-b1f0-c8d7ef8edbd0',
  name: 'Boutique test',
  slug: 'boutique-test',
  currency_code: 'XOF',
  timezone: 'Africa/Niamey',
  status: 'active' as const,
  created_at: new Date(0).toISOString(),
};
const productId = '5c1ee4d1-28f1-4f77-b67e-21ceac76b636';
const variantId = '6c1ee4d1-28f1-4f77-b67e-21ceac76b636';
const locationId = '7c1ee4d1-28f1-4f77-b67e-21ceac76b636';
const saleId = '8c1ee4d1-28f1-4f77-b67e-21ceac76b636';
const itemId = '9c1ee4d1-28f1-4f77-b67e-21ceac76b636';

const location = { id: locationId, tenant_id: tenant.id, name: 'Boutique', code: 'BTQ', active: true };
const product = {
  id: productId,
  tenant_id: tenant.id,
  category_id: null,
  name: 'Eau minérale',
  description: null,
  sale_price: 1200,
  cost_price: 500,
  active: true,
  category: null,
  variants: [{
    id: variantId,
    tenant_id: tenant.id,
    product_id: productId,
    sku: 'EAU-001',
    barcode: null,
    attributes: {},
    active: true,
  }],
};
const stockRow = {
  tenant_id: tenant.id,
  variant_id: variantId,
  location_id: locationId,
  product_id: productId,
  product_name: 'Eau minérale',
  sku: 'EAU-001',
  location_name: 'Boutique',
  location_code: 'BTQ',
  on_hand: 5,
  reserved: 0,
  available: 5,
  updated_at: new Date(0).toISOString(),
};
const sale = {
  id: saleId,
  tenant_id: tenant.id,
  number: 'VTE-000001',
  status: 'completed' as const,
  location_id: locationId,
  location_name: 'Boutique',
  payment_method: 'cash' as const,
  payment_reference: null,
  customer_name: null,
  note: null,
  subtotal: 2400,
  total: 2400,
  total_cost: 1000,
  margin: 1400,
  item_count: 1,
  created_at: new Date().toISOString(),
  voided_at: null,
};
const saleDetail = {
  ...sale,
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

function renderWithWorkspace(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ tenant, accessToken: 'user-token' }}>
          {children}
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listLocations).mockResolvedValue([location]);
  vi.mocked(listProducts).mockResolvedValue([product]);
  vi.mocked(listStock).mockResolvedValue([stockRow]);
  vi.mocked(listSales).mockResolvedValue([sale]);
  vi.mocked(getSale).mockResolvedValue(saleDetail);
  vi.mocked(createSale).mockResolvedValue(saleDetail);
  vi.mocked(voidSale).mockResolvedValue({ ...saleDetail, status: 'voided', voided_at: new Date().toISOString() });
});

describe('page Ventes', () => {
  it('affiche les ventes du jour et ouvre le ticket', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<SalesPage />);

    expect(await screen.findByText('VTE-000001')).toBeInTheDocument();
    expect(screen.getByText('Ventes du jour')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Détails/ }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('EAU-001')).toBeInTheDocument();
    expect(getSale).toHaveBeenCalledWith('user-token', tenant.id, saleId);
  });

  it('exige un motif avant d’annuler une vente', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<SalesPage />);

    await user.click(await screen.findByRole('button', { name: /Détails/ }));
    await user.click(await screen.findByRole('button', { name: 'Confirmer l’annulation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/motif de l’annulation/i);
    expect(voidSale).not.toHaveBeenCalled();
  });
});

describe('page Nouvelle vente', () => {
  it('compose un panier et encaisse avec une clé d’idempotence', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<NewSalePage />);

    await screen.findByText(/dispo/);
    await user.click(await screen.findByRole('button', { name: 'Ajouter Eau minérale' }));
    await user.click(screen.getByRole('button', { name: 'Augmenter Eau minérale' }));

    await user.click(screen.getByRole('button', { name: /Encaisser/ }));

    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1));
    const [token, tenantId, input, key] = vi.mocked(createSale).mock.calls[0]!;
    expect(token).toBe('user-token');
    expect(tenantId).toBe(tenant.id);
    expect(input).toMatchObject({
      location_id: locationId,
      payment_method: 'cash',
      items: [{ variant_id: variantId, quantity: 2, unit_price: 1200 }],
    });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);

    expect(await screen.findByText('VTE-000001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouvelle vente/ })).toBeInTheDocument();
  });

  it('exige la référence Mobile Money', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<NewSalePage />);

    await user.click(await screen.findByRole('button', { name: 'Ajouter Eau minérale' }));
    await user.selectOptions(screen.getByLabelText('Moyen de paiement'), 'mobile_money');
    await user.click(screen.getByRole('button', { name: /Encaisser/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/référence Mobile Money/i);
    expect(createSale).not.toHaveBeenCalled();
  });
});
