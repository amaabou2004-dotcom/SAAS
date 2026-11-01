import { useMemo } from 'react'
import {
  ArrowRight,
  BellRing,
  Check,
  Download,
  PackageCheck,
  Plus,
  ShoppingCart,
  Truck,
  XCircle,
} from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { EmptyState, cx } from '../components/ui'
import { formatMoney } from '../lib/format'
import { buildAlertLines, orderLinesBySupplier } from '../lib/analytics'
import { downloadFile, toCSV } from '../lib/csv'

export default function Alerts() {
  const { products, suppliers, movements, settings, addMovement } = useData()
  const openDetail = useUI((s) => s.openDetail)
  const openOrder = useUI((s) => s.openOrder)
  const openSupplierForm = useUI((s) => s.openSupplierForm)
  const toast = useUI((s) => s.toast)

  const lines = useMemo(() => buildAlertLines(products, suppliers, movements), [products, suppliers, movements])
  const groups = useMemo(() => orderLinesBySupplier(lines), [lines])

  const outCount = lines.filter((l) => l.status === 'out').length
  const lowCount = lines.filter((l) => l.status === 'low').length
  const estimated = lines.reduce((sum, l) => sum + l.estimatedCost, 0)

  const receive = (productId: string, qty: number) => {
    const res = addMovement({
      productId,
      type: 'in',
      quantity: qty,
      reason: 'Réception fournisseur',
      note: 'Réapprovisionnement depuis les alertes',
    })
    toast(res.ok ? 'Réapprovisionnement enregistré' : (res.error ?? 'Action impossible'), res.ok ? 'success' : 'error')
  }

  const receiveGroup = (supplierId: string | null) => {
    const group = groups.find((g) => g.supplierId === supplierId)
    if (!group) return
    group.lines.forEach((line) => {
      addMovement({
        productId: line.product.id,
        type: 'in',
        quantity: line.suggestedQty,
        reason: 'Réception fournisseur',
        note: `Réception groupée · ${group.supplierName}`,
      })
    })
    toast(`${group.lines.length} produit(s) réceptionné(s) · ${group.supplierName}`)
  }

  const exportAlerts = () => {
    const headers = ['Produit', 'SKU', 'Stock', 'Seuil', 'Unité', 'Fournisseur', 'Couverture (j)', 'Qté suggérée', 'Coût estimé']
    const rows = lines.map((l) => [
      l.product.name,
      l.product.sku,
      l.product.stock,
      l.product.reorderPoint,
      l.product.unit,
      l.supplierName,
      l.coverageDays ?? '',
      l.suggestedQty,
      l.estimatedCost,
    ])
    downloadFile('kanti-alertes-stock.csv', toCSV(headers, rows))
    toast('Liste des alertes exportée')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Alertes de stock</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {lines.length === 0 ? 'Tous vos niveaux de stock sont sains.' : `${lines.length} produit(s) nécessitent votre attention`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportAlerts} disabled={lines.length === 0} className="btn-ghost">
            <Download size={16} /> <span className="hidden sm:inline">Exporter</span>
          </button>
          <button onClick={() => openOrder()} disabled={lines.length === 0} className="btn-brand">
            <ShoppingCart size={16} /> Bon de commande
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={<XCircle size={16} />} tone="danger" label="En rupture" value={String(outCount)} hint="stock à zéro" />
        <StatCard icon={<BellRing size={16} />} tone="warn" label="Sous le seuil" value={String(lowCount)} hint="à réapprovisionner" />
        <StatCard
          icon={<ShoppingCart size={16} />}
          tone="ink"
          label="Réappro. estimé"
          value={formatMoney(estimated, settings.currency, true)}
          hint={`${groups.length} fournisseur(s)`}
        />
        <StatCard
          icon={<PackageCheck size={16} />}
          tone="ok"
          label="Produits sains"
          value={String(products.filter((p) => p.active).length - lines.length)}
          hint={`sur ${products.filter((p) => p.active).length} références`}
        />
      </div>

      {lines.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<PackageCheck size={22} />}
            title="Aucune alerte, tout va bien"
            description="Les seuils d’alerte sont respectés. Vous serez prévenu dès qu’un produit passera sous son seuil."
            action={
              <button onClick={() => openOrder()} className="btn-ghost">
                Voir les suggestions de commande
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.supplierId ?? 'none'} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 bg-ink-50/40 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-ink-500 shadow-sm">
                  <Truck size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{group.supplierName}</p>
                  <p className="text-[11px] text-ink-500">
                    {group.lines.length} référence(s) · {formatMoney(group.total, settings.currency)} estimé
                    {group.supplierId
                      ? ` · délai ${suppliers.find((s) => s.id === group.supplierId)?.leadTimeDays ?? '—'} j`
                      : ' · affectez un fournisseur aux produits'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openSupplierForm()} className="btn-ghost h-8 px-2.5 text-xs">
                    <Plus size={13} /> Fournisseur
                  </button>
                  <button onClick={() => receiveGroup(group.supplierId)} className="btn-ghost h-8 px-2.5 text-xs">
                    <Check size={13} /> Tout réceptionner
                  </button>
                  <button
                    onClick={() => openOrder(group.supplierId)}
                    disabled={!group.supplierId}
                    className="btn-primary h-8 px-2.5 text-xs"
                  >
                    <ShoppingCart size={13} /> Commander
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-ink-100">
                {group.lines.map((line) => (
                  <li key={line.product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span
                      className={cx(
                        'h-2 w-2 shrink-0 rounded-full',
                        line.status === 'out' ? 'bg-rose-500' : 'bg-amber-500',
                      )}
                    />
                    <button onClick={() => openDetail(line.product.id)} className="min-w-0 flex-1 text-left">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink-900">
                        {line.product.name}
                        {line.status === 'out' ? (
                          <span className="chip bg-rose-100 text-rose-700">Rupture</span>
                        ) : (
                          <span className="chip bg-amber-100 text-amber-800">Bas</span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-ink-400">
                        {line.product.sku} · seuil {line.product.reorderPoint} {line.product.unit}
                        {line.coverageDays !== null
                          ? ` · couverture ${line.coverageDays} j`
                          : ' · aucune sortie sur 30 j'}
                        {line.avgDaily ? ` · ventes ${line.avgDaily.toFixed(1)}/j` : ''}
                      </p>
                    </button>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={cx('text-lg font-extrabold leading-none', line.status === 'out' ? 'text-rose-600' : 'text-amber-600')}>
                          {line.product.stock}
                        </p>
                        <p className="text-[10px] font-semibold uppercase text-ink-400">en stock</p>
                      </div>
                      <div className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-right">
                        <p className="text-[13px] font-bold text-ink-900">
                          +{line.suggestedQty} <span className="text-[10px] font-medium text-ink-400">{line.product.unit}</span>
                        </p>
                        <p className="text-[10px] text-ink-400">{formatMoney(line.estimatedCost, settings.currency, true)}</p>
                      </div>
                      <button
                        onClick={() => receive(line.product.id, line.suggestedQty)}
                        className="btn-ghost h-9 px-2.5 text-xs"
                        title="Enregistrer une réception"
                      >
                        <Check size={14} /> <span className="hidden sm:inline">Réceptionner</span>
                      </button>
                      <button
                        onClick={() => openDetail(line.product.id)}
                        className="btn-subtle h-9 w-8 p-0"
                        aria-label="Voir la fiche"
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone: 'danger' | 'warn' | 'ok' | 'ink'
}) {
  const colors = {
    danger: 'bg-rose-50 text-rose-600',
    warn: 'bg-amber-50 text-amber-600',
    ok: 'bg-brand-50 text-brand-700',
    ink: 'bg-ink-100 text-ink-600',
  }
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <p className="stat-label">{label}</p>
        <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg', colors[tone])}>{icon}</span>
      </div>
      <p className="mt-1.5 text-xl font-extrabold text-ink-900">{value}</p>
      <p className="text-[10px] font-medium text-ink-400">{hint}</p>
    </div>
  )
}
