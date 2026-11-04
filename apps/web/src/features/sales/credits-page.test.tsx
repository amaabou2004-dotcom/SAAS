import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '../workspace/workspace-context';
import { CreditsPage } from './credits-page';
import { addCreditPayment, listCreditSales } from './sales-api';

vi.mock('./sales-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sales-api')>();
  return { ...actual, listCreditSales: vi.fn(), addCreditPayment: vi.fn() };
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

const saleId = '11111111-1111-4111-8111-111111111111';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceContext.Provider value={{ tenant, accessToken: 'token' }}>
          <CreditsPage />
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listCreditSales).mockResolvedValue([
    {
      id: saleId,
      number: 'VTE-000012',
      customer_name: 'Fatou',
      total: 10000,
      paid: 4000,
      remaining: 6000,
      created_at: '2026-11-04T09:00:00Z',
    },
  ]);
  vi.mocked(addCreditPayment).mockResolvedValue({ sale_id: saleId, paid: 10000, remaining: 0 });
});

describe('crédits', () => {
  it('affiche le reste à encaisser et le nom du client', async () => {
    renderPage();

    expect(await screen.findByText('Fatou')).toBeInTheDocument();
    expect(screen.getByText('VTE-000012 · 4 nov. 2026')).toBeInTheDocument();
    expect(screen.getByText('Reste à encaisser')).toBeInTheDocument();
    expect(screen.getByText('Encaisser le reste')).toBeInTheDocument();
  });

  it('encaisse un règlement partiel sur la vente choisie', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Encaisser le reste' }));
    const montant = screen.getByLabelText('Montant reçu');
    await user.clear(montant);
    await user.type(montant, '3000');
    await user.click(screen.getByRole('button', { name: /Enregistrer le règlement/ }));

    await waitFor(() =>
      expect(addCreditPayment).toHaveBeenCalledWith('token', tenant.id, saleId, {
        amount: 3000,
        method: 'cash',
        reference: null,
      }),
    );
  });
});
