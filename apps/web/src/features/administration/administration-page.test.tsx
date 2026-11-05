import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchPlatformOverview, type PlatformOverview } from './administration-api';
import { AdministrationPage } from './administration-page';

vi.mock('./administration-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./administration-api')>();
  return { ...actual, fetchPlatformOverview: vi.fn() };
});

function overview(overrides: Partial<PlatformOverview> = {}): PlatformOverview {
  return {
    totals: { users: 12, confirmed: 9, tenants: 3, admins: 1, sales: 24 },
    users: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'amaabou2004@gmail.com',
        fullName: 'Amadou Aboubakar',
        createdAt: '2026-11-01T09:00:00.000Z',
        emailConfirmedAt: '2026-11-01T09:05:00.000Z',
        lastSignInAt: '2026-11-05T08:00:00.000Z',
        isAdmin: true,
        companies: [{ name: 'Boutique Aïcha', role: 'Propriétaire', status: 'active' }],
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'commercant@example.test',
        fullName: null,
        createdAt: '2026-11-02T09:00:00.000Z',
        emailConfirmedAt: null,
        lastSignInAt: null,
        isAdmin: false,
        companies: [],
      },
    ],
    tenants: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Boutique Aïcha',
        slug: 'boutique-aicha',
        status: 'active',
        currencyCode: 'XOF',
        createdAt: '2026-11-01T10:00:00.000Z',
        members: 2,
        products: 15,
        sales: 24,
        revenue: 145000,
        firstMemberEmail: 'amaabou2004@gmail.com',
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdministrationPage />
    </QueryClientProvider>,
  );
}

describe('écran Administration', () => {
  beforeEach(() => {
    vi.mocked(fetchPlatformOverview).mockResolvedValue(overview());
  });

  it('affiche les totaux de la plateforme', async () => {
    renderPage();

    expect((await screen.findAllByText('Comptes')).length).toBeGreaterThan(0);
    expect(screen.getByText('Comptes confirmés')).toBeInTheDocument();
    expect(screen.getAllByText('Entreprises').length).toBeGreaterThan(0);
    expect(screen.getByText('Ventes enregistrées')).toBeInTheDocument();
    expect(screen.getByText('Administrateurs')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('liste les comptes avec leur adresse et leurs entreprises', async () => {
    renderPage();

    expect((await screen.findAllByText('amaabou2004@gmail.com')).length).toBeGreaterThan(0);
    expect(screen.getByText('Amadou Aboubakar')).toBeInTheDocument();
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
    expect(screen.getByText('commercant@example.test')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('Aucune entreprise')).toBeInTheDocument();
  });

  it('liste les entreprises avec leurs chiffres', async () => {
    renderPage();

    expect((await screen.findAllByText('Boutique Aïcha')).length).toBeGreaterThan(0);
    expect(screen.getByText('/b/boutique-aicha · créée le 1 nov. 2026')).toBeInTheDocument();
    expect(screen.getByText('145 000 F CFA')).toBeInTheDocument();
  });

  it('relance la recherche avec le texte saisi', async () => {
    const user = userEvent.setup();
    renderPage();

    const champ = await screen.findByLabelText('Rechercher un compte ou une entreprise');
    await user.type(champ, 'aicha');
    await user.click(screen.getByRole('button', { name: /rechercher/i }));

    expect(fetchPlatformOverview).toHaveBeenLastCalledWith('aicha');
  });

  it('rappelle la portée de l’écran (isolation des entreprises)', async () => {
    renderPage();

    expect(await screen.findByText(/Portée de cet écran/i)).toBeInTheDocument();
    expect(
      screen.getByText(/reste isolé par entreprise/i),
    ).toBeInTheDocument();
  });
});
