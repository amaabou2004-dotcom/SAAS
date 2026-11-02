import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Minus,
  PackageSearch,
  SlidersHorizontal,
  Plus,
  Search,
} from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { Modal, Field, Segmented, cx } from './ui'
import { formatMoney, stockStatus } from '../lib/format'
import type { MovementType, Product } from '../lib/types'

const REASONS: Record<MovementType, string[]> = {
  in: ['Réception fournisseur', 'Retour client', 'Transfert entrant', 'Stock initial', 'Correction inventaire'],
  out: ['Vente comptoir', 'Vente boutique', 'Livraison client', 'Casse / perte', 'Don', 'Transfert sortant'],
  adjust: ['Inventaire physique', 'Correction d’erreur', 'Casse / perte', 'Vol constaté'],
}

export default function MovementForm() {
  const { open, productId, type: initialType } = useUI((s) => s.movementForm)
  const close = useUI((s) => s.closeMovementForm)
  const { products, settings, addMovement, undoMovement } = useData()
  const toast = useUI((s) => s.toast)

  const [type, setType] = useState<MovementType>('out')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [qty, setQty] = useState('1')
  const [reason, setReason] = useState(REASONS.out[0])
  const [note, setNote] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId])

  useEffect(() => {
    if (!open) return
    const t = initialType ?? 'out'
    setType(t)
    setSelectedId(productId ?? null)
    setQuery('')
    setQty(t === 'adjust' ? String(products.find((p) => p.id === productId)?.stock ?? 0) : '1')
    setReason(REASONS[t][0])
    setNote('')
    setError('')
    const p = products.find((x) => x.id === productId)
    setUnitCost(p ? String(p.cost) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, initialType])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = products.filter((p) => p.active)
    if (!q) return base.slice(0, 5)
    return base
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [products, query])

  const selectProduct = (p: Product) => {
    setSelectedId(p.id)
    setQuery('')
    setUnitCost(String(p.cost))
    if (type === 'adjust') setQty(String(p.stock))
    setError('')
  }

  const changeType = (t: MovementType) => {
    setType(t)
    setReason(REASONS[t][0])
    setQty(t === 'adjust' && selected ? String(selected.stock) : '1')
    setError('')
  }

  const numericQty = Number(qty.replace(',', '.')) || 0
  const after = !selected
    ? 0
    : type === 'in'
      ? selected.stock + numericQty
      : type === 'out'
        ? selected.stock - numericQty
        : numericQty
  const diff = selected ? after - selected.stock : 0
  const insufficient = type === 'out' && selected ? numericQty > selected.stock : false

  const quickQty = type === 'out' ? [1, 5, 10, 25] : type === 'in' ? [selected?.reorderQty ?? 10, 10, 25, 50] : [0, 5, 10, 20]

  const submit = async () => {
    if (!selected) {
      setError('Choisissez d’abord un produit.')
      return
    }
    if (!Number.isFinite(numericQty) || (type !== 'adjust' && numericQty <= 0)) {
      setError('Saisissez une quantité valide supérieure à zéro.')
      return
    }
    if (insufficient) {
      setError(`Stock insuffisant : ${selected.stock} ${selected.unit} disponible(s).`)
      return
    }
    setSubmitting(true)
    const res = await addMovement({
      productId: selected.id,
      type,
      quantity: numericQty,
      reason,
      note,
      unitCost: type === 'in' ? Number(unitCost.replace(',', '.')) || undefined : undefined,
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error ?? 'Impossible d’enregistrer le mouvement.')
      return
    }
    const verb = type === 'in' ? 'Entrée' : type === 'out' ? 'Sortie' : 'Ajustement'
    const movementId = res.operationId
    toast(`${verb} de ${numericQty} ${selected.unit} · ${selected.name} — stock : ${after}`, 'success', {
      label: 'Annuler',
      onClick: () => {
        if (!movementId) return
        void undoMovement(movementId).then((undo) => {
          toast(undo.ok ? 'Mouvement annulé, stock rétabli' : (undo.error ?? 'Annulation impossible'), undo.ok ? 'info' : 'error')
        })
      },
    })
    close()
  }

  const typeLabel = type === 'in' ? 'Entrée' : type === 'out' ? 'Sortie' : 'Inventaire'

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title="Mouvement de stock"
      subtitle="Entrée, sortie ou inventaire — tracé en une action"
      icon={
        <span
          className={cx(
            'flex h-9 w-9 items-center justify-center rounded-xl',
            type === 'in'
              ? 'bg-brand-50 text-brand-700'
              : type === 'out'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-ink-100 text-ink-700',
          )}
        >
          {type === 'in' ? <ArrowDownToLine size={18} /> : type === 'out' ? <ArrowUpFromLine size={18} /> : <SlidersHorizontal size={18} />}
        </span>
      }
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1 text-xs text-ink-500">
            {selected ? (
              <span>
                Stock après opération :{' '}
                <strong className={cx('text-sm', after < 0 ? 'text-rose-600' : 'text-ink-900')}>{Math.max(0, after)}</strong>{' '}
                {selected.unit}
                {diff !== 0 && type === 'adjust' ? (
                  <span className={cx('ml-1 font-semibold', diff > 0 ? 'text-brand-700' : 'text-rose-600')}>
                    ({diff > 0 ? '+' : ''}
                    {diff})
                  </span>
                ) : null}
              </span>
            ) : (
              'Aucun produit sélectionné'
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={close} className="btn-ghost flex-1 sm:flex-none">
              Annuler
            </button>
            <button onClick={submit} className="btn-brand flex-1 sm:flex-none" disabled={!selected || insufficient || submitting}>
              <Check size={16} /> {submitting ? 'Enregistrement…' : `Valider ${typeLabel.toLowerCase()}`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={type}
          onChange={changeType}
          options={[
            { value: 'in', label: 'Entrée', icon: <ArrowDownToLine size={15} /> },
            { value: 'out', label: 'Sortie', icon: <ArrowUpFromLine size={15} /> },
            { value: 'adjust', label: 'Inventaire', icon: <SlidersHorizontal size={15} /> },
          ]}
        />

        {selected ? (
          <div className="rounded-2xl border border-ink-200 bg-ink-50/50 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-ink-500 shadow-sm">
                <PackageSearch size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">{selected.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {selected.sku} · {selected.category} · {selected.location || 'sans emplacement'}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedId(null)
                  setQuery('')
                }}
                className="shrink-0 text-xs font-semibold text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
              >
                Changer
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">En stock</p>
                <p className="text-lg font-extrabold leading-tight text-ink-900">
                  {selected.stock} <span className="text-[11px] font-semibold text-ink-400">{selected.unit}</span>
                </p>
              </div>
              <div className="flex-1 rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Seuil d’alerte</p>
                <p className="text-lg font-extrabold leading-tight text-ink-900">
                  {selected.reorderPoint} <span className="text-[11px] font-semibold text-ink-400">{selected.unit}</span>
                </p>
              </div>
              <div className="flex-1 rounded-lg bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Statut</p>
                <p
                  className={cx(
                    'text-sm font-bold leading-tight',
                    stockStatus(selected) === 'out' ? 'text-rose-600' : stockStatus(selected) === 'low' ? 'text-amber-600' : 'text-brand-700',
                  )}
                >
                  {stockStatus(selected) === 'out' ? 'Rupture' : stockStatus(selected) === 'low' ? 'Stock bas' : 'En stock'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                autoFocus
                className="input pl-9"
                placeholder="Rechercher un produit, scanner un code-barres…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) {
                    e.preventDefault()
                    selectProduct(results[0])
                  }
                }}
              />
            </div>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-ink-200">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-400">Aucun produit trouvé.</p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="flex w-full items-center gap-3 border-b border-ink-100 px-3 py-2.5 text-left last:border-0 hover:bg-ink-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{p.name}</p>
                      <p className="truncate text-[11px] text-ink-400">
                        {p.sku} · {formatMoney(p.price, settings.currency)}
                      </p>
                    </div>
                    <span
                      className={cx(
                        'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold',
                        stockStatus(p) === 'out'
                          ? 'bg-rose-50 text-rose-700'
                          : stockStatus(p) === 'low'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-brand-50 text-brand-700',
                      )}
                    >
                      {p.stock} {p.unit}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div>
          <span className="label">{type === 'adjust' ? 'Stock compté physiquement' : 'Quantité'}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty(String(Math.max(0, numericQty - 1)))}
              className="btn-ghost h-12 w-12 shrink-0 p-0"
              aria-label="Diminuer"
            >
              <Minus size={18} />
            </button>
            <div className="relative flex-1">
              <input
                className="input h-12 pr-16 text-center text-xl font-extrabold"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-400">
                {selected?.unit ?? 'unité'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setQty(String(numericQty + 1))}
              className="btn-ghost h-12 w-12 shrink-0 p-0"
              aria-label="Augmenter"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickQty.map((q, i) => (
              <button
                key={`${q}-${i}`}
                onClick={() => setQty(String(q))}
                className={cx(
                  'rounded-lg border px-2.5 py-1 text-xs font-semibold transition',
                  Number(qty) === q ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {q}
              </button>
            ))}
          </div>
          {insufficient ? (
            <p className="mt-2 text-xs font-semibold text-rose-600">
              Quantité supérieure au stock disponible ({selected?.stock} {selected?.unit}).
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Motif">
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS[type].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="Autre">Autre…</option>
            </select>
          </Field>
          {type === 'in' ? (
            <Field label={`Prix d’achat unitaire (${settings.currency})`} hint="Met à jour le coût du produit">
              <input
                className="input"
                inputMode="decimal"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Note (optionnel)">
              <input
                className="input"
                placeholder="Client, véhicule, commentaire…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          )}
        </div>

        {type === 'in' ? (
          <Field label="Note (optionnel)">
            <input className="input" placeholder="N° de bon de livraison…" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        ) : null}

        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
      </div>
    </Modal>
  )
}
