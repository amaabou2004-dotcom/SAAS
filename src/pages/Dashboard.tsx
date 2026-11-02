import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BellRing,
  Boxes,
  ClipboardList,
  Plus,
  ScanBarcode,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { useScanner } from '../lib/scannerStore'
import { cx } from '../components/ui'
import { formatDateTimeShort, formatMoney, formatNumber } from '../lib/format'
import {
  buildAlertLines,
  categoryBreakdown,
  dailyFlow,
  inventoryStats,
  movementsToday,
  topMoving,
} from '../lib/analytics'

export default function Dashboard() {
  const { products, suppliers, movements, settings, addMovement } = useData()
  const openMovementForm = useUI((s) => s.openMovementForm)
  const openDetail = useUI((s) => s.openDetail)
  const openOrder = useUI((s) => s.openOrder)
  const openScanner = useScanner((s) => s.openScanner)
  const toast = useUI((s) => s.toast)

  const stats = useMemo(() => inventoryStats(products), [products])
  const alerts = useMemo(() => buildAlertLines(products, suppliers, movements), [products, suppliers, movements])
  const flow = useMemo(() => dailyFlow(movements, 14), [movements])
  const best = useMemo(() => topMoving(products, movements, 30, 5), [products, movements])
  const today = useMemo(() => movementsToday(movements), [movements])
  const categories = useMemo(() => categoryBreakdown(products).slice(0, 4), [products])
  const recent = movements.slice(0, 6)
  const maxBest = Math.max(1, ...best.map((b) => b.qty))

  const quickReceive = async (productId: string, qty: number) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    const res = await addMovement({
      productId,
      type: 'in',
      quantity: qty,
      reason: 'Réception fournisseur',
      note: 'Réapprovisionnement rapide depuis le tableau de bord',
    })
    if (res.ok) toast(`+${qty} ${product.unit} · ${product.name} réceptionnés`)
    else toast(res.error ?? 'Action impossible', 'error')
  }

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold capitalize text-ink-400">{dateLabel}</p>
          <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-[28px]">
            Bonjour {settings.userName} 👋
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {alerts.length > 0
              ? `${alerts.filter((a) => a.status === 'out').length} rupture(s) et ${alerts.filter((a) => a.status === 'low').length} produit(s) sous le seuil à traiter.`
              : 'Tout est sous contrôle, aucun produit sous le seuil.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openScanner} className="btn-ghost">
            <ScanBarcode size={16} /> Scanner
          </button>
          <button onClick={() => openMovementForm({ type: 'in' })} className="btn-brand">
            <Plus size={16} /> Nouveau mouvement
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Valeur du stock"
          value={formatMoney(stats.costValue, settings.currency, true)}
          hint={`${formatNumber(stats.units)} unités · ${stats.count} références`}
          icon={<Wallet size={16} />}
          tone="ink"
        />
        <Kpi
          label="Alertes stock"
          value={String(stats.alerts)}
          hint={`${stats.out} en rupture · ${stats.low} sous seuil`}
          icon={<BellRing size={16} />}
          tone={stats.alerts > 0 ? 'danger' : 'ok'}
          to="/alertes"
        />
        <Kpi
          label="Mouvements aujourd’hui"
          value={String(today.length)}
          hint={`${today.filter((m) => m.type === 'out').length} sorties · ${today.filter((m) => m.type === 'in').length} entrées`}
          icon={<ClipboardList size={16} />}
          to="/mouvements"
        />
        <Kpi
          label="Marge potentielle"
          value={formatMoney(stats.margin, settings.currency, true)}
          hint="stock valorisé au prix de vente"
          icon={<TrendingUp size={16} />}
          tone="ok"
          to="/rapports"
        />
      </div>

      {alerts.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <TriangleAlert size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900">
              {alerts.length} produit(s) à réapprovisionner
            </p>
            <p className="text-xs text-amber-800/80">
              Coût estimé des commandes : {formatMoney(alerts.reduce((s, a) => s + a.estimatedCost, 0), settings.currency)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/alertes" className="btn-ghost bg-white/70">
              Voir les alertes
            </Link>
            <button onClick={() => openOrder()} className="btn-primary">
              <ShoppingCart size={16} /> Commander
            </button>
          </div>
        </div>
      ) : null}

      <QuickActionsCard className="lg:hidden" />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Alerts */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2">
                <TriangleAlert size={17} className="text-amber-600" />
                <h3 className="section-title">À traiter maintenant</h3>
                <span className="chip bg-ink-100 text-ink-600">{alerts.length}</span>
              </div>
              <Link to="/alertes" className="flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900">
                Tout voir <ArrowRight size={13} />
              </Link>
            </div>

            {alerts.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Sparkles size={20} />
                </div>
                <p className="mt-2 text-sm font-bold text-ink-900">Aucune alerte</p>
                <p className="text-xs text-ink-500">Vos niveaux de stock sont sains.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {alerts.slice(0, 5).map((line) => (
                  <li key={line.product.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <button
                      onClick={() => openDetail(line.product.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-ink-900">{line.product.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-400">
                        {line.supplierName} · seuil {line.product.reorderPoint} {line.product.unit}
                        {line.coverageDays !== null ? ` · ${line.coverageDays} j de couverture` : ' · pas de ventes récentes'}
                      </p>
                    </button>
                    <div className="hidden w-20 text-right sm:block">
                      <p
                        className={cx(
                          'text-sm font-extrabold',
                          line.status === 'out' ? 'text-rose-600' : 'text-amber-600',
                        )}
                      >
                        {line.product.stock}
                      </p>
                      <p className="text-[10px] font-semibold uppercase text-ink-400">{line.product.unit}</p>
                    </div>
                    <button
                      onClick={() => quickReceive(line.product.id, line.suggestedQty)}
                      className="btn-ghost h-9 shrink-0 px-2.5 text-xs"
                      title={`Réceptionner ${line.suggestedQty} ${line.product.unit}`}
                    >
                      <Plus size={14} />
                      <span className="hidden sm:inline">{line.suggestedQty}</span>
                      <span className="sm:hidden">Réappro</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Flow chart */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3.5 sm:px-5">
              <div>
                <h3 className="section-title">Flux de stock</h3>
                <p className="text-xs text-ink-400">Entrées et sorties sur 14 jours</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-ink-600">
                  <span className="h-2 w-2 rounded-full bg-brand-500" /> Entrées
                </span>
                <span className="flex items-center gap-1.5 text-ink-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Sorties
                </span>
              </div>
            </div>
            <div className="h-[210px] px-1 py-3 sm:px-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flow} margin={{ top: 5, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8792a8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#8792a8' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      fontSize: 12,
                      boxShadow: '0 8px 24px -12px rgba(14,19,32,.25)',
                    }}
                    labelStyle={{ fontWeight: 700, color: '#1c2230' }}
                    formatter={(value) => [`${Number(value)} unités`, '']}
                  />
                  <Area type="monotone" dataKey="inbound" stroke="#10b981" strokeWidth={2} fill="url(#inGrad)" />
                  <Area type="monotone" dataKey="outbound" stroke="#f59e0b" strokeWidth={2} fill="url(#outGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Best sellers */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3.5 sm:px-5">
              <div>
                <h3 className="section-title">Meilleures sorties · 30 jours</h3>
                <p className="text-xs text-ink-400">Les produits qui tournent le plus</p>
              </div>
              <Link to="/rapports" className="flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900">
                Rapports <ArrowRight size={13} />
              </Link>
            </div>
            {best.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">Pas encore de sortie enregistrée ce mois-ci.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {best.map(({ product, qty, value }) => (
                  <li key={product.id} className="px-4 py-2.5 sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <button onClick={() => openDetail(product.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-[13px] font-semibold text-ink-900">{product.name}</p>
                        <div className="mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-ink-100">
                          <div className="h-full rounded-full bg-ink-900" style={{ width: `${(qty / maxBest) * 100}%` }} />
                        </div>
                      </button>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-bold text-ink-900">
                          {qty} <span className="text-[10px] font-semibold text-ink-400">{product.unit}</span>
                        </p>
                        <p className="text-[10px] text-ink-400">{formatMoney(value, settings.currency, true)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <QuickActionsCard className="hidden lg:block" />

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3.5">
              <h3 className="section-title">Derniers mouvements</h3>
              <Link to="/mouvements" className="text-xs font-semibold text-ink-500 hover:text-ink-900">
                Tout
              </Link>
            </div>
            <ul className="divide-y divide-ink-100">
              {recent.map((m) => {
                const product = products.find((p) => p.id === m.productId)
                return (
                  <li key={m.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span
                      className={cx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        m.type === 'in' ? 'bg-brand-50 text-brand-700' : m.type === 'out' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-600',
                      )}
                    >
                      {m.type === 'in' ? <ArrowDownToLine size={13} /> : m.type === 'out' ? <ArrowUpFromLine size={13} /> : <SlidersHorizontal size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink-800">{product?.name ?? 'Produit supprimé'}</p>
                      <p className="truncate text-[10px] text-ink-400">
                        {m.reason} · {formatDateTimeShort(m.at)}
                      </p>
                    </div>
                    <span className={cx('shrink-0 text-[12px] font-bold', m.type === 'in' ? 'text-brand-700' : 'text-ink-800')}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}
                      {m.quantity}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="section-title">Répartition par catégorie</h3>
              <Link to="/stock" className="text-xs font-semibold text-ink-500 hover:text-ink-900">
                Stock
              </Link>
            </div>
            <ul className="space-y-2.5">
              {categories.map((c) => {
                const pct = stats.costValue > 0 ? (c.value / stats.costValue) * 100 : 0
                return (
                  <li key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="truncate font-semibold text-ink-700">{c.category}</span>
                      <span className="ml-2 shrink-0 font-semibold text-ink-400">{formatMoney(c.value, settings.currency, true)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500/80" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="rounded-2xl bg-ink-900 p-4 text-white">
            <div className="flex items-center gap-2 text-brand-300">
              <Boxes size={16} />
              <p className="text-[11px] font-bold uppercase tracking-wider">Conseil Kanti</p>
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug">
              {stats.out > 0
                ? `Vous avez ${stats.out} rupture(s). Générez un bon de commande groupé par fournisseur en un clic.`
                : 'Scannez un code-barres : la sortie de stock s’enregistre sans quitter le comptoir.'}
            </p>
            <button
              onClick={() => (stats.out > 0 ? openOrder() : openScanner())}
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-brand-300 hover:text-brand-200"
            >
              {stats.out > 0 ? 'Créer le bon de commande' : 'Essayer le scanner'} <ArrowRight size={13} />
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone = 'ink',
  to,
}: {
  label: string
  value: string
  hint: string
  icon: React.ReactNode
  tone?: 'ink' | 'ok' | 'danger'
  to?: string
}) {
  const body = (
    <div className="card card-hover h-full p-3.5 sm:p-4">
      <div className="flex items-start justify-between">
        <p className="stat-label">{label}</p>
        <span
          className={cx(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            tone === 'danger' ? 'bg-rose-50 text-rose-600' : tone === 'ok' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600',
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium text-ink-400">{hint}</p>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function QuickAction({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'primary' | 'brand'
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition active:scale-[0.98]',
        tone === 'primary'
          ? 'border-ink-900 bg-ink-900 text-white hover:bg-ink-800'
          : tone === 'brand'
            ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
            : 'border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
      )}
    >
      <span
        className={cx(
          'flex h-7 w-7 items-center justify-center rounded-lg',
          tone === 'primary' || tone === 'brand' ? 'bg-white/15 text-white' : 'bg-ink-100 text-ink-600',
        )}
      >
        {icon}
      </span>
      <span className="text-[12px] font-bold leading-tight">{label}</span>
    </button>
  )
}

function QuickActionsCard({ className }: { className?: string }) {
  const openMovementForm = useUI((s) => s.openMovementForm)
  const openProductForm = useUI((s) => s.openProductForm)
  const openOrder = useUI((s) => s.openOrder)
  const openScanner = useScanner((s) => s.openScanner)

  return (
    <section className={cx('card p-4', className)}>
      <h3 className="section-title mb-3">Actions rapides</h3>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
        <QuickAction
          icon={<ArrowUpFromLine size={17} />}
          label="Sortie"
          tone="primary"
          onClick={() => openMovementForm({ type: 'out' })}
        />
        <QuickAction
          icon={<ArrowDownToLine size={17} />}
          label="Entrée"
          tone="brand"
          onClick={() => openMovementForm({ type: 'in' })}
        />
        <QuickAction icon={<ScanBarcode size={17} />} label="Scanner" onClick={openScanner} />
        <QuickAction
          icon={<SlidersHorizontal size={17} />}
          label="Inventaire"
          onClick={() => openMovementForm({ type: 'adjust' })}
        />
        <QuickAction icon={<Plus size={17} />} label="Nouveau produit" onClick={() => openProductForm()} />
        <QuickAction icon={<ShoppingCart size={17} />} label="Bon de commande" onClick={() => openOrder()} />
      </div>
    </section>
  )
}
