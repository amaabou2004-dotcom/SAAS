import { useMemo } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Barcode,
  CalendarClock,
  MapPin,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Truck,
} from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { useNavigate } from 'react-router-dom'
import { Modal, StockBar, StatusBadge, cx } from './ui'
import { formatDateTimeShort, formatMoney, formatNumber, marginPercent } from '../lib/format'
import { avgDailyOut } from '../lib/analytics'

export default function ProductDetail() {
  const detailId = useUI((s) => s.detailProductId)
  const closeDetail = useUI((s) => s.closeDetail)
  const openMovementForm = useUI((s) => s.openMovementForm)
  const openProductForm = useUI((s) => s.openProductForm)
  const toast = useUI((s) => s.toast)
  const { products, suppliers, movements, settings, deleteProduct } = useData()
  const navigate = useNavigate()

  const product = useMemo(() => products.find((p) => p.id === detailId), [products, detailId])
  const history = useMemo(
    () => movements.filter((m) => m.productId === detailId).slice(0, 10),
    [movements, detailId],
  )

  if (!product) return null

  const supplier = suppliers.find((s) => s.id === product.supplierId)
  const daily = avgDailyOut(movements, product.id)
  const coverage = daily > 0 ? Math.round(product.stock / daily) : null
  const out30 = movements
    .filter((m) => m.productId === product.id && m.type === 'out' && new Date(m.at).getTime() > Date.now() - 30 * 86_400_000)
    .reduce((sum, m) => sum + m.quantity, 0)

  const act = (type: 'in' | 'out' | 'adjust') => {
    closeDetail()
    setTimeout(() => openMovementForm({ productId: product.id, type }), 60)
  }

  return (
    <Modal
      open={Boolean(product)}
      onClose={closeDetail}
      size="lg"
      title={product.name}
      subtitle={`${product.sku} · ${product.category}`}
      footer={
        <div className="flex w-full flex-wrap gap-2">
          <button onClick={() => act('out')} className="btn-primary flex-1">
            <ArrowUpFromLine size={16} /> Sortie
          </button>
          <button onClick={() => act('in')} className="btn-brand flex-1">
            <ArrowDownToLine size={16} /> Entrée
          </button>
          <button onClick={() => act('adjust')} className="btn-ghost flex-1">
            <SlidersHorizontal size={16} /> Inventaire
          </button>
          <button
            onClick={() => {
              closeDetail()
              setTimeout(() => openProductForm({ productId: product.id }), 60)
            }}
            className="btn-ghost h-11 w-11 shrink-0 p-0"
            aria-label="Modifier"
          >
            <Pencil size={16} />
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Metric label="Stock" value={formatNumber(product.stock)} hint={product.unit} tone={product.stock <= 0 ? 'danger' : product.stock <= product.reorderPoint ? 'warn' : 'ok'} />
          <Metric label="Valeur stock" value={formatMoney(product.stock * product.cost, settings.currency, true)} hint="au prix d’achat" />
          <Metric label="Sorties 30 j" value={formatNumber(out30)} hint={`${formatNumber(daily)} / jour`} />
          <Metric label="Couverture" value={coverage === null ? '—' : `${coverage} j`} hint="au rythme actuel" />
        </div>

        <div className="rounded-xl border border-ink-200 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-700">Niveau de stock</span>
            <StatusBadge product={product} />
          </div>
          <StockBar product={product} />
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
            <span>0</span>
            <span>Seuil {product.reorderPoint}</span>
            <span>{Math.max(product.reorderPoint * 2, product.stock)}</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <InfoRow icon={<Truck size={15} />} label="Fournisseur" value={supplier?.name ?? 'Non défini'} sub={supplier ? `Délai ${supplier.leadTimeDays} j · ${supplier.phone}` : undefined} />
          <InfoRow icon={<MapPin size={15} />} label="Emplacement" value={product.location || 'Non défini'} />
          <InfoRow icon={<Barcode size={15} />} label="Code-barres" value={product.barcode || 'Aucun'} />
          <InfoRow
            icon={<CalendarClock size={15} />}
            label="Dernière mise à jour"
            value={formatDateTimeShort(product.updatedAt)}
          />
        </div>

        <div className="grid grid-cols-3 divide-x divide-ink-100 rounded-xl border border-ink-200 py-3 text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Achat</p>
            <p className="mt-0.5 text-sm font-bold text-ink-900">{formatMoney(product.cost, settings.currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Vente</p>
            <p className="mt-0.5 text-sm font-bold text-ink-900">{formatMoney(product.price, settings.currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Marge</p>
            <p className={cx('mt-0.5 text-sm font-bold', marginPercent(product) < 10 ? 'text-amber-600' : 'text-brand-700')}>
              {marginPercent(product).toFixed(0)} %
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="section-title text-sm">Derniers mouvements</p>
            <button
              onClick={() => {
                closeDetail()
                navigate(`/mouvements?produit=${product.id}`)
              }}
              className="text-xs font-semibold text-ink-500 hover:text-ink-900"
            >
              Tout voir
            </button>
          </div>
          {history.length === 0 ? (
            <p className="rounded-xl bg-ink-50 px-3 py-6 text-center text-sm text-ink-400">Aucun mouvement enregistré.</p>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200">
              {history.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      m.type === 'in' ? 'bg-brand-50 text-brand-700' : m.type === 'out' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-600',
                    )}
                  >
                    {m.type === 'in' ? <ArrowDownToLine size={13} /> : m.type === 'out' ? <ArrowUpFromLine size={13} /> : <SlidersHorizontal size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink-800">{m.reason}</p>
                    <p className="text-[11px] text-ink-400">
                      {formatDateTimeShort(m.at)} · {m.user}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cx(
                        'text-[13px] font-bold',
                        m.type === 'in' ? 'text-brand-700' : m.type === 'out' ? 'text-ink-900' : 'text-ink-700',
                      )}
                    >
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}
                      {m.quantity}
                    </p>
                    <p className="text-[11px] text-ink-400">→ {m.stockAfter}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={async () => {
            if (
              window.confirm(
                `Supprimer « ${product.name} » ? Un produit déjà mouvementé sera archivé (historique conservé).`,
              )
            ) {
              const res = await deleteProduct(product.id)
              closeDetail()
              if (!res.ok) toast(res.error ?? 'Suppression impossible', 'error')
              else toast(res.archived ? 'Produit archivé (historique conservé)' : 'Produit supprimé', 'info')
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 hover:text-rose-600"
        >
          <Trash2 size={13} /> Supprimer ce produit
        </button>
      </div>
    </Modal>
  )
}

function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'ok' | 'warn' | 'danger'
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{label}</p>
      <p
        className={cx(
          'mt-0.5 text-lg font-extrabold leading-tight',
          tone === 'danger' ? 'text-rose-600' : tone === 'warn' ? 'text-amber-600' : 'text-ink-900',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[10px] font-medium text-ink-400">{hint}</p> : null}
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-ink-200 px-3 py-2.5">
      <span className="mt-0.5 text-ink-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{label}</p>
        <p className="truncate text-[13px] font-semibold text-ink-800">{value}</p>
        {sub ? <p className="truncate text-[11px] text-ink-400">{sub}</p> : null}
      </div>
    </div>
  )
}

