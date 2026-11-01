import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useUI } from '../lib/uiStore'
import type { Product } from '../lib/types'
import { stockStatus } from '../lib/format'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col animate-slide-up rounded-t-3xl bg-white shadow-pop sm:rounded-2xl',
          width,
        )}
      >
        <div className="flex items-start gap-3 border-b border-ink-100 px-5 py-4 sm:px-6">
          {icon ? <div className="mt-0.5">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
          </div>
          <button onClick={onClose} className="btn-subtle -mr-1.5 -mt-1 h-9 w-9 p-0" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="safe-bottom flex gap-2 border-t border-ink-100 px-5 py-4 sm:px-6">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

const TONE_STYLES = {
  success: { wrap: 'border-brand-200 bg-white', icon: 'bg-brand-100 text-brand-700', Icon: CheckCircle2 },
  error: { wrap: 'border-rose-200 bg-white', icon: 'bg-rose-100 text-rose-700', Icon: AlertTriangle },
  info: { wrap: 'border-ink-200 bg-white', icon: 'bg-ink-100 text-ink-700', Icon: Info },
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  if (!toasts.length) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:left-auto sm:right-6 sm:top-6 sm:items-end">
      {toasts.map((t) => {
        const tone = TONE_STYLES[t.tone]
        return (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-xl border px-3.5 py-3 shadow-pop',
              tone.wrap,
            )}
          >
            <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', tone.icon)}>
              <tone.Icon size={14} />
            </span>
            <p className="flex-1 text-sm font-medium text-ink-800">{t.message}</p>
            {t.actionLabel && t.onAction ? (
              <button
                onClick={() => {
                  t.onAction?.()
                  dismiss(t.id)
                }}
                className="shrink-0 rounded-lg border border-ink-200 px-2 py-1 text-[11px] font-bold text-ink-800 hover:bg-ink-50"
              >
                {t.actionLabel}
              </button>
            ) : null}
            <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700" aria-label="Fermer">
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

export function StatusBadge({ product, compact = false }: { product: Product; compact?: boolean }) {
  const status = stockStatus(product)
  if (status === 'out') {
    return <span className="chip bg-rose-100 text-rose-700">Rupture</span>
  }
  if (status === 'low') {
    return <span className="chip bg-amber-100 text-amber-800">Stock bas</span>
  }
  if (compact) return null
  return <span className="chip bg-brand-50 text-brand-700">En stock</span>
}

export function StockBar({ product }: { product: Product }) {
  const target = Math.max(product.reorderPoint * 2, 1)
  const pct = Math.min(100, Math.round((product.stock / target) * 100))
  const status = stockStatus(product)
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className={cx(
          'h-full rounded-full transition-all',
          status === 'out' ? 'bg-rose-500' : status === 'low' ? 'bg-amber-500' : 'bg-brand-500',
        )}
        style={{ width: `${status === 'out' ? 3 : Math.max(4, pct)}%` }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">{icon}</div>
      <p className="text-sm font-bold text-ink-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink-400">{hint}</span> : null}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: ReactNode }[]
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition',
            value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
