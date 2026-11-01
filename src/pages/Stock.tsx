import { useMemo, useState } from 'react'
import {
  ArrowDownUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Barcode,
  Download,
  Filter,
  Package,
  PackagePlus,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { StockBar, StatusBadge, EmptyState, cx } from '../components/ui'
import ImportModal from '../components/ImportModal'
import { formatMoney, marginPercent, stockStatus } from '../lib/format'
import { exportProductsCSV } from '../lib/csv'

type StatusFilter = 'all' | 'ok' | 'low' | 'out'
type SortKey = 'name' | 'stock' | 'value' | 'margin' | 'updated'

const PAGE_SIZE = 20

export default function Stock() {
  const { products, suppliers, settings } = useData()
  const openDetail = useUI((s) => s.openDetail)
  const openProductForm = useUI((s) => s.openProductForm)
  const openMovementForm = useUI((s) => s.openMovementForm)
  const toast = useUI((s) => s.toast)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState('all')
  const [supplierId, setSupplierId] = useState('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [importOpen, setImportOpen] = useState(false)

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'fr')),
    [products],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = products.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q))) return false
      if (category !== 'all' && p.category !== category) return false
      if (supplierId !== 'all' && p.supplierId !== supplierId) return false
      if (status !== 'all' && stockStatus(p) !== status) return false
      return true
    })
    return list.sort((a, b) => {
      switch (sort) {
        case 'stock':
          return a.stock - b.stock
        case 'value':
          return b.stock * b.cost - a.stock * a.cost
        case 'margin':
          return marginPercent(b) - marginPercent(a)
        case 'updated':
          return b.updatedAt.localeCompare(a.updatedAt)
        default:
          return a.name.localeCompare(b.name, 'fr')
      }
    })
  }, [products, search, category, supplierId, status, sort])

  const visible = filtered.slice(0, limit)
  const activeFilters = [category !== 'all', supplierId !== 'all', status !== 'all', search.trim() !== ''].filter(Boolean).length

  const resetFilters = () => {
    setSearch('')
    setStatus('all')
    setCategory('all')
    setSupplierId('all')
    setLimit(PAGE_SIZE)
  }

  const stockValue = filtered.reduce((sum, p) => sum + p.stock * p.cost, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Stock</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {filtered.length} produit(s) · {formatMoney(stockValue, settings.currency)} de valeur d’achat
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setImportOpen(true)} className="btn-ghost">
            <Upload size={16} /> Importer
          </button>
          <button
            onClick={() => {
              exportProductsCSV(filtered, suppliers)
              toast('Export CSV téléchargé')
            }}
            className="btn-ghost"
          >
            <Download size={16} /> <span className="hidden sm:inline">Exporter</span>
          </button>
          <button onClick={() => openProductForm()} className="btn-brand">
            <PackagePlus size={16} /> Nouveau produit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input pl-9 pr-9"
              placeholder="Rechercher un produit, SKU ou code-barres…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setLimit(PAGE_SIZE)
              }}
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                aria-label="Effacer"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex overflow-hidden rounded-xl border border-ink-200 p-0.5">
              {(
                [
                  ['all', 'Tous'],
                  ['ok', 'En stock'],
                  ['low', 'Bas'],
                  ['out', 'Rupture'],
                ] as [StatusFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setStatus(key)
                    setLimit(PAGE_SIZE)
                  }}
                  className={cx(
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                    status === key ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className="rounded-xl border border-ink-200 bg-white px-2.5 py-2 text-xs font-semibold text-ink-700"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setLimit(PAGE_SIZE)
              }}
            >
              <option value="all">Toutes catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-ink-200 bg-white px-2.5 py-2 text-xs font-semibold text-ink-700"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value)
                setLimit(PAGE_SIZE)
              }}
            >
              <option value="all">Tous fournisseurs</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <ArrowDownUp size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <select
                className="rounded-xl border border-ink-200 bg-white py-2 pl-8 pr-2.5 text-xs font-semibold text-ink-700"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="name">Nom A→Z</option>
                <option value="stock">Stock croissant</option>
                <option value="value">Valeur décroissante</option>
                <option value="margin">Marge décroissante</option>
                <option value="updated">Modifié récemment</option>
              </select>
            </div>
          </div>
        </div>
        {activeFilters > 0 ? (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500">
            <Filter size={12} /> {activeFilters} filtre(s) actif(s)
            <button onClick={resetFilters} className="font-semibold text-brand-700 hover:underline">
              Réinitialiser
            </button>
          </div>
        ) : null}
      </div>

      {/* Table desktop */}
      <div className="card hidden overflow-hidden lg:block">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-head">Produit</th>
              <th className="table-head">Stock</th>
              <th className="table-head">Seuil</th>
              <th className="table-head text-right">Achat</th>
              <th className="table-head text-right">Vente</th>
              <th className="table-head text-right">Marge</th>
              <th className="table-head">Fournisseur</th>
              <th className="table-head text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const supplier = suppliers.find((s) => s.id === p.supplierId)
              return (
                <tr key={p.id} className="group transition hover:bg-ink-50/60">
                  <td className="table-cell">
                    <button onClick={() => openDetail(p.id)} className="flex items-center gap-3 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-[11px] font-extrabold text-ink-500">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">{p.name}</span>
                        <span className="block truncate text-[11px] text-ink-400">
                          {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ''}
                          {p.location ? ` · ${p.location}` : ''}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="table-cell">
                    <div className="w-32">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={cx(
                            'text-sm font-extrabold',
                            stockStatus(p) === 'out' ? 'text-rose-600' : stockStatus(p) === 'low' ? 'text-amber-600' : 'text-ink-900',
                          )}
                        >
                          {p.stock}{' '}
                          <span className="text-[10px] font-semibold uppercase text-ink-400">{p.unit}</span>
                        </span>
                        <StatusBadge product={p} compact />
                      </div>
                      <div className="mt-1">
                        <StockBar product={p} />
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-ink-500">{p.reorderPoint}</td>
                  <td className="table-cell text-right text-ink-600">{formatMoney(p.cost, settings.currency)}</td>
                  <td className="table-cell text-right font-semibold text-ink-900">{formatMoney(p.price, settings.currency)}</td>
                  <td className="table-cell text-right">
                    <span
                      className={cx(
                        'chip',
                        marginPercent(p) < 10 ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700',
                      )}
                    >
                      {marginPercent(p).toFixed(0)} %
                    </span>
                  </td>
                  <td className="table-cell text-[12px] text-ink-500">{supplier?.name ?? '—'}</td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => openMovementForm({ productId: p.id, type: 'out' })}
                        className="btn-ghost h-8 w-8 p-0"
                        title="Sortie de stock"
                      >
                        <ArrowUpFromLine size={14} />
                      </button>
                      <button
                        onClick={() => openMovementForm({ productId: p.id, type: 'in' })}
                        className="btn-ghost h-8 w-8 p-0"
                        title="Entrée de stock"
                      >
                        <ArrowDownToLine size={14} />
                      </button>
                      <button
                        onClick={() => openMovementForm({ productId: p.id, type: 'adjust' })}
                        className="btn-ghost h-8 w-8 p-0"
                        title="Inventaire"
                      >
                        <Barcode size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <EmptyState
            icon={<Package size={22} />}
            title="Aucun produit ne correspond"
            description="Modifiez vos filtres ou créez une nouvelle fiche produit."
            action={
              <button onClick={resetFilters} className="btn-ghost">
                Réinitialiser les filtres
              </button>
            }
          />
        ) : null}
      </div>

      {/* Cards mobile */}
      <div className="space-y-2 lg:hidden">
        {visible.map((p) => {
          const supplier = suppliers.find((s) => s.id === p.supplierId)
          return (
            <div key={p.id} className="card p-3.5">
              <div className="flex items-start gap-3">
                <button onClick={() => openDetail(p.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-ink-900">{p.name}</p>
                    <StatusBadge product={p} compact />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-400">
                    {p.sku} · {p.category}
                    {supplier ? ` · ${supplier.name}` : ''}
                  </p>
                </button>
                <div className="shrink-0 text-right">
                  <p
                    className={cx(
                      'text-lg font-extrabold leading-none',
                      stockStatus(p) === 'out' ? 'text-rose-600' : stockStatus(p) === 'low' ? 'text-amber-600' : 'text-ink-900',
                    )}
                  >
                    {p.stock}
                  </p>
                  <p className="text-[10px] font-semibold uppercase text-ink-400">{p.unit}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex-1">
                  <StockBar product={p} />
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-ink-400">
                  {formatMoney(p.price, settings.currency)}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                <button onClick={() => openMovementForm({ productId: p.id, type: 'out' })} className="btn-ghost h-9 text-xs">
                  <ArrowUpFromLine size={13} /> Sortie
                </button>
                <button onClick={() => openMovementForm({ productId: p.id, type: 'in' })} className="btn-ghost h-9 text-xs">
                  <ArrowDownToLine size={13} /> Entrée
                </button>
                <button onClick={() => openMovementForm({ productId: p.id, type: 'adjust' })} className="btn-ghost h-9 text-xs">
                  <Barcode size={13} /> Inventaire
                </button>
              </div>
            </div>
          )
        })}
        {visible.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Package size={22} />}
              title="Aucun produit ne correspond"
              description="Modifiez vos filtres ou créez une fiche produit."
              action={
                <button onClick={() => openProductForm()} className="btn-brand">
                  <Plus size={15} /> Nouveau produit
                </button>
              }
            />
          </div>
        ) : null}
      </div>

      {filtered.length > limit ? (
        <div className="flex justify-center py-2">
          <button onClick={() => setLimit((l) => l + PAGE_SIZE)} className="btn-ghost">
            Afficher {Math.min(PAGE_SIZE, filtered.length - limit)} produits de plus
          </button>
        </div>
      ) : null}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
