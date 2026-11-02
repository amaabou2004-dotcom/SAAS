import { useEffect, useMemo, useState } from 'react'
import { Package, Plus, Sparkles } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { Modal, Field, cx } from './ui'
import { CATEGORIES, UNITS, formatMoney, stockStatus } from '../lib/format'

type Form = {
  name: string
  sku: string
  barcode: string
  category: string
  unit: string
  cost: string
  price: string
  stock: string
  reorderPoint: string
  reorderQty: string
  supplierId: string
  location: string
  active: boolean
}

const EMPTY: Form = {
  name: '',
  sku: '',
  barcode: '',
  category: 'Alimentation',
  unit: 'pièce',
  cost: '',
  price: '',
  stock: '0',
  reorderPoint: '5',
  reorderQty: '10',
  supplierId: '',
  location: '',
  active: true,
}

export default function ProductForm() {
  const { open, productId, defaults } = useUI((s) => s.productForm)
  const close = useUI((s) => s.closeProductForm)
  const { products, suppliers, settings, addProduct, updateProduct } = useData()
  const toast = useUI((s) => s.toast)
  const openMovementForm = useUI((s) => s.openMovementForm)
  const [form, setForm] = useState<Form>(EMPTY)
  const [error, setError] = useState('')

  const existing = useMemo(() => products.find((p) => p.id === productId), [products, productId])

  useEffect(() => {
    if (!open) return
    setError('')
    if (existing) {
      setForm({
        name: existing.name,
        sku: existing.sku,
        barcode: existing.barcode,
        category: existing.category,
        unit: existing.unit,
        cost: String(existing.cost),
        price: String(existing.price),
        stock: String(existing.stock),
        reorderPoint: String(existing.reorderPoint),
        reorderQty: String(existing.reorderQty),
        supplierId: existing.supplierId ?? '',
        location: existing.location,
        active: existing.active,
      })
    } else {
      setForm({ ...EMPTY, ...(defaults ? { barcode: defaults.barcode ?? '', name: defaults.name ?? '' } : {}) })
    }
  }, [open, existing, defaults])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const cost = Number(form.cost.replace(',', '.')) || 0
  const price = Number(form.price.replace(',', '.')) || 0
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0
  const isValid = form.name.trim().length > 0

  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    if (!isValid) {
      setError('Le nom du produit est obligatoire.')
      return
    }
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode.trim(),
      category: form.category,
      unit: form.unit,
      cost,
      price,
      reorderPoint: Math.max(0, Number(form.reorderPoint) || 0),
      reorderQty: Math.max(1, Number(form.reorderQty) || 1),
      supplierId: form.supplierId || null,
      location: form.location.trim(),
      active: form.active,
    }

    setBusy(true)
    try {
      if (existing) {
        await updateProduct(existing.id, payload)
        toast('Produit mis à jour')
      } else {
        const initialStock = Math.max(0, Number(form.stock) || 0)
        await addProduct({ ...payload, stock: initialStock })
        toast(`${payload.name} ajouté${initialStock > 0 ? ` · stock initial ${initialStock}` : ''}`)
      }
      close()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const currency = settings.currency

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={existing ? 'Modifier le produit' : 'Nouveau produit'}
      subtitle={existing ? `${existing.sku} · ${existing.stock} ${existing.unit} en stock` : 'Fiche produit complète en moins d’une minute'}
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Package size={18} />
        </span>
      }
      footer={
        <>
          <button onClick={close} className="btn-ghost flex-1 sm:flex-none">
            Annuler
          </button>
          <button onClick={submit} disabled={busy} className="btn-brand flex-1 sm:flex-none">
            {busy ? 'Enregistrement…' : existing ? 'Enregistrer' : 'Créer le produit'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du produit *" className="sm:col-span-2">
            <input
              autoFocus
              className="input"
              placeholder="Ex. Riz parfumé 25 kg"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>

          <Field label="SKU / Référence interne" hint="Généré automatiquement si vide">
            <input
              className="input uppercase"
              placeholder="RIZ-25"
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
            />
          </Field>

          <Field label="Code-barres (EAN)">
            <input
              className="input"
              inputMode="numeric"
              placeholder="6191234500011"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
            />
          </Field>

          <Field label="Catégorie">
            <input
              className="input"
              list="categories-list"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            />
            <datalist id="categories-list">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <Field label="Unité de vente">
            <select className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
            <Sparkles size={13} /> Prix & marge
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`Prix d’achat (${currency})`}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0"
                value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
              />
            </Field>
            <Field label={`Prix de vente (${currency})`}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </Field>
            <div>
              <span className="label">Marge</span>
              <div
                className={cx(
                  'flex h-[42px] items-center rounded-xl border px-3 text-sm font-bold',
                  margin < 0
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : margin < 10
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-brand-200 bg-brand-50 text-brand-800',
                )}
              >
                {price > 0 ? `${margin.toFixed(0)} % · ${formatMoney(price - cost, currency)}` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={existing ? 'Stock actuel' : 'Stock initial'}
            hint={existing ? 'Modifiable via un mouvement de stock' : 'Crée une entrée « Stock initial »'}
          >
            <input
              className={cx('input', existing && 'bg-ink-50 text-ink-500')}
              inputMode="numeric"
              disabled={Boolean(existing)}
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
            />
          </Field>
          <Field label="Seuil d’alerte" hint="Alerte quand le stock atteint ce niveau">
            <input
              className="input"
              inputMode="numeric"
              value={form.reorderPoint}
              onChange={(e) => set('reorderPoint', e.target.value)}
            />
          </Field>
          <Field label="Quantité de réappro." hint="Proposition par défaut">
            <input
              className="input"
              inputMode="numeric"
              value={form.reorderQty}
              onChange={(e) => set('reorderQty', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fournisseur">
            <select className="input" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
              <option value="">— Aucun —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Emplacement / rayon">
            <input
              className="input"
              placeholder="Ex. Rayon A1"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
            />
          </Field>
        </div>

        {existing ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-sm">
            <span className="text-ink-600">
              Statut actuel : <strong className="font-semibold text-ink-900">{stockStatus(existing) === 'ok' ? 'En stock' : stockStatus(existing) === 'low' ? 'Stock bas' : 'Rupture'}</strong>
            </span>
            <button
              onClick={() => {
                close()
                openMovementForm({ productId: existing.id, type: 'adjust' })
              }}
              className="link inline-flex items-center gap-1"
            >
              <Plus size={14} /> Ajuster le stock
            </button>
          </div>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink-200 px-3 py-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          <span className="text-sm font-medium text-ink-700">Produit actif (visible dans les alertes et les rapports)</span>
        </label>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
        ) : null}
      </div>
    </Modal>
  )
}
