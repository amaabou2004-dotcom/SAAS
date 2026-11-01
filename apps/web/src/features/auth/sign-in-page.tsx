import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getAuthErrorMessage } from './auth-errors';
import { AuthLayout } from './auth-layout';
import { signInWithPassword } from './auth-service';
import { signInSchema, type SignInValues } from './auth-schemas';
import { ConfigurationNotice } from './configuration-notice';
import { FormField } from './form-field';
import { savePendingEmail } from './pending-email';

export function SignInPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await signInWithPassword(values.email, values.password);
      void navigate('/onboarding', { replace: true });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('email not confirmed')) {
        savePendingEmail(values.email);
        void navigate('/auth/verification', { state: { email: values.email } });
        return;
      }
      setServerError(getAuthErrorMessage(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Heureux de vous revoir"
      title="Connectez-vous à votre espace"
      description="Retrouvez votre entreprise et reprenez votre activité là où vous l’avez laissée."
      footer={
        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link to="/auth/inscription" className="font-semibold text-mint-dark hover:underline">
            Créer mon espace
          </Link>
        </p>
      }
    >
      <ConfigurationNotice />
      {serverError ? <Alert tone="error" className="mb-5">{serverError}</Alert> : null}

      <form onSubmit={(event) => { void onSubmit(event); }} noValidate className="space-y-5">
        <FormField
          {...register('email')}
          label="Adresse e-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="vous@entreprise.com"
          error={errors.email?.message}
        />
        <FormField
          {...register('password')}
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          error={errors.password?.message}
          trailing={
            <Link to="/auth/mot-de-passe-oublie" className="text-xs font-semibold text-mint-dark hover:underline">
              Mot de passe oublié ?
            </Link>
          }
        />
        <Button
          type="submit"
          variant="mint"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={!isSupabaseConfigured}
        >
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </AuthLayout>
  );
}
