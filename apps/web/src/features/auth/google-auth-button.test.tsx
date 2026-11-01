import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoogleAuthButton } from './google-auth-button';

const mocks = vi.hoisted(() => ({
  enabled: false,
  signInWithGoogle: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  get isGoogleAuthEnabled() {
    return mocks.enabled;
  },
}));

vi.mock('./auth-service', () => ({
  signInWithGoogle: mocks.signInWithGoogle,
}));

describe('GoogleAuthButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = false;
    mocks.signInWithGoogle.mockResolvedValue({ provider: 'google', url: 'https://accounts.google.com' });
  });

  it('stays disabled until the provider is explicitly enabled', () => {
    render(<GoogleAuthButton onError={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeDisabled();
    expect(screen.getByText('Disponible après activation sécurisée du fournisseur Google.')).toBeInTheDocument();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
  });

  it('starts the real OAuth flow without requesting an OTP', async () => {
    mocks.enabled = true;
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<GoogleAuthButton onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Continuer avec Google' }));

    expect(onError).toHaveBeenCalledWith(null);
    expect(mocks.signInWithGoogle).toHaveBeenCalledOnce();
    expect(screen.getByText('Connexion directe avec Google, sans code OTP.')).toBeInTheDocument();
  });
});
