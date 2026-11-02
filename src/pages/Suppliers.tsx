import { useMemo, useState } from 'react'
import { Mail, MapPin, Pencil, Phone, Plus, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { EmptyState, cx } from '../components/ui'
import { formatMoney, stockStatus } from '../lib/format'

export default function Suppliers() {
  const { suppliers, products, settings, deleteSupplier } = useData()
  const openSupplierForm = useUI((s) => s.openSupplierForm)
  const openOrder = useUI((s) => s.openOrder)
  const toast = useUI((s) => s.toast)
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return suppliers
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.contact.toLowerCase().includes(q))
      .map((supplier) => {
        const linked = products.filter((p) => p.supplierId === supplier.id)
        return {
          supplier,
          count: linked.length,
          alerts: linked.filter((p) => stockStatus(p) !== 'ok').length,
          value: linked.reduce((sum, p) => sum + p.stock * p.cost, 0),
        }
      })
  }, [suppliers, products, search])

  const unassigned = products.filter((p) => !p.supplierId).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Fournisseurs</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {suppliers.length} fournisseur(s) · {unassigned} produit(s) sans fournisseur
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input h-10 w-full sm:w-56"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => openSupplierForm()} className="btn-brand shrink-0">
            <Plus size={16} /> <span className="hidden sm:inline">Nouveau</span>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Truck size={22} />}
            title="Aucun fournisseur"
            description="Ajoutez vos fournisseurs pour préparer des bons de commande en un clic."
            action={
              <button onClick={() => openSupplierForm()} className="btn-brand">
                <Plus size={15} /> Ajouter un fournisseur
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ supplier, count, alerts, value }) => (
            <div key={supplier.id} className="card card-hover flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-brand-400">
                  <Truck size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink-900">{supplier.name}</p>
                  <p className="truncate text-[11px] text-ink-400">
                    {supplier.contact || '—'} · {supplier.city || 'ville non renseignée'}
                  </p>
                </div>
                {alerts > 0 ? <span className="chip shrink-0 bg-amber-100 text-amber-800">{alerts} alerte(s)</span> : null}
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-ink-50 py-2 text-center">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Produits</dt>
                  <dd className="text-sm font-extrabold text-ink-900">{count}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Valeur</dt>
                  <dd className="text-sm font-extrabold text-ink-900">{formatMoney(value, settings.currency, true)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Délai</dt>
                  <dd className="text-sm font-extrabold text-ink-900">{supplier.leadTimeDays} j</dd>
                </div>
              </dl>

              <div className="mt-3 space-y-1.5 text-[12px] text-ink-600">
                <p className="flex items-center gap-2">
                  <Phone size={13} className="text-ink-400" />
                  {supplier.phone ? <a href={`tel:${supplier.phone.replace(/\s/g, '')}`} className="hover:underline">{supplier.phone}</a> : '—'}
                </p>
                <p className="flex items-center gap-2">
                  <Mail size={13} className="text-ink-400" />
                  {supplier.email ? <a href={`mailto:${supplier.email}`} className="truncate hover:underline">{supplier.email}</a> : '—'}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin size={13} className="text-ink-400" />
                  {supplier.city || '—'}
                </p>
              </div>

              {supplier.notes ? (
                <p className="mt-2 line-clamp-2 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-900">
                  {supplier.notes}
                </p>
              ) : null}

              <div className="mt-3 flex gap-1.5 border-t border-ink-100 pt-3">
                <button
                  onClick={() => openOrder(supplier.id)}
                  disabled={alerts === 0}
                  className={cx('btn-ghost h-9 flex-1 text-xs', alerts === 0 && 'opacity-50')}
                  title={alerts === 0 ? 'Aucune alerte pour ce fournisseur' : 'Générer un bon de commande'}
                >
                  <ShoppingCart size={13} /> Commander
                </button>
                <button onClick={() => openSupplierForm({ supplierId: supplier.id })} className="btn-ghost h-9 w-9 p-0" title="Modifier">
                  <Pencil size={13} />
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm(`Supprimer le fournisseur « ${supplier.name} » ? Les produits liés seront détachés.`)) {
                      const res = await deleteSupplier(supplier.id)
                      toast(res.ok ? 'Fournisseur supprimé' : (res.error ?? 'Suppression impossible'), res.ok ? 'info' : 'error')
                    }
                  }}
                  className="btn-ghost h-9 w-9 p-0 text-ink-400 hover:text-rose-600"
                  title="Supprimer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
