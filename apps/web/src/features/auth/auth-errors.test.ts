import { getAuthErrorMessage } from './auth-errors';

describe('getAuthErrorMessage', () => {
  it('explains the Supabase email sending quota without hiding its cause', () => {
    expect(getAuthErrorMessage(new Error('over_email_send_rate_limit'))).toBe(
      'Le quota d’envoi d’e-mails est atteint. Patientez avant de demander un nouveau message.',
    );
  });

  it('guides an already registered address towards sign-in', () => {
    expect(getAuthErrorMessage(new Error('user already registered'))).toBe(
      'Un compte existe déjà avec cette adresse e-mail.',
    );
  });

  it('reports a disabled OAuth provider honestly', () => {
    expect(getAuthErrorMessage(new Error('provider is not enabled'))).toBe(
      'La connexion Google n’est pas disponible pour le moment. Utilisez votre adresse e-mail.',
    );
  });

  it('keeps a specific message for invalid verification codes', () => {
    expect(getAuthErrorMessage(new Error('Invalid OTP'))).toBe(
      'Ce code est incorrect ou n’est plus valide.',
    );
  });
});
