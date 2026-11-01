const defaultMessage = 'Une erreur est survenue. Réessayez dans quelques instants.';

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return defaultMessage;

  const normalized = error.message.toLowerCase();

  if (normalized.includes('configuration requise')) return error.message;
  if (normalized.includes('invalid login credentials')) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Votre adresse e-mail n’est pas encore vérifiée.';
  }
  if (
    normalized.includes('token has expired') ||
    normalized.includes('token_expired') ||
    normalized.includes('otp_expired')
  ) {
    return 'Ce code a expiré. Demandez un nouveau code.';
  }
  if (
    normalized.includes('invalid otp') ||
    normalized.includes('token is invalid') ||
    normalized.includes('otp_disabled')
  ) {
    return 'Ce code est incorrect ou n’est plus valide.';
  }
  if (
    normalized.includes('over_request_rate_limit') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('email rate limit')
  ) {
    return 'Trop de tentatives. Patientez avant de réessayer.';
  }
  if (normalized.includes('user already registered')) {
    return 'Un compte existe déjà avec cette adresse e-mail.';
  }
  if (normalized.includes('password')) {
    return 'Le mot de passe ne respecte pas les règles de sécurité.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Le service est injoignable. Vérifiez votre connexion puis réessayez.';
  }

  return defaultMessage;
}
