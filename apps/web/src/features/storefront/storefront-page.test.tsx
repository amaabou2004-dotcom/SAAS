import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { hasPermission } from '../team/team-api';
import { WorkspaceContext } from '../workspace/workspace-context';
import { listLocations, listProducts } from '../workspace/workspace-api';
import {
  cancelStorefrontOrder,
  confirmStorefrontOrder,
  getNotificationSettings,
  getStorefrontSettings,
  listOrderNotifications,
  listStorefrontOrders,
  markStorefrontOrderDelivered,
  saveNotificationSettings,
  saveStorefrontSettings,
  type StorefrontOrder,
  type StorefrontSettings,
} from './storefront-api';
import { StorefrontPage } from './storefront-page';

vi.mock('./storefront-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storefront-api')>();
  return {
    ...actual,
    getStorefrontSettings: vi.fn(),
    saveStorefrontSettings: vi.fn(),
    listStorefrontOrders: vi.fn(),
    confirmStorefrontOrder: vi.fn(),
    cancelStorefrontOrder: vi.fn(),
    markStorefrontOrderDelivered: vi.fn(),
    getNotificationSettings: vi.fn(),
    saveNotificationSettings: vi.fn(),
    listOrderNotifications: vi.fn(),
  };
});

vi.mock('../workspace/workspace-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../workspace/workspace-api')>();
  return { ...actual, listLocations: vi.fn(), listProducts: vi.fn() };
});

vi.mock('../team/team-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../team/team-api')>();
  return { ...actual, hasPermission: vi.fn() };
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

const locationId = '44444444-4444-4444-8444-444444444444';
const orderId = '55555555-5555-4555-8555-555555555555';

const settings: StorefrontSettings = {
  tenant_id: tenant.id,
  slug: 'boutique-test',
  display_name: 'Chez Aïcha',
  whatsapp: '+22790000001',
  published: true,
  default_location_id: locationId,
  public_path: '/b/boutique-test',
  logo_url: null,
  currency_code: 'XOF',
};

const order: StorefrontOrder = {
  id: orderId,
  number: 'CMD-000001',
  status: 'pending',
  customer_name: 'Aïcha Diallo',
  customer_phone: '+22790000002',
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
      variant_id: '33333333-3333-4333-8333-333333333333',
      product_name: 'Eau minérale 1,5 L',
      sku: 'EAU-001',
      unit_price: 400,
      quantity: 2,
      line_total: 800,
    },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <WorkspaceContext.Provider value={{ tenant, accessToken: 'token' }}>
          <StorefrontPage />
        </WorkspaceContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(getStorefrontSettings).mockResolvedValue(settings);
  vi.mocked(saveStorefrontSettings).mockResolvedValue(settings);
  vi.mocked(listStorefrontOrders).mockResolvedValue([order]);
  vi.mocked(listLocations).mockResolvedValue([
    { id: locationId, tenant_id: tenant.id, name: 'Boutique', code: 'BOUT', active: true },
  ]);
  vi.mocked(hasPermission).mockResolvedValue(true);
  vi.mocked(listProducts).mockResolvedValue([]);
  vi.mocked(confirmStorefrontOrder).mockResolvedValue();
  vi.mocked(cancelStorefrontOrder).mockResolvedValue();
  vi.mocked(markStorefrontOrderDelivered).mockResolvedValue();
  vi.mocked(getNotificationSettings).mockResolvedValue({ recipient_email: null, enabled: false, provider_ready: false });
  vi.mocked(saveNotificationSettings).mockResolvedValue({ recipient_email: 'patron@boutique.com', enabled: true, provider_ready: false });
  vi.mocked(listOrderNotifications).mockResolvedValue([]);
});

describe('écran boutique du commerçant', () => {
  it('enregistre l’adresse e-mail prévenue à chaque commande', async () => {
    renderPage();

    const input = await screen.findByLabelText('Adresse e-mail à prévenir');
    await userEvent.type(input, 'patron@boutique.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’alerte' }));

    expect(saveNotificationSettings).toHaveBeenCalledWith('token', tenant.id, {
      recipient_email: 'patron@boutique.com',
      enabled: true,
    });
  });

  it('affiche l’état des dernières alertes e-mail', async () => {
    vi.mocked(listOrderNotifications).mockResolvedValue([
      {
        id: '66666666-6666-4666-8666-666666666666',
        order_id: orderId,
        recipient_email: 'patron@boutique.com',
        subject: 'Nouvelle commande CMD-000001 — Aïcha SARL',
        status: 'sent',
        attempts: 1,
        last_error: null,
        created_at: '2026-11-04T09:00:30.000Z',
        sent_at: '2026-11-04T09:00:45.000Z',
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        order_id: null,
        recipient_email: 'patron@boutique.com',
        subject: 'Nouvelle commande CMD-000002 — Aïcha SARL',
        status: 'pending',
        attempts: 0,
        last_error: null,
        created_at: '2026-11-04T10:00:00.000Z',
        sent_at: null,
      },
    ]);

    renderPage();

    expect(await screen.findByText('Nouvelle commande CMD-000001 — Aïcha SARL')).toBeInTheDocument();
    expect(screen.getByText('Envoyé')).toBeInTheDocument();
    expect(screen.getByText('En attente d’envoi')).toBeInTheDocument();
  });

  it('affiche le lien public et les commandes reçues', async () => {
    renderPage();

    expect(await screen.findByText('Ma boutique en ligne')).toBeInTheDocument();
    expect(await screen.findByText(/\/b\/boutique-test$/)).toBeInTheDocument();
    expect(await screen.findByText('CMD-000001')).toBeInTheDocument();
    expect(screen.getByText('Livrer le matin')).toBeInTheDocument();
    expect(screen.getByText('Eau minérale 1,5 L', { exact: false })).toBeInTheDocument();
  });

  it('confirme une commande avec l’emplacement par défaut', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Confirmer en vente/ }));

    expect(confirmStorefrontOrder).toHaveBeenCalledWith('token', tenant.id, orderId, locationId);
  });

  it('exige un motif avant d’annuler une commande', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Annuler la commande/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));
    expect(
      screen.getByText('Indiquez un motif d’annulation (2 caractères minimum).'),
    ).toBeInTheDocument();
    expect(cancelStorefrontOrder).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Motif (visible dans l’historique)'), 'Client injoignable');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer l’annulation' }));

    expect(cancelStorefrontOrder).toHaveBeenCalledWith('token', tenant.id, orderId, 'Client injoignable');
  });

  it('propose d’ajouter un logo et l’enregistre avec les réglages', async () => {
    renderPage();

    expect(await screen.findByText('Logo de la boutique')).toBeInTheDocument();
    expect(screen.getByText('Ajouter le logo')).toBeInTheDocument();
    expect(screen.getByLabelText('Choisir le logo de la boutique')).toHaveAttribute('accept', 'image/*');

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(saveStorefrontSettings).toHaveBeenCalledWith(
        'token',
        tenant.id,
        expect.objectContaining({ logo_url: null }),
      ),
    );
  });

  it('cache l’enregistrement sans le droit de gérer la boutique', async () => {
    vi.mocked(hasPermission).mockImplementation((_token, _tenantId, permission) =>
      Promise.resolve(permission !== 'stores.manage'),
    );

    renderPage();

    expect(await screen.findByText(/Seul un administrateur/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
    // Le traitement des commandes reste possible avec « sales.manage ».
    expect(screen.getByRole('button', { name: /Confirmer en vente/ })).toBeInTheDocument();
  });
});
