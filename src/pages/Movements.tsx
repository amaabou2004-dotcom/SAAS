import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Download,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { EmptyState, cx } from '../components/ui'
import { formatDateTimeShort, formatMoney, formatNumber } from '../lib/format'
import { exportMovementsCSV } from '../lib/csv'
import type { MovementType } from '../lib/types'

type TypeFilter = 'all' | MovementType
const PAGE_SIZE = 25

export default function Movements() {
  const { products, movements, settings, undoMovement } = useData()
  const openMovementForm = useUI((s) => s.openMovementForm)
  const setDetail = useUI((s) => s.openDetail)
  const toast = useUI((s) => s.toast)
  const [params, setParams] = useSearchParams()

  const productFilter = params.get('produit')
  const product = products.find((p) => p.id === productFilter)

  const [type, setType] = useState<TypeFilter>('all')
  const [days, setDays] = useState(30)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const since = Date.now() - days * 86_400_000
    const q = search.trim().toLowerCase()
    return movements.filter((m) => {
      if (new Date(m.at).getTime() < since) return false
      if (type !== 'all' && m.type !== type) return false
      if (productFilter && m.productId !== productFilter) return false
      if (q) {
        const p = products.find((x) => x.id === m.productId)
        const haystack = `${p?.name ?? ''} ${p?.sku ?? ''} ${m.reason} ${m.reference ?? ''} ${m.user} ${m.note ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [movements, days, type, search, productFilter, products])

  const totals = useMemo(() => {
    let inbound = 0
    let outbound = 0
    let value = 0
    filtered.forEach((m) => {
      if (m.type === 'in') inbound += m.quantity
      if (m.type === 'out') {
        outbound += m.quantity
        value += m.quantity * m.unitCost
      }
    })
    return { inbound, outbound, count: filtered.length, value }
  }, [filtered])

  const undo = (id: string) => {
    const res = undoMovement(id)
    if (res.ok) toast('Mouvement annulé, stock rétabli', 'info')
    else toast(res.error ?? 'Annulation impossible', 'error')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Mouvements</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Historique complet des entrées, sorties et inventaires
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              exportMovementsCSV(filtered, products)
              toast('Historique exporté en CSV')
            }}
            className="btn-ghost"
          >
            <Download size={16} /> <span className="hidden sm:inline">Exporter</span>
          </button>
          <button onClick={() => openMovementForm()} className="btn-brand">
            <Plus size={16} /> Nouveau mouvement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="card p-3">
          <p className="stat-label">Entrées</p>
          <p className="mt-1 text-lg font-extrabold text-brand-700">+{formatNumber(totals.inbound)}</p>
          <p className="text-[10px] font-medium text-ink-400">unités sur la période</p>
        </div>
        <div className="card p-3">
          <p className="stat-label">Sorties</p>
          <p className="mt-1 text-lg font-extrabold text-ink-900">−{formatNumber(totals.outbound)}</p>
          <p className="text-[10px] font-medium text-ink-400">unités sur la période</p>
        </div>
        <div className="card p-3">
          <p className="stat-label">Valeur sortie</p>
          <p className="mt-1 text-lg font-extrabold text-ink-900">{formatMoney(totals.value, settings.currency, true)}</p>
          <p className="text-[10px] font-medium text-ink-400">{totals.count} mouvement(s)</p>
        </div>
      </div>

      <div className="card p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Produit, référence, motif, utilisateur…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(PAGE_SIZE)
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <div className="flex overflow-hidden rounded-xl border border-ink-200 p-0.5">
              {(
                [
                  ['all', 'Tous'],
                  ['in', 'Entrées'],
                  ['out', 'Sorties'],
                  ['adjust', 'Inventaires'],
                ] as [TypeFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setType(key)
                    setLimit(PAGE_SIZE)
                  }}
                  className={cx(
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                    type === key ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-xl border border-ink-200 p-0.5">
              {[7, 30, 90, 3650].map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDays(d)
                    setLimit(PAGE_SIZE)
                  }}
                  className={cx(
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                    days === d ? 'bg-ink-100 text-ink-900' : 'text-ink-500 hover:text-ink-900',
                  )}
                >
                  {d === 3650 ? 'Tout' : `${d} j`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {product ? (
          <div className="mt-2.5 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-white">
            Produit : {product.name}
            <button
              onClick={() => {
                const next = new URLSearchParams(params)
                next.delete('produit')
                setParams(next)
              }}
              className="text-white/70 hover:text-white"
              aria-label="Retirer le filtre produit"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="card overflow-hidden">
        <div className="hidden lg:block">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Date</th>
                <th className="table-head">Type</th>
                <th className="table-head">Produit</th>
                <th className="table-head text-right">Quantité</th>
                <th className="table-head">Motif</th>
                <th className="table-head">Utilisateur</th>
                <th className="table-head text-right">Stock après</th>
                <th className="table-head" />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((m) => {
                const p = products.find((x) => x.id === m.productId)
                return (
                  <tr key={m.id} className="group hover:bg-ink-50/60">
                    <td className="table-cell whitespace-nowrap text-[12px] text-ink-500">{formatDateTimeShort(m.at)}</td>
                    <td className="table-cell">
                      <span
                        className={cx(
                          'chip',
                          m.type === 'in'
                            ? 'bg-brand-50 text-brand-700'
                            : m.type === 'out'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-ink-100 text-ink-700',
                        )}
                      >
                        {m.type === 'in' ? <ArrowDownToLine size={11} /> : m.type === 'out' ? <ArrowUpFromLine size={11} /> : <SlidersHorizontal size={11} />}
                        {m.type === 'in' ? 'Entrée' : m.type === 'out' ? 'Sortie' : 'Inventaire'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => p && setDetail(p.id)} className="text-left">
                        <span className="block font-semibold text-ink-900 hover:underline">{p?.name ?? 'Produit supprimé'}</span>
                        <span className="block text-[11px] text-ink-400">
                          {p?.sku} {m.reference ? `· ${m.reference}` : ''}
                        </span>
                      </button>
                    </td>
                    <td className={cx('table-cell text-right font-bold', m.type === 'in' ? 'text-brand-700' : 'text-ink-900')}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}
                      {m.quantity}{' '}
                      <span className="text-[10px] font-medium text-ink-400">{p?.unit}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-[13px] text-ink-700">{m.reason}</span>
                      {m.note ? <span className="block text-[11px] text-ink-400">{m.note}</span> : null}
                    </td>
                    <td className="table-cell text-[12px] text-ink-500">{m.user}</td>
                    <td className="table-cell text-right text-[13px] font-semibold text-ink-700">{m.stockAfter}</td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => undo(m.id)}
                        className="btn-subtle h-8 w-8 p-0 opacity-0 transition group-hover:opacity-100"
                        title="Annuler ce mouvement"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-ink-100 lg:hidden">
          {filtered.slice(0, limit).map((m) => {
            const p = products.find((x) => x.id === m.productId)
            return (
              <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cx(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    m.type === 'in' ? 'bg-brand-50 text-brand-700' : m.type === 'out' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-600',
                  )}
                >
                  {m.type === 'in' ? <ArrowDownToLine size={14} /> : m.type === 'out' ? <ArrowUpFromLine size={14} /> : <SlidersHorizontal size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => p && setDetail(p.id)} className="min-w-0 text-left">
                      <p className="truncate text-[13px] font-bold text-ink-900">{p?.name ?? 'Produit supprimé'}</p>
                    </button>
                    <span className={cx('shrink-0 text-sm font-extrabold', m.type === 'in' ? 'text-brand-700' : 'text-ink-900')}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '='}
                      {m.quantity}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-ink-500">
                    {m.reason} · {formatDateTimeShort(m.at)}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
                    <span>Stock après : {m.stockAfter}</span>
                    <span>·</span>
                    <span>{m.user}</span>
                    <button onClick={() => undo(m.id)} className="ml-auto flex items-center gap-1 font-semibold text-ink-500 hover:text-rose-600">
                      <RotateCcw size={11} /> Annuler
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight size={22} />}
            title="Aucun mouvement sur cette période"
            description="Élargissez la période ou enregistrez un nouveau mouvement."
            action={
              <button onClick={() => openMovementForm()} className="btn-brand">
                <Plus size={15} /> Nouveau mouvement
              </button>
            }
          />
        ) : null}
      </div>

      {filtered.length > limit ? (
        <div className="flex justify-center">
          <button onClick={() => setLimit((l) => l + PAGE_SIZE)} className="btn-ghost">
            Afficher plus ({filtered.length - limit} restants)
          </button>
        </div>
      ) : null}
    </div>
  )
}
