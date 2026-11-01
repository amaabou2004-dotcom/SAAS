import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, Check, Globe2, LoaderCircle, LogOut, PackagePlus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../../components/brand';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { useAuth } from '../auth/auth-context';
import { signOut } from '../auth/auth-service';
import { FormField } from '../auth/form-field';
import { createTenant, listTenants } from './tenant-api';
import { slugify, tenantFormSchema, type TenantFormValues } from './tenant-form-schema';

const currencies = [
  ['XOF', 'Franc CFA (XOF)'],
  ['EUR', 'Euro (EUR)'],
  ['USD', 'Dollar américain (USD)'],
  ['NGN', 'Naira nigérian (NGN)'],
  ['GHS', 'Cedi ghanéen (GHS)'],
  ['MAD', 'Dirham marocain (MAD)'],
];

const timezones = [
  ['Africa/Niamey', 'Niamey (UTC+1)'],
  ['Africa/Abidjan', 'Abidjan (UTC)'],
  ['Africa/Dakar', 'Dakar (UTC)'],
  ['Africa/Douala', 'Douala (UTC+1)'],
  ['Europe/Paris', 'Paris'],
  ['UTC', 'Temps universel coordonné (UTC)'],
];

export function OnboardingPage() {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const accessToken = session?.access_token;
  const tenantsQuery = useQuery({
    queryKey: ['tenants', user?.id],
    queryFn: () => listTenants(accessToken ?? ''),
    enabled: Boolean(accessToken),
    retry: 1,
  });
  const createMutation = useMutation({
    mutationFn: (values: TenantFormValues) => createTenant(accessToken ?? '', values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenants', user?.id] });
      void navigate('/workspace');
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      currency_code: 'XOF',
      timezone: 'Africa/Niamey',
    },
  });

  const logout = async () => {
    await signOut();
    queryClient.clear();
    void navigate('/auth/connexion', { replace: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await createMutation.mutateAsync(values);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'La création de l’entreprise a échoué.');
    }
  });

  const tenants = tenantsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-52 truncate text-sm text-slate-500 sm:block">{user?.email}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => { void logout(); }}>
              <LogOut className="size-4" aria-hidden="true" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {tenantsQuery.isLoading ? (
          <div className="grid min-h-[50vh] place-items-center" role="status">
            <div className="text-center text-sm text-slate-500">
              <LoaderCircle className="mx-auto mb-3 size-7 animate-spin text-mint" aria-hidden="true" />
              Chargement de votre espace…
            </div>
          </div>
        ) : tenantsQuery.isError ? (
          <div className="mx-auto max-w-2xl">
            <Alert tone="error">
              <strong className="mb-1 block">Votre espace n’a pas pu être chargé</strong>
              {tenantsQuery.error instanceof Error ? tenantsQuery.error.message : 'Vérifiez la configuration de l’API puis réessayez.'}
            </Alert>
            <Button className="mt-5" variant="outline" onClick={() => { void tenantsQuery.refetch(); }}>
              Réessayer
            </Button>
          </div>
        ) : tenants.length > 0 ? (
          <section>
            <div className="mb-9 flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Check className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">Configuration initiale terminée</p>
                <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Votre espace est prêt</h1>
                <p className="mt-2 text-slate-600">Votre compte vérifié et votre entreprise sont maintenant reliés.</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="font-bold text-ink">Votre entreprise</h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
                </div>
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-start gap-4 rounded-xl bg-slate-50 p-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
                      <Building2 className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-ink">{tenant.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">/{tenant.slug}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                        <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">{tenant.currency_code}</span>
                        <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">{tenant.timezone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-ink p-6 text-white sm:p-7">
                <PackagePlus className="mb-5 size-7 text-teal-300" aria-hidden="true" />
                <h2 className="text-lg font-bold">Prochaine étape : votre catalogue</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Votre catalogue et vos emplacements sont prêts à être configurés. Les mouvements de stock seront enregistrés avec leur auteur et leur motif.
                </p>
                <Button type="button" variant="mint" className="mt-6 w-full" onClick={() => { void navigate('/workspace'); }}>
                  Ouvrir mon catalogue <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
                <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-300">
                  <ShieldCheck className="size-4 text-teal-300" aria-hidden="true" />
                  Accès propriétaire attribué
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="mb-9 text-center">
              <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-teal-100 text-mint-dark">
                <Building2 className="size-6" aria-hidden="true" />
              </span>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">Dernière étape</p>
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Parlez-nous de votre entreprise</h1>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-6 text-slate-600">
                Ces informations définissent la devise et le fuseau horaire de votre espace de travail.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {formError ? <Alert tone="error" className="mb-6">{formError}</Alert> : null}
              <form onSubmit={(event) => { void onSubmit(event); }} noValidate className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    {...register('name')}
                    label="Nom de l’entreprise"
                    placeholder="Ex. Boutique Aminata"
                    autoComplete="organization"
                    error={errors.name?.message}
                    onChange={(event) => {
                      void register('name').onChange(event);
                      setValue('slug', slugify(event.target.value), { shouldValidate: true });
                    }}
                  />
                  <FormField
                    {...register('slug')}
                    label="Identifiant de l’espace"
                    placeholder="boutique-aminata"
                    error={errors.slug?.message}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="currency_code" className="mb-2 block">Devise principale</Label>
                    <div className="relative">
                      <select
                        id="currency_code"
                        {...register('currency_code')}
                        className="min-h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100"
                      >
                        {currencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <Globe2 className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-slate-400" aria-hidden="true" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="timezone" className="mb-2 block">Fuseau horaire</Label>
                    <select
                      id="timezone"
                      {...register('timezone')}
                      className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100"
                    >
                      {timezones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {errors.timezone ? <p className="mt-1.5 text-xs text-red-700">{errors.timezone.message}</p> : null}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />
                  Vous serez propriétaire de cette entreprise. Vous pourrez ensuite inviter vos employés et leur attribuer des permissions précises.
                </div>

                <Button type="submit" variant="mint" size="lg" className="w-full" loading={createMutation.isPending}>
                  Créer mon entreprise
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
