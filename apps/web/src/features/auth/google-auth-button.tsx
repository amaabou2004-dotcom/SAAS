import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { isGoogleAuthEnabled } from '../../lib/supabase';
import { getAuthErrorMessage } from './auth-errors';
import { signInWithGoogle } from './auth-service';

interface GoogleAuthButtonProps {
  disabled?: boolean;
  onError: (message: string | null) => void;
}

function GoogleIcon() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.36-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.31 2.99-7.32Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.45l-3.24-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.89A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.89V7.52H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.48l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.99c1.47 0 2.79.5 3.82 1.5l2.87-2.87C16.97 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.34 2.59C7.19 7.75 9.4 5.99 12 5.99Z" />
    </svg>
  );
}

function GoogleLabel() {
  return <><GoogleIcon />Continuer avec Google</>;
}

export function GoogleAuthButton({ disabled = false, onError }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const embedded = window.self !== window.top;
  const canConnect = !disabled && isGoogleAuthEnabled;

  useEffect(() => {
    if (!embedded || !isGoogleAuthEnabled) return;
    let active = true;

    // Prepare PKCE without a network redirect. A native link click can then
    // navigate the top window directly, without depending on popup permission.
    void signInWithGoogle({ skipBrowserRedirect: true })
      .then((data) => {
        if (!data.url) throw new Error('Google OAuth redirect URL is missing.');
        if (active) setOauthUrl(data.url);
      })
      .catch((error: unknown) => {
        if (active) onError(getAuthErrorMessage(error));
      });

    return () => { active = false; };
  }, [embedded, onError]);

  const connect = async () => {
    onError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      onError(getAuthErrorMessage(error));
      setLoading(false);
    }
  };

  // Tant que la connexion Google n'est pas ouverte par l'éditeur, le bouton
  // n'apparaît pas : aucun réglage interne n'est exposé au visiteur.
  if (!isGoogleAuthEnabled) return null;

  return (
    <div className="mb-6">
      {embedded ? (
        canConnect && oauthUrl ? (
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href={oauthUrl} target="_top" onClick={() => onError(null)}>
              <GoogleLabel />
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" className="w-full" disabled>
            <GoogleLabel />
          </Button>
        )
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => { void connect(); }}
          loading={loading}
          disabled={!canConnect}
        >
          <GoogleLabel />
        </Button>
      )}
      <p className="mt-2.5 text-center text-xs leading-5 text-slate-500">
        Connexion directe avec Google, sans code de vérification.
      </p>
      {embedded && canConnect && oauthUrl ? (
        <a
          href={oauthUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onError(null)}
          className="mt-2 block text-center text-xs font-semibold text-mint-dark underline-offset-4 hover:underline"
        >
          Si la redirection est bloquée, ouvrir Google dans un nouvel onglet
        </a>
      ) : null}
      <div className="mt-6 flex items-center gap-3" role="separator">
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        <span className="text-xs font-medium text-slate-400">ou avec une adresse e-mail</span>
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>
    </div>
  );
}
