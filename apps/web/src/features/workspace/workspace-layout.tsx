import { friendlyError } from '../../lib/friendly-error';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, BarChart3, Building2, ChevronDown, HandCoins, History, LayoutDashboard, LoaderCircle, LogOut, MapPin, Package, Radar, Receipt, ShieldCheck, Store, Tags, Users, Warehouse } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/brand';
import { SiteFooter } from '../../components/site-footer';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/auth-context';
import { signOut } from '../auth/auth-service';
import { listTenants } from '../onboarding/tenant-api';
import { acceptMyInvitations } from '../team/team-api';
import { checkPlatformAdmin } from '../audience/audience-api';
import { WorkspaceContext } from './workspace-context';

/**
 * Cinq écrans suffisent au quotidien. Tout le reste (stock détaillé, historique,
 * dépôts, catégories, équipe) est rangé dans « Plus » pour ne pas encombrer.
 * Les libellés sont volontairement des mots courants, pas du jargon.
 */
const navigation = [
  { to: '/workspace/accueil', label: 'Accueil', icon: LayoutDashboard },
  { to: '/workspace/ventes', label: 'Ventes', icon: Receipt },
  { to: '/workspace/produits', label: 'Produits', icon: Package },
  { to: '/workspace/commandes', label: 'Boutique', icon: Store },
  { to: '/workspace/rapports', label: 'Rapports', icon: BarChart3 },
];

const moreNavigation = [
  { to: '/workspace/credits', label: 'Crédits', icon: HandCoins, hint: 'Qui doit encore payer' },
  { to: '/workspace/stock', label: 'Stock', icon: ArrowLeftRight, hint: 'Ce qu’il reste, par dépôt' },
  { to: '/workspace/mouvements', label: 'Historique', icon: History, hint: 'Toutes les entrées et sorties' },
  { to: '/workspace/emplacements', label: 'Dépôts', icon: MapPin, hint: 'Boutique, réserve, magasin' },
  { to: '/workspace/categories', label: 'Catégories', icon: Tags, hint: 'Ranger les produits' },
  { to: '/workspace/equipe', label: 'Équipe', icon: Users, hint: 'Qui a accès à l’entreprise' },
];

export function WorkspaceLayout() {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  // Le menu « Plus » retient le chemin sur lequel il a été ouvert : dès que la
  // route change, il se referme tout seul, sans effet ni rendu en cascade.
  const [moreOpenAt, setMoreOpenAt] = useState<string | null>(null);
  const location = useLocation();
  const moreOpen = moreOpenAt === location.pathname;
  const moreRef = useRef<HTMLDivElement | null>(null);
  const accessToken = session?.access_token;
  const tenantsQuery = useQuery({
    queryKey: ['tenants', user?.id],
    // Les invitations reçues deviennent des adhésions réelles avant la liste :
    // une personne invitée voit ainsi son entreprise dès sa première connexion.
    queryFn: async () => {
      try {
        await acceptMyInvitations(accessToken ?? '');
      } catch {
        // Une invitation non acceptée ne doit jamais bloquer l'accès à l'espace.
      }
      return listTenants(accessToken ?? '');
    },
    enabled: Boolean(accessToken),
    retry: 1,
  });
  const tenants = tenantsQuery.data ?? [];

  // Le menu « Audience » n'apparaît que pour l'administration de la plateforme :
  // la base refuse de toute façon la lecture des chiffres à tout autre compte.
  const platformAdminQuery = useQuery({
    queryKey: ['platform-admin', user?.id],
    queryFn: checkPlatformAdmin,
    enabled: Boolean(accessToken),
    retry: 0,
    staleTime: 10 * 60 * 1000,
  });
  const moreEntries = platformAdminQuery.data
    ? [
        ...moreNavigation,
        {
          to: '/workspace/administration',
          label: 'Administration',
          icon: ShieldCheck,
          hint: 'Comptes et entreprises',
        },
        {
          to: '/workspace/audience',
          label: 'Audience',
          icon: Radar,
          hint: 'Qui visite les pages publiques',
        },
      ]
    : moreNavigation;
  const tenant = tenants.find((item) => item.id === selectedTenantId) ?? tenants[0];

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpenAt(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpenAt(null);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [moreOpen]);

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
        <Alert tone="error">{friendlyError(tenantsQuery.error, 'Votre espace n’a pas pu être chargé. Réessayez.')}</Alert>
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
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 pb-2 sm:px-6">
            <nav aria-label="Navigation de l’espace" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
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
            <div className="relative shrink-0" ref={moreRef}>
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-controls="more-navigation"
                onClick={() => setMoreOpenAt(moreOpen ? null : location.pathname)}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${moreOpen ? 'bg-slate-100 text-ink' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'}`}
              >
                Plus
                <ChevronDown className={`size-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {moreOpen ? (
                <div
                  id="more-navigation"
                  className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                >
                  {moreEntries.map(({ to, label, icon: Icon, hint }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) => `flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-teal-50 text-mint-dark' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-semibold">{label}</span>
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
        <SiteFooter compact />
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
