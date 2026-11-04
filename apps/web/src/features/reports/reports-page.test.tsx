import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { WorkspaceContext } from '../workspace/workspace-context';
import { getReport, type Report } from './reports-api';
import { ReportsPage } from './reports-page';

vi.mock('./reports-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reports-api')>();
  return { ...actual, getReport: vi.fn() };
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
const variantId = '6c1ee4d1-28f1-4f77-b67e-21ceac76b636';

const report: Report = {
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
    product_name: 'Savon',
    sku: 'SAV-1',
    on_hand: 12,
    stock_value: 6000,
    last_sold_at: null,
  }],
  stock_value: 6000,
  product_count: 33,
};

function renderWithWorkspace(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={{ tenant, accessToken: 'user-token' }}>
        {children}
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getReport).mockResolvedValue(report);
});

describe('page Rapports', () => {
  it('affiche les indicateurs, les produits et les produits dormants', async () => {
    renderWithWorkspace(<ReportsPage />);

    expect(await screen.findByText('Eau minérale')).toBeInTheDocument();
    expect(screen.getByText('Encaissé aujourd’hui')).toBeInTheDocument();
    expect(screen.getByText('Capital immobilisé')).toBeInTheDocument();
    expect(screen.getByText('Sans catégorie')).toBeInTheDocument();
    expect(screen.getByText('Savon')).toBeInTheDocument();
    expect(screen.getAllByText(/jamais vendu/).length).toBeGreaterThan(0);
  });

  it('recharge le rapport quand on change de période', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<ReportsPage />);

    await screen.findByText('Eau minérale');
    expect(getReport).toHaveBeenCalledTimes(1);
    const firstCall = vi.mocked(getReport).mock.calls[0]!;
    expect(firstCall[0]).toBe('user-token');
    expect(firstCall[1]).toBe(tenant.id);

    await user.click(screen.getByRole('button', { name: '7 jours' }));

    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(2));
    const secondCall = vi.mocked(getReport).mock.calls[1]!;
    const daysBetween =
      (new Date(`${secondCall[3]}T00:00:00Z`).getTime() - new Date(`${secondCall[2]}T00:00:00Z`).getTime()) /
      86_400_000;
    expect(daysBetween).toBe(6);
    expect(screen.getByRole('button', { name: '7 jours' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('active l’export CSV seulement quand le rapport est chargé', async () => {
    vi.mocked(getReport).mockRejectedValue(new Error('Vous n’avez pas accès aux rapports de cette entreprise.'));
    renderWithWorkspace(<ReportsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/pas accès aux rapports/i);
    expect(screen.getByRole('button', { name: /Exporter en CSV/ })).toBeDisabled();
  });
});
