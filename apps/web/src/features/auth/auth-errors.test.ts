import { getAuthErrorMessage } from './auth-errors';

describe('getAuthErrorMessage', () => {
  it('explains the Supabase email sending quota without hiding its cause', () => {
    expect(getAuthErrorMessage(new Error('over_email_send_rate_limit'))).toBe(
      'Le quota d’envoi d’e-mails est atteint. Patientez avant de demander un nouveau message.',
    );
  });

  it('reports a disabled OAuth provider honestly', () => {
    expect(getAuthErrorMessage(new Error('provider is not enabled'))).toBe(
      'La connexion Google n’est pas encore activée pour ce projet.',
    );
  });

  it('keeps a specific message for invalid verification codes', () => {
    expect(getAuthErrorMessage(new Error('Invalid OTP'))).toBe(
      'Ce code est incorrect ou n’est plus valide.',
    );
  });
});
