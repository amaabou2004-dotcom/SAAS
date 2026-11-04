import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Building2, History, LoaderCircle, LogOut, MapPin, Package, Receipt, Tags, Warehouse } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/brand';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/auth-context';
import { signOut } from '../auth/auth-service';
import { listTenants } from '../onboarding/tenant-api';
import { WorkspaceContext } from './workspace-context';

const navigation = [
  { to: '/workspace/ventes', label: 'Ventes', icon: Receipt },
  { to: '/workspace/produits', label: 'Produits', icon: Package },
  { to: '/workspace/categories', label: 'Catégories', icon: Tags },
  { to: '/workspace/emplacements', label: 'Emplacements', icon: MapPin },
  { to: '/workspace/stock', label: 'Stock & opérations', icon: ArrowLeftRight },
  { to: '/workspace/mouvements', label: 'Mouvements', icon: History },
];

export function WorkspaceLayout() {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const accessToken = session?.access_token;
  const tenantsQuery = useQuery({
    queryKey: ['tenants', user?.id],
    queryFn: () => listTenants(accessToken ?? ''),
    enabled: Boolean(accessToken),
    retry: 1,
  });
  const tenants = tenantsQuery.data ?? [];
  const tenant = tenants.find((item) => item.id === selectedTenantId) ?? tenants[0];

  const logout = async () => {
    await signOut();
    queryClient.clear();
    void navigate('/auth/connexion', { replace: true });
  };

  if (tenantsQuery.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-canvas" role="status"><LoaderCircle className="size-8 animate-spin text-mint" aria-label="Chargement de l’espace" /></div>;
  }

  if (tenantsQuery.isError) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <Alert tone="error">Votre espace n’a pas pu être chargé. {tenantsQuery.error instanceof Error ? tenantsQuery.error.message : ''}</Alert>
        <Button className="mt-5" variant="outline" onClick={() => { void tenantsQuery.refetch(); }}>Réessayer</Button>
      </main>
    );
  }

  if (!tenant || !accessToken) return <Navigate to="/onboarding" replace />;

  return (
    <WorkspaceContext.Provider value={{ tenant, accessToken }}>
      <div className="min-h-screen bg-canvas">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Brand />
              <span className="hidden h-6 w-px bg-slate-200 sm:block" />
              <div className="hidden min-w-0 items-center gap-2 text-sm font-semibold text-ink sm:flex">
                <Building2 className="size-4 shrink-0 text-mint-dark" aria-hidden="true" />
                <span className="max-w-52 truncate">{tenant.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tenants.length > 1 ? (
                <select
                  aria-label="Entreprise active"
                  className="min-h-10 max-w-48 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                  value={tenant.id}
                  onChange={(event) => setSelectedTenantId(event.target.value)}
                >
                  {tenants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              ) : null}
              <span className="hidden max-w-48 truncate text-xs text-slate-500 lg:block">{user?.email}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => { void logout(); }}>
                <LogOut className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Déconnexion</span>
              </Button>
            </div>
          </div>
          <nav aria-label="Navigation de l’espace" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2 sm:px-6">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? 'bg-teal-50 text-mint-dark' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'}`}
              >
                <Icon className="size-4" aria-hidden="true" />{label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}

export function WorkspaceSection({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyWorkspace({ icon: Icon = Warehouse, title, description }: { icon?: typeof Warehouse; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Icon className="mx-auto size-8 text-slate-400" aria-hidden="true" />
      <h2 className="mt-4 font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
