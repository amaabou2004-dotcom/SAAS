import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { fetchAudienceSummary, type AudienceSummary } from './audience-api';
import { AudiencePage } from './audience-page';

vi.mock('./audience-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./audience-api')>();
  return { ...actual, fetchAudienceSummary: vi.fn() };
});

function summary(overrides: Partial<AudienceSummary> = {}): AudienceSummary {
  return {
    days: 30,
    firstDay: '2026-11-01',
    totals: { views: 42, visitors: 18 },
    today: { views: 7, visitors: 5 },
    yesterday: { views: 4, visitors: 3 },
    daily: [
      { day: '2026-11-04', views: 4, visitors: 3 },
      { day: '2026-11-05', views: 7, visitors: 5 },
    ],
    paths: [
      { path: '/', views: 30 },
      { path: '/b/chez-aicha', views: 12 },
    ],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AudiencePage />
    </QueryClientProvider>,
  );
}

describe('écran Audience', () => {
  beforeEach(() => {
    vi.mocked(fetchAudienceSummary).mockResolvedValue(summary());
  });

  it('affiche les visiteurs du jour et la période', async () => {
    renderPage();

    expect(await screen.findByText('Visiteurs aujourd’hui')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Visiteurs sur 30 jours')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('liste les pages les plus consultées', async () => {
    renderPage();

    expect(await screen.findByText('Pages les plus consultées')).toBeInTheDocument();
    expect(screen.getByText('/b/chez-aicha')).toBeInTheDocument();
  });

  it('explique ce qui est mesuré, sans nommer d’outil interne', async () => {
    const { container } = renderPage();

    expect(await screen.findByText(/Ce qui est mesuré/i)).toBeInTheDocument();
    const texte = (container.textContent ?? '').toLowerCase();
    for (const mot of ['supabase', 'brevo', 'netlify', 'postgres']) {
      expect(texte).not.toContain(mot);
    }
  });

  it('affiche un état vide quand aucune visite n’est encore comptée', async () => {
    vi.mocked(fetchAudienceSummary).mockResolvedValue(
      summary({
        totals: { views: 0, visitors: 0 },
        today: { views: 0, visitors: 0 },
        yesterday: { views: 0, visitors: 0 },
        daily: [],
        paths: [],
        firstDay: null,
      }),
    );

    renderPage();

    expect(await screen.findByText(/Aucune visite enregistrée/i)).toBeInTheDocument();
  });
});
