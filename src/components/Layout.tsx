import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  ScanBarcode,
  Search,
  Settings as SettingsIcon,
  Truck,
  Users,
  X,
} from 'lucide-react'
import { useData } from '../lib/store'
import { useAuth } from '../lib/auth'
import { useUI } from '../lib/uiStore'
import { cx } from './ui'
import { inventoryStats } from '../lib/analytics'
import { useScanner } from '../lib/scannerStore'

const NAV = [
  { to: '/', label: "Aujourd'hui", icon: LayoutDashboard, end: true },
  { to: '/stock', label: 'Stock', icon: Package },
  { to: '/mouvements', label: 'Mouvements', icon: ArrowLeftRight },
  { to: '/alertes', label: 'Alertes', icon: BellRing },
  { to: '/rapports', label: 'Rapports', icon: BarChart3 },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { to: '/equipe', label: 'Équipe', icon: Users },
]

const TITLES: Record<string, string> = {
  '/': "Aujourd'hui",
  '/stock': 'Stock',
  '/mouvements': 'Mouvements',
  '/alertes': 'Alertes',
  '/rapports': 'Rapports',
  '/fournisseurs': 'Fournisseurs',
  '/reglages': 'Réglages',
  '/equipe': 'Équipe',
}

export default function Layout() {
  const { products, settings, loading, reload, error, ready } = useData()
  const { tenants, activeTenant, selectTenant, roleName, signOut } = useAuth()
  const openMovementForm = useUI((s) => s.openMovementForm)
  const openScanner = useScanner((s) => s.openScanner)
  const openHelp = useUI((s) => s.openHelp)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [tenantOpen, setTenantOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const alerts = useMemo(() => inventoryStats(products).alerts, [products])
  const title = TITLES[location.pathname] ?? 'Kanti'

  useEffect(() => {
    setMobileMenu(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useScanner.getState().openPalette()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        openMovementForm({ type: 'in' })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openMovementForm])

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-brand-400">
            <Boxes size={20} />
          </div>
          <div>
            <p className="text-[15px] font-extrabold tracking-tight text-ink-900">Kanti</p>
            <p className="text-[11px] font-medium text-ink-400">Gestion de stock</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'bg-ink-900 text-white shadow-sm'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? 'text-brand-400' : 'text-ink-400 group-hover:text-ink-600'} />
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/alertes' && alerts > 0 ? (
                    <span
                      className={cx(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                        isActive ? 'bg-white/15 text-white' : 'bg-rose-100 text-rose-700',
                      )}
                    >
                      {alerts}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-3">
          <div className="rounded-2xl bg-gradient-to-br from-ink-900 to-ink-800 p-4 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-300">Espace de travail</p>
            <p className="mt-1 truncate text-sm font-semibold leading-snug">{settings.company || 'Mon entreprise'}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
              {products.length} produits · synchronisé dans le cloud
            </p>
            <div className="mt-3 flex gap-1.5">
              <button
                onClick={() => reload()}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 disabled:opacity-60"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualiser
              </button>
              <button
                onClick={() => useScanner.getState().openPalette()}
                className="flex items-center justify-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15"
              >
                ⌘K
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-ink-100 p-3">
          <NavLink
            to="/reglages"
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-100',
              )
            }
          >
            <SettingsIcon size={18} className="text-ink-400" />
            Réglages
          </NavLink>

          <div className="mt-1">
            <button
              onClick={() => setTenantOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-ink-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-[12px] font-bold text-brand-400">
                {(settings.company || 'K').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink-900">{settings.company}</span>
                <span className="block truncate text-[11px] text-ink-400">{roleName}</span>
              </span>
              <ChevronDown size={14} className={cx('text-ink-400 transition', tenantOpen && 'rotate-180')} />
            </button>

            {tenantOpen ? (
              <div className="mt-1 space-y-1 rounded-xl border border-ink-200 bg-white p-1.5 shadow-sm">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => {
                      selectTenant(tenant.id)
                      setTenantOpen(false)
                    }}
                    className={cx(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium',
                      tenant.id === activeTenant?.id ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50',
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-900/5 text-[10px] font-bold text-ink-600">
                      {tenant.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{tenant.name}</span>
                    {tenant.id === activeTenant?.id ? <Check size={12} className="text-brand-600" /> : null}
                  </button>
                ))}
                <NavLink
                  to="/reglages"
                  onClick={() => setTenantOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"
                >
                  <Plus size={12} /> Nouvel espace
                </NavLink>
              </div>
            ) : null}
          </div>

          <button
            onClick={() => navigate('/reglages')}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-800">
              {(settings.userName || 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink-900">{settings.userName}</span>
              <span className="block truncate text-[11px] text-ink-400">Mon compte</span>
            </span>
            <ChevronRight size={15} className="text-ink-400" />
          </button>

          <button
            onClick={() => signOut()}
            className="mt-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-ink-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Header */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-ink-200/80 bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-brand-400">
                <Boxes size={17} />
              </div>
              <span className="text-[15px] font-extrabold tracking-tight text-ink-900">Kanti</span>
            </div>

            <h1 className="ml-2 hidden text-[15px] font-bold text-ink-800 lg:block">{title}</h1>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => useScanner.getState().openPalette()}
                className="group flex h-9 items-center gap-2 rounded-xl border border-ink-200 bg-white pl-2.5 pr-1.5 text-sm text-ink-400 transition hover:border-ink-300 hover:text-ink-600 sm:h-10 sm:w-64"
                aria-label="Rechercher un produit"
              >
                <Search size={16} />
                <span className="hidden flex-1 text-left text-[13px] font-medium sm:inline">Produit, SKU, code-barres…</span>
                <span className="kbd hidden sm:inline-flex">⌘K</span>
              </button>

              <button onClick={openScanner} className="btn-ghost h-9 w-9 p-0 sm:h-10 sm:w-auto sm:px-3" aria-label="Scanner">
                <ScanBarcode size={17} />
                <span className="hidden text-[13px] sm:inline">Scanner</span>
              </button>

              <button
                onClick={openHelp}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900 sm:h-10 sm:w-auto sm:px-3"
                aria-label="Comment ça marche"
                title="Comment ça marche ?"
              >
                <BookOpen size={17} />
                <span className="hidden text-[13px] sm:inline">Aide</span>
              </button>

              <NavLink
                to="/alertes"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900 sm:h-10 sm:w-10"
                aria-label={`Alertes (${alerts})`}
              >
                <BellRing size={17} />
                {alerts > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {alerts > 99 ? '99+' : alerts}
                  </span>
                ) : null}
              </NavLink>

              <button
                onClick={() => openMovementForm()}
                className="btn-brand hidden h-10 pl-3 pr-3.5 sm:inline-flex"
              >
                <Plus size={17} />
                Mouvement
              </button>

              <button
                onClick={() => setMobileMenu(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-600 lg:hidden"
                aria-label="Menu"
              >
                <Menu size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-5 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:pb-10">
          {error ? (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center">
              <span className="flex-1">Impossible de charger vos données : {error}</span>
              <button onClick={() => reload()} className="btn-ghost h-8 shrink-0 border-rose-200 px-2.5 text-xs text-rose-700">
                <RefreshCw size={13} /> Réessayer
              </button>
            </div>
          ) : null}
          {!ready && loading ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-500">
              <RefreshCw size={14} className="animate-spin" /> Chargement de votre stock…
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5">
          <MobileTab to="/" label="Accueil" icon={LayoutDashboard} />
          <MobileTab to="/stock" label="Stock" icon={Package} />
          <div className="flex justify-center">
            <button
              onClick={() => openMovementForm()}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-900 text-brand-400 shadow-pop transition active:scale-95"
              aria-label="Nouveau mouvement"
            >
              <Plus size={26} />
            </button>
          </div>
          <MobileTab to="/alertes" label="Alertes" icon={BellRing} badge={alerts} />
          <MobileTab to="/mouvements" label="Historique" icon={ArrowLeftRight} />
        </div>
      </nav>

      {mobileMenu ? <MobileSheet onClose={() => setMobileMenu(false)} /> : null}
    </div>
  )
}

function MobileTab({
  to,
  label,
  icon: Icon,
  badge,
}: {
  to: string
  label: string
  icon: typeof Package
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cx(
          'flex flex-col items-center gap-1 rounded-lg px-1 pb-2 pt-1.5 text-[10px] font-semibold transition',
          isActive ? 'text-ink-900' : 'text-ink-400',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            {badge ? (
              <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {badge}
              </span>
            ) : null}
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

function MobileSheet({ onClose }: { onClose: () => void }) {
  const { products, settings } = useData()
  const { tenants, activeTenant, selectTenant, roleName, signOut } = useAuth()
  const alerts = inventoryStats(products).alerts
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm animate-slide-in flex-col bg-white shadow-pop">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-bold text-ink-900">{settings.company}</p>
            <p className="text-xs text-ink-400">Connecté en tant que {settings.userName}</p>
          </div>
          <button onClick={onClose} className="btn-subtle h-9 w-9 p-0" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {[...NAV, { to: '/reglages', label: 'Réglages', icon: SettingsIcon }].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? (item.end as boolean) : false}
              onClick={onClose}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold',
                  isActive ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-100',
                )
              }
            >
              <item.icon size={19} />
              <span className="flex-1">{item.label}</span>
              {item.to === '/alertes' && alerts > 0 ? (
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">{alerts}</span>
              ) : null}
            </NavLink>
          ))}
        </div>
        <div className="space-y-2 border-t border-ink-100 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Espace · {roleName}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => {
                  selectTenant(tenant.id)
                  onClose()
                }}
                className={cx(
                  'shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold',
                  tenant.id === activeTenant?.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600',
                )}
              >
                {tenant.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              onClose()
              useScanner.getState().openScanner()
            }}
            className="btn-ghost w-full justify-start"
          >
            <ScanBarcode size={17} /> Scanner un code-barres
          </button>
          <button
            onClick={() => {
              onClose()
              useUI.getState().openHelp()
            }}
            className="btn-ghost w-full justify-start"
          >
            <BookOpen size={17} /> Comment ça marche ?
          </button>
          <button
            onClick={() => {
              onClose()
              void signOut()
            }}
            className="btn-ghost w-full justify-start text-rose-600"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}

