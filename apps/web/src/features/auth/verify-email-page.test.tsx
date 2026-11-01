import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  user: null as { email: string; email_confirmed_at: string | null } | null,
  clearPendingEmail: vi.fn(),
  readPendingEmail: vi.fn(),
  savePendingEmail: vi.fn(),
  resendVerificationCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('./auth-context', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('./auth-service', () => ({
  resendVerificationCode: mocks.resendVerificationCode,
  verifyEmailCode: mocks.verifyEmailCode,
}));

vi.mock('./pending-email', () => ({
  clearPendingEmail: mocks.clearPendingEmail,
  readPendingEmail: mocks.readPendingEmail,
  savePendingEmail: mocks.savePendingEmail,
}));

import { VerifyEmailPage } from './verify-email-page';

function renderVerificationPage(entry = '/auth/verification') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/verification" element={<VerifyEmailPage />} />
        <Route path="/onboarding" element={<div>Onboarding de test</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    mocks.readPendingEmail.mockReturnValue('commercant@example.com');
  });

  it('continues to onboarding when a confirmation link produced a verified session', async () => {
    mocks.user = {
      email: 'commercant@example.com',
      email_confirmed_at: '2026-11-01T19:00:00Z',
    };

    renderVerificationPage('/auth/verification?code=pkce-callback');

    expect(await screen.findByText('Onboarding de test')).toBeInTheDocument();
    await waitFor(() => expect(mocks.clearPendingEmail).toHaveBeenCalledOnce());
  });

  it('keeps an unconfirmed user on the verification form', () => {
    mocks.user = { email: 'commercant@example.com', email_confirmed_at: null };

    renderVerificationPage();

    expect(screen.getByRole('textbox', { name: 'Code de vérification' })).toBeInTheDocument();
    expect(screen.queryByText('Onboarding de test')).not.toBeInTheDocument();
    expect(mocks.clearPendingEmail).not.toHaveBeenCalled();
  });
});
