import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getAuthErrorMessage } from './auth-errors';
import { AuthLayout } from './auth-layout';
import { requestPasswordReset } from './auth-service';
import { forgotPasswordSchema, type ForgotPasswordValues } from './auth-schemas';
import { ConfigurationNotice } from './configuration-notice';
import { FormField } from './form-field';

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setServerError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Récupération du compte"
      title="Retrouvez l’accès à votre espace"
      description="Nous vous enverrons les instructions pour choisir un nouveau mot de passe."
      footer={
        <p className="text-center text-sm">
          <Link to="/auth/connexion" className="font-semibold text-mint-dark hover:underline">
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <ConfigurationNotice />
      {serverError ? <Alert tone="error" className="mb-5">{serverError}</Alert> : null}
      {sentTo ? (
        <Alert tone="success" className="mb-6">
          Si un compte correspond à <strong>{sentTo}</strong>, un message de récupération vient d’être demandé. Vérifiez également vos courriers indésirables.
        </Alert>
      ) : null}

      <form onSubmit={(event) => { void onSubmit(event); }} noValidate className="space-y-5">
        <FormField
          {...register('email')}
          label="Adresse e-mail du compte"
          type="email"
          autoComplete="email"
          placeholder="vous@entreprise.com"
          error={errors.email?.message}
        />
        <Button
          type="submit"
          variant="mint"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={!isSupabaseConfigured || Boolean(sentTo)}
        >
          {sentTo ? 'Instructions demandées' : 'Recevoir les instructions'}
        </Button>
      </form>
    </AuthLayout>
  );
}
