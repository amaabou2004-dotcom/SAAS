import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CornerDownLeft, PackageSearch, Search, X } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { useScanner } from '../lib/scannerStore'
import { cx } from './ui'
import { formatMoney, stockStatus } from '../lib/format'

export default function SearchPalette() {
  const open = useScanner((s) => s.paletteOpen)
  const close = useScanner((s) => s.closePalette)
  const { products, settings } = useData()
  const openDetail = useUI((s) => s.openDetail)
  const openMovementForm = useUI((s) => s.openMovementForm)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      window.setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.filter((p) => p.active && stockStatus(p) !== 'ok').slice(0, 6)
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [products, query])

  useEffect(() => setActive(0), [query])

  if (!open) return null

  const exact = products.find((p) => p.barcode && p.barcode === query.trim())

  const choose = (index: number) => {
    const p = results[index]
    if (!p) return
    close()
    setTimeout(() => openDetail(p.id), 50)
  }

  const quickMove = (type: 'in' | 'out') => {
    const p = exact ?? results[active]
    if (!p) return
    close()
    setTimeout(() => openMovementForm({ productId: p.id, type }), 50)
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[10vh] sm:pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]" onClick={close} />
      <div className="relative w-full max-w-xl animate-slide-up overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-4">
          <Search size={18} className="text-ink-400" />
          <input
            ref={inputRef}
            className="h-14 flex-1 bg-transparent text-[15px] font-medium text-ink-900 outline-none placeholder-ink-400"
            placeholder="Nom, SKU ou code-barres…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(results.length - 1, a + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                if (exact) quickMove('out')
                else choose(active)
              }
              if (e.key === 'Escape') close()
            }}
          />
          <button onClick={close} className="btn-subtle h-8 w-8 p-0" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {exact ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-brand-50/60 px-4 py-2.5">
            <span className="text-xs font-semibold text-brand-800">Code scanné : {exact.name}</span>
            <span className="ml-auto flex gap-1.5">
              <button onClick={() => quickMove('out')} className="btn-primary px-2.5 py-1.5 text-xs">
                <ArrowUpFromLine size={13} /> Sortie
              </button>
              <button onClick={() => quickMove('in')} className="btn-ghost px-2.5 py-1.5 text-xs">
                <ArrowDownToLine size={13} /> Entrée
              </button>
            </span>
          </div>
        ) : null}

        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {!query ? (
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">À traiter en priorité</p>
          ) : null}
          {results.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <PackageSearch size={22} className="text-ink-300" />
              <p className="mt-2 text-sm font-semibold text-ink-700">Aucun produit trouvé</p>
              <p className="mt-0.5 text-xs text-ink-400">Vérifiez le code ou créez une nouvelle fiche produit.</p>
            </div>
          ) : (
            results.map((p, i) => (
              <button
                key={p.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                  active === i ? 'bg-ink-100' : 'hover:bg-ink-50',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-extrabold text-ink-500 shadow-sm">
                  {p.sku.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900">{p.name}</span>
                  <span className="block truncate text-[11px] text-ink-400">
                    {p.sku} · {formatMoney(p.price, settings.currency)} · {p.location || 'sans emplacement'}
                  </span>
                </span>
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
                {active === i ? <CornerDownLeft size={13} className="shrink-0 text-ink-400" /> : null}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-ink-100 bg-ink-50/60 px-4 py-2 text-[11px] text-ink-500">
          <span className="flex items-center gap-1">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> naviguer
          </span>
          <span className="flex items-center gap-1">
            <span className="kbd">↵</span> ouvrir
          </span>
          <span className="ml-auto hidden sm:inline">Scannez un code-barres directement dans ce champ</span>
        </div>
      </div>
    </div>
  )
}
