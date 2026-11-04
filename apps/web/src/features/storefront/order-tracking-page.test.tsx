import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrderTrackingPage } from './order-tracking-page';
import { trackShopOrder } from './storefront-api';

vi.mock('./storefront-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storefront-api')>();
  return { ...actual, trackShopOrder: vi.fn() };
});

function renderTracking(path = '/b/boutique-test/suivi?numero=CMD-000001') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/b/:slug/suivi" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('suivi de commande', () => {
  it('affiche l’état d’une commande confirmée', async () => {
    vi.mocked(trackShopOrder).mockResolvedValue({
      number: 'CMD-000001',
      status: 'confirmed',
      item_count: 2,
      total: 800,
      currency_code: 'XOF',
      shop_name: 'Chez Aïcha',
      created_at: '2026-11-04T09:00:00Z',
      confirmed_at: '2026-11-04T09:10:00Z',
      delivered_at: null,
      cancelled_at: null,
      cancel_reason: null,
    });

    renderTracking();

    expect(await screen.findByText('CMD-000001')).toBeInTheDocument();
    expect(screen.getByText('Confirmée')).toBeInTheDocument();
    expect(screen.getByText(/Votre commande est confirmée/)).toBeInTheDocument();
    expect(trackShopOrder).toHaveBeenCalledWith('boutique-test', 'CMD-000001');
  });

  it('explique calmement qu’un numéro est introuvable', async () => {
    vi.mocked(trackShopOrder).mockResolvedValue(null);

    renderTracking('/b/boutique-test/suivi?numero=CMD-999999');

    expect(await screen.findByText(/Aucune commande ne porte ce numéro/)).toBeInTheDocument();
  });
});
