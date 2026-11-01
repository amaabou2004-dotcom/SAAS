const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: {
      verifyOtp: mocks.verifyOtp,
      signUp: mocks.signUp,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  }),
}));

import { signInWithGoogle, signUpWithPassword, verifyEmailCode } from './auth-service';

describe('auth service', () => {
  beforeEach(() => {
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('verifies a signup code with the email OTP type', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: 'session' },
        user: { email_confirmed_at: '2026-11-01T12:00:00Z' },
      },
      error: null,
    });

    await expect(verifyEmailCode('Commercant@Example.com', '12345678')).resolves.toBeDefined();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: 'commercant@example.com',
      token: '12345678',
      type: 'email',
    });
  });

  it('does not accept a verification response without a confirmed session', async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    await expect(verifyEmailCode('commercant@example.com', '12345678')).rejects.toThrow();
  });

  it('starts Google OAuth with the application callback', async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/v2/auth' },
      error: null,
    });

    await expect(signInWithGoogle()).resolves.toBeDefined();
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it('signs out an unconfirmed auto-session created by a misconfigured project', async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: { access_token: 'unexpected-session' },
        user: { email_confirmed_at: null },
      },
      error: null,
    });

    await expect(signUpWithPassword('commercant@example.com', 'MotDePasse2026')).rejects.toThrow(
      'confirmation par e-mail',
    );
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
