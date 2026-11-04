import { render, screen, waitFor } from '@testing-library/react';
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche rien tant que la connexion Google n’est pas ouverte', () => {
    render(<GoogleAuthButton onError={vi.fn()} />);

    // Aucun réglage interne n'est exposé : le bouton reste simplement absent.
    expect(screen.queryByRole('button', { name: 'Continuer avec Google' })).not.toBeInTheDocument();
    expect(screen.queryByText(/activation/i)).not.toBeInTheDocument();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
  });

  it('starts the real OAuth flow without requesting an OTP', async () => {
    mocks.enabled = true;
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<GoogleAuthButton onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Continuer avec Google' }));

    expect(onError).toHaveBeenCalledWith(null);
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith();
    expect(screen.getByText('Connexion directe avec Google, sans code de vérification.')).toBeInTheDocument();
  });

  it('uses native navigation instead of a popup inside an embedded preview', async () => {
    mocks.enabled = true;
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    const open = vi.spyOn(window, 'open');
    render(<GoogleAuthButton onError={vi.fn()} />);

    const googleLink = await screen.findByRole('link', { name: 'Continuer avec Google' });

    expect(mocks.signInWithGoogle).toHaveBeenCalledWith({ skipBrowserRedirect: true });
    expect(googleLink).toHaveAttribute('href', 'https://accounts.google.com');
    expect(googleLink).toHaveAttribute('target', '_top');
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Si la redirection est bloquée, ouvrir Google dans un nouvel onglet' }))
      .toHaveAttribute('target', '_blank');
  });

  it('reports a preparation error without opening a blank window', async () => {
    mocks.enabled = true;
    mocks.signInWithGoogle.mockRejectedValue(new Error('network unavailable'));
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    const open = vi.spyOn(window, 'open');
    const onError = vi.fn();
    render(<GoogleAuthButton onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      'Le service est injoignable. Vérifiez votre connexion puis réessayez.',
    ));
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeDisabled();
    expect(open).not.toHaveBeenCalled();
  });
});
