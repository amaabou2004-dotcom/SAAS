import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  loading: false,
  session: null as { access_token: string } | null,
  user: null as { email: string; email_confirmed_at: string | null } | null,
  signOut: vi.fn(),
  clearPendingEmail: vi.fn(),
}));

vi.mock('./auth-context', () => ({
  useAuth: () => ({ loading: mocks.loading, session: mocks.session, user: mocks.user }),
}));

vi.mock('./auth-service', () => ({
  signOut: mocks.signOut,
}));

vi.mock('./pending-email', () => ({
  clearPendingEmail: mocks.clearPendingEmail,
}));

import { AuthCallbackPage } from './auth-callback-page';

function renderCallback(entry = '/auth/callback?code=oauth-callback') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/onboarding" element={<div>Onboarding OAuth de test</div>} />
        <Route path="/auth/connexion" element={<div>Connexion de test</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loading = false;
    mocks.session = null;
    mocks.user = null;
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('opens onboarding when Google returned a verified session', async () => {
    mocks.session = { access_token: 'session' };
    mocks.user = { email: 'commercant@gmail.com', email_confirmed_at: '2026-11-01T19:00:00Z' };

    renderCallback();

    expect(await screen.findByText('Onboarding OAuth de test')).toBeInTheDocument();
    await waitFor(() => expect(mocks.clearPendingEmail).toHaveBeenCalledOnce());
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it('rejects and signs out an unverified OAuth session', async () => {
    mocks.session = { access_token: 'unexpected-session' };
    mocks.user = { email: 'commercant@gmail.com', email_confirmed_at: null };

    renderCallback();

    expect(await screen.findByText('Google n’a pas confirmé votre adresse e-mail. La connexion a été refusée.')).toBeInTheDocument();
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(screen.queryByText('Onboarding OAuth de test')).not.toBeInTheDocument();
  });

  it('explains a cancelled Google authorization', async () => {
    renderCallback('/auth/callback?error=access_denied');

    expect(await screen.findByText('La connexion Google a été annulée. Vous pouvez réessayer.')).toBeInTheDocument();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
