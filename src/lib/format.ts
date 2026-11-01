import type { Product } from './types'

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'XOF', label: 'Franc CFA (XOF)' },
  { code: 'XAF', label: 'Franc CFA (XAF)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'USD', label: 'Dollar US (USD)' },
  { code: 'MAD', label: 'Dirham (MAD)' },
  { code: 'NGN', label: 'Naira (NGN)' },
  { code: 'GHS', label: 'Cedi (GHS)' },
]

export const UNITS = ['pièce', 'sac', 'kg', 'carton', 'pack', 'bouteille', 'paquet', 'boîte', 'rouleau', 'litre', 'mètre']

export const CATEGORIES = [
  'Céréales & farines',
  'Boissons',
  'Alimentation',
  'Hygiène',
  'Entretien',
  'Électricité',
  'Papeterie',
  'Cosmétiques',
  'Divers',
]

export function formatMoney(value: number, currency = 'XOF', compact = false): string {
  const nf = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
    ...(compact ? { notation: 'compact' as const } : {}),
  })
  return nf.format(Number.isFinite(value) ? value : 0)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0)
}

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return `Aujourd'hui · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function stockStatus(p: Product): 'out' | 'low' | 'ok' {
  if (p.stock <= 0) return 'out'
  if (p.stock <= p.reorderPoint) return 'low'
  return 'ok'
}

export function marginPercent(p: Product): number {
  if (!p.price) return 0
  return ((p.price - p.cost) / p.price) * 100
}

export function stockValue(p: Product): number {
  return p.stock * p.cost
}

export function potentialRevenue(p: Product): number {
  return p.stock * p.price
}

export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

export function todayISO(): string {
  return new Date().toISOString()
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function uid(prefix = ''): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}${rand}`
}
