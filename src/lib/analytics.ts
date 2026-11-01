import type { Movement, Product, Supplier } from './types'
import { stockStatus } from './format'

export type AlertLine = {
  product: Product
  supplier: Supplier | null
  supplierName: string
  avgDaily: number | null
  coverageDays: number | null
  suggestedQty: number
  estimatedCost: number
  status: 'out' | 'low'
}

export function inventoryStats(products: Product[]) {
  const active = products.filter((p) => p.active)
  const costValue = active.reduce((sum, p) => sum + p.stock * p.cost, 0)
  const retailValue = active.reduce((sum, p) => sum + p.stock * p.price, 0)
  return {
    count: active.length,
    units: active.reduce((sum, p) => sum + p.stock, 0),
    costValue,
    retailValue,
    margin: retailValue - costValue,
    out: active.filter((p) => stockStatus(p) === 'out').length,
    low: active.filter((p) => stockStatus(p) === 'low').length,
    alerts: active.filter((p) => stockStatus(p) !== 'ok').length,
  }
}

export function outQuantityByProduct(movements: Movement[], days: number): Map<string, number> {
  const since = Date.now() - days * 86_400_000
  const map = new Map<string, number>()
  movements.forEach((m) => {
    if (m.type !== 'out') return
    if (new Date(m.at).getTime() < since) return
    map.set(m.productId, (map.get(m.productId) ?? 0) + m.quantity)
  })
  return map
}

export function avgDailyOut(movements: Movement[], productId: string, days = 30): number {
  const total = outQuantityByProduct(movements.filter((m) => m.productId === productId), days).get(productId) ?? 0
  return total / days
}

export function buildAlertLines(
  products: Product[],
  suppliers: Supplier[],
  movements: Movement[],
): AlertLine[] {
  return products
    .filter((p) => p.active && stockStatus(p) !== 'ok')
    .map((product) => {
      const supplier = suppliers.find((s) => s.id === product.supplierId) ?? null
      const daily = avgDailyOut(movements, product.id)
      const avgDaily = daily > 0 ? daily : null
      const leadTime = supplier?.leadTimeDays ?? 7
      const target = avgDaily ? Math.ceil(avgDaily * leadTime * 1.3) : 0
      const suggestedQty = Math.max(1, Math.max(product.reorderQty, target))
      const coverageDays = avgDaily ? Math.round(product.stock / avgDaily) : null
      return {
        product,
        supplier,
        supplierName: supplier?.name ?? 'Sans fournisseur',
        avgDaily,
        coverageDays,
        suggestedQty,
        estimatedCost: suggestedQty * product.cost,
        status: stockStatus(product) === 'out' ? ('out' as const) : ('low' as const),
      }
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'out' ? -1 : 1
      return b.estimatedCost - a.estimatedCost
    })
}

export function dailyFlow(movements: Movement[], days = 14) {
  const buckets: { key: string; label: string; inbound: number; outbound: number }[] = []
  const map = new Map<string, { label: string; inbound: number; outbound: number }>()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    const entry = { label, inbound: 0, outbound: 0 }
    map.set(key, entry)
    buckets.push({ key, label, inbound: 0, outbound: 0 })
  }

  movements.forEach((m) => {
    const key = new Date(m.at).toISOString().slice(0, 10)
    const entry = map.get(key)
    if (!entry) return
    if (m.type === 'in') entry.inbound += m.quantity
    if (m.type === 'out') entry.outbound += m.quantity
  })

  return buckets.map((b) => ({ ...b, ...map.get(b.key)! }))
}

export function categoryBreakdown(products: Product[]) {
  const map = new Map<string, { category: string; value: number; count: number }>()
  products.forEach((p) => {
    const current = map.get(p.category) ?? { category: p.category, value: 0, count: 0 }
    current.value += p.stock * p.cost
    current.count += 1
    map.set(p.category, current)
  })
  return [...map.values()].sort((a, b) => b.value - a.value)
}

export function topMoving(products: Product[], movements: Movement[], days = 30, limit = 8) {
  const quantities = outQuantityByProduct(movements, days)
  return products
    .map((product) => {
      const qty = quantities.get(product.id) ?? 0
      return { product, qty, value: qty * product.price }
    })
    .filter((x) => x.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
}

export function dormantProducts(products: Product[], movements: Movement[], days = 45): Product[] {
  const since = Date.now() - days * 86_400_000
  const activeIds = new Set(
    movements.filter((m) => m.type === 'out' && new Date(m.at).getTime() >= since).map((m) => m.productId),
  )
  return products.filter((p) => p.stock > 0 && !activeIds.has(p.id)).sort((a, b) => b.stock * b.cost - a.stock * a.cost)
}

export function movementTotals(movements: Movement[], days = 30) {
  const since = Date.now() - days * 86_400_000
  let inbound = 0
  let outbound = 0
  let count = 0
  movements.forEach((m) => {
    if (new Date(m.at).getTime() < since) return
    count += 1
    if (m.type === 'in') inbound += m.quantity
    if (m.type === 'out') outbound += m.quantity
  })
  return { inbound, outbound, count }
}

export function movementsToday(movements: Movement[]): Movement[] {
  const today = new Date().toDateString()
  return movements.filter((m) => new Date(m.at).toDateString() === today)
}

export function orderLinesBySupplier(lines: AlertLine[]) {
  const groups = new Map<string, { supplierId: string | null; supplierName: string; lines: AlertLine[]; total: number }>()
  lines.forEach((line) => {
    const key = line.supplier?.id ?? 'none'
    const group = groups.get(key) ?? {
      supplierId: line.supplier?.id ?? null,
      supplierName: line.supplierName,
      lines: [],
      total: 0,
    }
    group.lines.push(line)
    group.total += line.estimatedCost
    groups.set(key, group)
  })
  return [...groups.values()].sort((a, b) => b.total - a.total)
}
