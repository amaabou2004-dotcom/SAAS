import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { getAuthErrorMessage } from './auth-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './auth-layout';
import { signOut } from './auth-service';
import { clearPendingEmail } from './pending-email';

export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, user, loading } = useAuth();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const parameters = new URLSearchParams(location.search);
  const providerError = parameters.get('error_description') ?? parameters.get('error');
  const error = sessionError ?? (providerError ? getAuthErrorMessage(new Error(providerError)) : null);

  useEffect(() => {
    if (error || loading) return;

    if (session && user?.email_confirmed_at) {
      clearPendingEmail();
      void navigate('/onboarding', { replace: true });
      return;
    }

    if (session && user && !user.email_confirmed_at) {
      const timer = window.setTimeout(() => {
        setSessionError('Google n’a pas confirmé votre adresse e-mail. La connexion a été refusée.');
        void signOut().catch(() => undefined);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setSessionError('La connexion Google n’a pas pu être finalisée. Recommencez depuis la page de connexion.');
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [error, loading, navigate, session, user]);

  return (
    <AuthLayout
      eyebrow="Connexion sécurisée"
      title={error ? 'Connexion non finalisée' : 'Connexion avec Google'}
      description="Nous vérifions la session créée par Google avant d’ouvrir votre espace."
    >
      {error ? (
        <>
          <Alert tone="error" className="mb-5">{error}</Alert>
          <Button asChild variant="mint" size="lg" className="w-full">
            <Link to="/auth/connexion" replace>Retour à la connexion</Link>
          </Button>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center" role="status">
          <LoaderCircle className="mx-auto size-7 animate-spin text-mint" aria-hidden="true" />
          <p className="mt-4 text-sm font-semibold text-ink">Validation de votre session…</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            La vérification est effectuée par Google. Aucun code OTP n’est nécessaire.
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
