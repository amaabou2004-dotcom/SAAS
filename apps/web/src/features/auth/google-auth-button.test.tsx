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
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith({ skipBrowserRedirect: false });
    expect(screen.getByText('Connexion directe avec Google, sans code OTP.')).toBeInTheDocument();
  });

  it('opens Google outside an embedded preview to avoid a blank iframe', async () => {
    mocks.enabled = true;
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    const locationReplace = vi.fn();
    const oauthWindow = {
      opener: window,
      location: { replace: locationReplace },
      close: vi.fn(),
    } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(oauthWindow);
    const user = userEvent.setup();
    render(<GoogleAuthButton onError={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Continuer avec Google' }));

    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith({ skipBrowserRedirect: true });
    await waitFor(() => expect(locationReplace).toHaveBeenCalledWith('https://accounts.google.com'));
    expect(oauthWindow.opener).toBeNull();
    expect(screen.getByText('Terminez la connexion dans le nouvel onglet Google.')).toBeInTheDocument();
  });

  it('explains how to allow the new tab when the browser blocks it', async () => {
    mocks.enabled = true;
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    vi.spyOn(window, 'open').mockReturnValue(null);
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<GoogleAuthButton onError={onError} />);

    await user.click(screen.getByRole('button', { name: 'Continuer avec Google' }));

    expect(onError).toHaveBeenLastCalledWith(
      'Autorisez l’ouverture d’un nouvel onglet pour vous connecter avec Google, puis réessayez.',
    );
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
  });
});
