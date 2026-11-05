import { useQuery } from '@tanstack/react-query';
import { Building2, LoaderCircle, Search, ShieldCheck, Store, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { friendlyError } from '../../lib/friendly-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatMoney } from '../workspace/workspace-format';
import { EmptyWorkspace, WorkspaceSection } from '../workspace/workspace-layout';
import { fetchPlatformOverview, type PlatformUser } from './administration-api';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

function formatDay(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date);
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-mint-dark">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value.toLocaleString('fr-FR')}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function CompanyBadges({ user }: { user: PlatformUser }) {
  if (user.companies.length === 0) {
    return <span className="text-xs text-slate-400">Aucune entreprise</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {user.companies.map((company) => (
        <span
          key={`${company.name}-${company.role}`}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
        >
          {company.name}
          <span className="font-normal text-slate-500">· {company.role}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Écran « Administration » — visible pour les seuls administrateurs de la
 * plateforme, et refusé côté base pour tous les autres comptes.
 */
export function AdministrationPage() {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  const overviewQuery = useQuery({
    queryKey: ['platform-overview', search],
    queryFn: () => fetchPlatformOverview(search),
    retry: 0,
  });

  const overview = overviewQuery.data;

  return (
    <WorkspaceSection
      title="Administration"
      description="Tous les comptes et toutes les entreprises de Stokari, avec leurs chiffres d’ensemble. Réservé à l’éditeur du service."
    >
      <form
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(draft.trim());
        }}
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="admin-search">Rechercher un compte ou une entreprise</Label>
          <Input
            id="admin-search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Adresse e-mail, nom ou nom de boutique"
            className="mt-1.5"
          />
        </div>
        <Button type="submit" variant="mint" className="gap-2">
          <Search className="size-4" aria-hidden="true" />
          Rechercher
        </Button>
        {search ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft('');
              setSearch('');
            }}
          >
            Tout afficher
          </Button>
        ) : null}
      </form>

      {overviewQuery.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white py-16" role="status">
          <LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement des comptes" />
        </div>
      ) : overviewQuery.isError ? (
        <Alert tone="error">
          {friendlyError(overviewQuery.error, 'Les comptes n’ont pas pu être chargés.')}
        </Alert>
      ) : overview ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi icon={Users} label="Comptes" value={overview.totals.users} hint="Toutes les inscriptions" />
            <Kpi
              icon={UserCheck}
              label="Comptes confirmés"
              value={overview.totals.confirmed}
              hint="Adresse e-mail vérifiée"
            />
            <Kpi icon={Building2} label="Entreprises" value={overview.totals.tenants} hint="Toutes boutiques confondues" />
            <Kpi icon={Store} label="Ventes enregistrées" value={overview.totals.sales} hint="Ventes non annulées" />
            <Kpi icon={ShieldCheck} label="Administrateurs" value={overview.totals.admins} hint="Accès à cet écran" />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-ink">Comptes</h2>
              <p className="text-xs text-slate-500">
                {overview.users.length} compte(s) affiché(s){search ? ` pour « ${search} »` : ''}
              </p>
            </div>
            {overview.users.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyWorkspace
                  icon={Users}
                  title="Aucun compte trouvé"
                  description="Modifiez la recherche pour retrouver une adresse ou un nom."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Compte</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Inscription</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Adresse</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Entreprises</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.users.map((user) => (
                      <tr key={user.id} className="align-top">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink">{user.fullName ?? 'Sans nom'}</p>
                          <p className="text-xs text-slate-500">{user.email || '—'}</p>
                          {user.isAdmin ? (
                            <span className="mt-1 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-mint-dark">
                              Administrateur
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{formatDay(user.createdAt)}</td>
                        <td className="px-5 py-3">
                          {user.emailConfirmedAt ? (
                            <span className="text-mint-dark">Vérifiée</span>
                          ) : (
                            <span className="text-amber-600">En attente</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <CompanyBadges user={user} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-ink">Entreprises</h2>
              <p className="text-xs text-slate-500">{overview.tenants.length} entreprise(s)</p>
            </div>
            {overview.tenants.length === 0 ? (
              <div className="px-5 py-10">
                <EmptyWorkspace
                  icon={Building2}
                  title="Aucune entreprise trouvée"
                  description="Une entreprise apparaît ici dès qu’un commerçant termine son inscription."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Entreprise</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Membres</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Produits</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Ventes</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Chiffre d’affaires</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Premier inscrit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.tenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink">{tenant.name}</p>
                          <p className="text-xs text-slate-500">
                            /b/{tenant.slug} · créée le {formatDay(tenant.createdAt)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{tenant.members}</td>
                        <td className="px-5 py-3 text-slate-600">{tenant.products}</td>
                        <td className="px-5 py-3 text-slate-600">{tenant.sales}</td>
                        <td className="px-5 py-3 font-semibold text-ink">
                          {formatMoney(tenant.revenue, tenant.currencyCode)}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">{tenant.firstMemberEmail ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-mint-dark">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1">
              <strong className="text-ink">Portée de cet écran.</strong> Il montre les comptes, les
              entreprises et leurs chiffres d’ensemble (membres, produits, ventes, chiffre
              d’affaires). Le détail commercial de chaque boutique — clients, lignes de vente,
              mouvements de stock — reste isolé par entreprise. Les actions irréversibles
              (suppression d’un compte, réinitialisation de mot de passe) se font dans la console
              d’authentification (Supabase → Authentication → Users).
            </p>
          </div>
        </div>
      ) : null}
    </WorkspaceSection>
  );
}
