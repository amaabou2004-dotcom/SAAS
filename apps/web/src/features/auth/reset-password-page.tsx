import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getAuthErrorMessage } from './auth-errors';
import { useAuth } from './auth-context';
import { AuthLayout } from './auth-layout';
import { updatePassword } from './auth-service';
import { PASSWORD_MIN_LENGTH, resetPasswordSchema, type ResetPasswordValues } from './auth-schemas';
import { ConfigurationNotice } from './configuration-notice';
import { FormField } from './form-field';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null);
    try {
      await updatePassword(password);
      void navigate('/onboarding', { replace: true });
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Nouveau mot de passe"
      title="Sécurisez à nouveau votre compte"
      description="Choisissez un mot de passe unique que vous n’utilisez sur aucun autre service."
    >
      <ConfigurationNotice />
      {serverError ? <Alert tone="error" className="mb-5">{serverError}</Alert> : null}
      {!loading && !session ? (
        <Alert tone="warning" className="mb-5">
          Le lien de récupération est absent, invalide ou expiré. Demandez un nouveau lien depuis la page de récupération.
        </Alert>
      ) : null}

      <form onSubmit={(event) => { void onSubmit(event); }} noValidate className="space-y-5">
        <FormField
          {...register('password')}
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder={`${PASSWORD_MIN_LENGTH} caractères, avec a–z, A–Z et 0–9`}
          error={errors.password?.message}
        />
        <FormField
          {...register('confirmPassword')}
          label="Confirmer le nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          placeholder="Saisissez-le une seconde fois"
          error={errors.confirmPassword?.message}
        />
        <Button
          type="submit"
          variant="mint"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={!isSupabaseConfigured || loading || !session}
        >
          Enregistrer le nouveau mot de passe
        </Button>
      </form>
    </AuthLayout>
  );
}
