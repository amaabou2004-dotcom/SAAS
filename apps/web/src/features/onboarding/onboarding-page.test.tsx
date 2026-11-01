import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OnboardingPage } from './onboarding-page';
import { createTenant, listTenants } from './tenant-api';
import { useAuth } from '../auth/auth-context';

vi.mock('./tenant-api', () => ({
  createTenant: vi.fn(),
  listTenants: vi.fn(),
}));

vi.mock('../auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../auth/auth-service', () => ({
  signOut: vi.fn(),
}));

const tenant = {
  id: '6c1ee4d1-28f1-4f77-b67e-21ceac76b636',
  name: 'Boutique test',
  slug: 'boutique-test',
  currency_code: 'XOF' as const,
  timezone: 'Africa/Niamey',
  status: 'active' as const,
  created_at: '2026-11-01T12:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      session: { access_token: 'user-token' },
      user: { id: 'user-id', email: 'owner@example.test' },
      loading: false,
      configured: true,
    } as never);
    vi.mocked(createTenant).mockResolvedValue(tenant);
  });

  it('waits for the refreshed tenant list before opening the workspace', async () => {
    const refreshed = deferred<typeof tenant[]>();
    vi.mocked(listTenants)
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => refreshed.promise);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/workspace" element={<div>Workspace ouvert</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(await screen.findByLabelText('Nom de l’entreprise'), tenant.name);
    await user.type(screen.getByLabelText('Identifiant de l’espace'), tenant.slug);
    await user.click(screen.getByRole('button', { name: 'Créer mon entreprise' }));

    await waitFor(() => expect(createTenant).toHaveBeenCalled());
    await waitFor(() => expect(listTenants).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Workspace ouvert')).not.toBeInTheDocument();

    refreshed.resolve([tenant]);
    expect(await screen.findByText('Workspace ouvert')).toBeInTheDocument();
  });
});
