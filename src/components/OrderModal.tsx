import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Send, ShoppingCart } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { Modal, cx } from './ui'
import { formatMoney } from '../lib/format'
import { buildAlertLines, orderLinesBySupplier } from '../lib/analytics'
import { downloadFile, exportOrderCSV, toCSV } from '../lib/csv'

export default function OrderModal() {
  const open = useUI((s) => s.orderOpen)
  const close = useUI((s) => s.closeOrder)
  const initialSupplier = useUI((s) => s.orderSupplierId)
  const { products, suppliers, movements, settings, addMovement } = useData()
  const toast = useUI((s) => s.toast)

  const groups = useMemo(
    () => orderLinesBySupplier(buildAlertLines(products, suppliers, movements)),
    [products, suppliers, movements],
  )
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplier)
  const [received, setReceived] = useState(false)
  const [reference, setReference] = useState('')

  useEffect(() => {
    if (!open) return
    setSupplierId(initialSupplier)
    setReceived(false)
    setReference('')
  }, [open, initialSupplier])

  const activeGroup = groups.find((g) => (g.supplierId ?? 'none') === (supplierId ?? 'none')) ?? groups[0]
  const total = activeGroup?.total ?? 0
  const supplier = suppliers.find((s) => s.id === activeGroup?.supplierId)

  const reset = () => {
    setReceived(false)
    setReference('')
  }

  const handleReceive = () => {
    if (!activeGroup) return
    activeGroup.lines.forEach((line) => {
      addMovement({
        productId: line.product.id,
        type: 'in',
        quantity: line.suggestedQty,
        reason: 'Réception fournisseur',
        unitCost: line.product.cost,
        note: reference ? `Commande ${reference}` : 'Réception depuis le bon de commande',
      })
    })
    setReceived(true)
    toast(`${activeGroup.lines.length} produit(s) réceptionné(s) · ${activeGroup.supplierName}`)
  }

  const handleExport = () => {
    if (!activeGroup) return
    exportOrderCSV(
      activeGroup.lines.map((l) => ({ product: l.product, qty: l.suggestedQty })),
      activeGroup.supplierName,
    )
  }

  const handleCopy = async () => {
    if (!activeGroup) return
    const headers = ['Produit', 'SKU', 'Qté', 'Unité', 'PU', 'Total']
    const rows = activeGroup.lines.map((l) => [
      l.product.name,
      l.product.sku,
      l.suggestedQty,
      l.product.unit,
      l.product.cost,
      l.suggestedQty * l.product.cost,
    ])
    const text = toCSV(headers, rows)
    try {
      await navigator.clipboard.writeText(
        `Bon de commande — ${activeGroup.supplierName}\n\n${text}\nTotal : ${formatMoney(total, settings.currency)}`,
      )
      toast('Bon de commande copié')
    } catch {
      downloadFile('bon-de-commande.csv', text)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        close()
      }}
      size="lg"
      title="Générer un bon de commande"
      subtitle="Quantités calculées selon vos ventes et le délai fournisseur"
      icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <ShoppingCart size={18} />
        </span>
      }
      footer={
        activeGroup ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="mr-auto text-sm">
              <span className="text-ink-500">Total estimé </span>
              <strong className="font-extrabold text-ink-900">{formatMoney(total, settings.currency)}</strong>
            </div>
            <button onClick={handleExport} className="btn-ghost" title="Télécharger en CSV">
              <Download size={16} />
            </button>
            <button onClick={handleCopy} className="btn-ghost">
              <Send size={16} /> Copier
            </button>
            <button onClick={handleReceive} disabled={received} className="btn-brand">
              <Check size={16} /> {received ? 'Réceptionné' : 'Tout réceptionner'}
            </button>
          </div>
        ) : null
      }
    >
      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-500">Aucun produit sous le seuil : rien à commander. 🎉</p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {groups.map((g) => (
              <button
                key={g.supplierId ?? 'none'}
                onClick={() => {
                  setSupplierId(g.supplierId ?? 'none')
                  reset()
                }}
                className={cx(
                  'shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition',
                  (activeGroup?.supplierId ?? 'none') === (g.supplierId ?? 'none')
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                <span className="block max-w-[160px] truncate">{g.supplierName}</span>
                <span className={cx('block text-[10px] font-medium', (activeGroup?.supplierId ?? 'none') === (g.supplierId ?? 'none') ? 'text-ink-300' : 'text-ink-400')}>
                  {g.lines.length} réf. · {formatMoney(g.total, settings.currency, true)}
                </span>
              </button>
            ))}
          </div>

          {supplier ? (
            <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
              <span className="font-semibold text-ink-900">{supplier.name}</span> · {supplier.contact} · {supplier.phone} · délai{' '}
              {supplier.leadTimeDays} j
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-ink-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/70 text-[11px] uppercase tracking-wide text-ink-500">
                  <th className="px-3 py-2 text-left font-bold">Produit</th>
                  <th className="px-3 py-2 text-right font-bold">Stock</th>
                  <th className="px-3 py-2 text-right font-bold">À commander</th>
                  <th className="px-3 py-2 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeGroup?.lines.map((line) => (
                  <tr key={line.product.id} className="border-t border-ink-100">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ink-900">{line.product.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {line.product.sku}
                        {line.coverageDays !== null ? ` · couverture ${line.coverageDays} j` : ' · pas de ventes récentes'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-600">{line.product.stock}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-ink-900">
                      {line.suggestedQty} <span className="text-[10px] font-medium text-ink-400">{line.product.unit}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-700">{formatMoney(line.estimatedCost, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="label">Référence de commande (optionnel)</label>
            <input
              className="input"
              placeholder="Ex. BC-2026-014"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
              « Tout réceptionner » crée une entrée de stock pour chaque ligne, avec le motif « Réception fournisseur ». Le
              prix d’achat actuel est conservé.
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
