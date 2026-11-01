import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { isSupabaseConfigured } from '../../lib/supabase';
import { getAuthErrorMessage } from './auth-errors';
import { AuthLayout } from './auth-layout';
import { signUpWithPassword } from './auth-service';
import { signUpSchema, type SignUpValues } from './auth-schemas';
import { ConfigurationNotice } from './configuration-notice';
import { FormField } from './form-field';
import { savePendingEmail } from './pending-email';

export function SignUpPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const password = useWatch({ control, name: 'password', defaultValue: '' });
  const passwordRules = [
    { label: '12 caractères minimum', valid: password.length >= 12 },
    { label: 'Au moins une lettre', valid: /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(password) },
    { label: 'Au moins un chiffre', valid: /\d/.test(password) },
  ];

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await signUpWithPassword(values.email, values.password);
      savePendingEmail(values.email);
      void navigate('/auth/verification', {
        state: { email: values.email.trim().toLowerCase() },
      });
    } catch (error) {
      setServerError(getAuthErrorMessage(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Créer votre espace"
      title="Commençons par votre compte"
      description="Votre adresse e-mail sera vérifiée avant la création de votre entreprise."
      footer={
        <p className="text-center text-sm text-slate-600">
          Vous avez déjà un compte ?{' '}
          <Link to="/auth/connexion" className="font-semibold text-mint-dark hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      <ConfigurationNotice />
      {serverError ? <Alert tone="error" className="mb-5">{serverError}</Alert> : null}

      <form onSubmit={(event) => { void onSubmit(event); }} noValidate className="space-y-5">
        <FormField
          {...register('email')}
          label="Adresse e-mail professionnelle"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="vous@entreprise.com"
          error={errors.email?.message}
        />

        <div>
          <div className="relative">
            <FormField
              {...register('password')}
              label="Mot de passe"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Créez un mot de passe robuste"
              error={errors.password?.message}
              className="[&_input]:pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-[38px] grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {passwordRules.map((rule) => (
              <li
                key={rule.label}
                className={`flex items-center gap-1.5 text-[11px] font-medium ${rule.valid ? 'text-emerald-700' : 'text-slate-500'}`}
              >
                <span className={`grid size-4 place-items-center rounded-full ${rule.valid ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <Check className="size-2.5" aria-hidden="true" />
                </span>
                {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <FormField
          {...register('confirmPassword')}
          label="Confirmer le mot de passe"
          type={showPassword ? 'text' : 'password'}
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
          disabled={!isSupabaseConfigured}
        >
          {isSubmitting ? 'Création en cours…' : 'Recevoir mon e-mail de vérification'}
        </Button>
      </form>
    </AuthLayout>
  );
}
