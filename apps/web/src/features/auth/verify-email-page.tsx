import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getAuthErrorMessage } from './auth-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './auth-layout';
import { resendVerificationCode, verifyEmailCode } from './auth-service';
import { verifyEmailSchema, type VerifyEmailValues } from './auth-schemas';
import { ConfigurationNotice } from './configuration-notice';
import { FormField } from './form-field';
import { clearPendingEmail, readPendingEmail, savePendingEmail } from './pending-email';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const stateEmail = (location.state as { email?: string } | null)?.email;
  const email = stateEmail ?? readPendingEmail() ?? user?.email ?? '';
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (email) savePendingEmail(email);
  }, [email]);

  useEffect(() => {
    if (!user?.email_confirmed_at) return;
    clearPendingEmail();
    void navigate('/onboarding', { replace: true });
  }, [navigate, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const onSubmit = handleSubmit(async ({ code }) => {
    setServerError(null);
    setNotice(null);
    try {
      await verifyEmailCode(email, code);
      clearPendingEmail();
      void navigate('/onboarding', { replace: true });
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
    }
  });

  const resend = async () => {
    setServerError(null);
    setNotice(null);
    setResending(true);
    try {
      await resendVerificationCode(email);
      setNotice('Un nouvel e-mail de vérification vient d’être demandé. Consultez votre boîte de réception.');
      setCooldown(60);
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Vérification de sécurité"
      title="Consultez votre boîte e-mail"
      description="Utilisez le lien de confirmation ou saisissez le code à 8 chiffres reçu pour activer votre compte."
    >
      <div className="mb-7 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-mint shadow-sm">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 text-sm">
          <p className="text-slate-500">Vérification destinée à</p>
          <p className="truncate font-semibold text-ink">{email || 'adresse e-mail non renseignée'}</p>
        </div>
      </div>

      <ConfigurationNotice />
      {serverError ? <Alert tone="error" className="mb-5">{serverError}</Alert> : null}
      {notice ? <Alert tone="success" className="mb-5">{notice}</Alert> : null}
      {!email ? (
        <Alert tone="warning" className="mb-5">
          Retournez à l’inscription pour indiquer l’adresse à vérifier.
        </Alert>
      ) : null}

      <form onSubmit={(event) => { void onSubmit(event); }} noValidate className="space-y-5">
        <FormField
          {...register('code')}
          label="Code de vérification"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          placeholder="00000000"
          error={errors.code?.message}
          className="[&_input]:text-center [&_input]:font-mono [&_input]:text-2xl [&_input]:font-semibold [&_input]:tracking-[0.35em]"
          disabled={!email}
        />
        <Button
          type="submit"
          variant="mint"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={!isSupabaseConfigured || !email}
        >
          {isSubmitting ? 'Vérification…' : 'Vérifier mon adresse e-mail'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Button
          type="button"
          variant="link"
          onClick={() => { void resend(); }}
          loading={resending}
          disabled={!isSupabaseConfigured || !email || cooldown > 0}
        >
          {cooldown > 0 ? `Renvoyer l’e-mail dans ${cooldown} s` : 'Renvoyer l’e-mail de vérification'}
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        Mauvaise adresse ?{' '}
        <Link to="/auth/inscription" className="font-semibold text-mint-dark hover:underline">
          Recommencer l’inscription
        </Link>
      </p>
    </AuthLayout>
  );
}
