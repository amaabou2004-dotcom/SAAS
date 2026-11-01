import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, FileSpreadsheet, PackageX, TrendingUp, Wallet } from 'lucide-react'
import { useData } from '../lib/store'
import { useUI } from '../lib/uiStore'
import { cx } from '../components/ui'
import { formatMoney, formatNumber, marginPercent } from '../lib/format'
import { categoryBreakdown, dormantProducts, inventoryStats, outQuantityByProduct, topMoving } from '../lib/analytics'
import { exportMovementsCSV, exportProductsCSV } from '../lib/csv'

const COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']

export default function Reports() {
  const { products, suppliers, movements, settings } = useData()
  const openDetail = useUI((s) => s.openDetail)
  const toast = useUI((s) => s.toast)
  const [days, setDays] = useState(30)

  const stats = useMemo(() => inventoryStats(products), [products])
  const top = useMemo(() => topMoving(products, movements, days, 8), [products, movements, days])
  const dormant = useMemo(() => dormantProducts(products, movements, 45).slice(0, 6), [products, movements])
  const categories = useMemo(() => categoryBreakdown(products.filter((p) => p.stock > 0)).slice(0, 6), [products])

  const period = useMemo(() => {
    const since = Date.now() - days * 86_400_000
    const out = movements.filter((m) => m.type === 'out' && new Date(m.at).getTime() >= since)
    const quantities = outQuantityByProduct(movements, days)
    let revenue = 0
    let cost = 0
    let units = 0
    out.forEach((m) => {
      const p = products.find((x) => x.id === m.productId)
      units += m.quantity
      cost += m.quantity * (p?.cost ?? m.unitCost)
      revenue += m.quantity * (p?.price ?? m.unitCost)
    })
    const stockCost = products.reduce((s, p) => s + p.stock * p.cost, 0)
    const rotation = stockCost > 0 ? cost / stockCost : 0
    return { revenue, cost, margin: revenue - cost, units, movements: out.length, rotation, quantities }
  }, [movements, products, days])

  const chartData = useMemo(() => {
    const buckets = new Map<string, { label: string; sorties: number; entrees: number }>()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      buckets.set(d.toISOString().slice(0, 10), {
        label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        sorties: 0,
        entrees: 0,
      })
    }
    movements.forEach((m) => {
      const key = new Date(m.at).toISOString().slice(0, 10)
      const b = buckets.get(key)
      if (!b) return
      if (m.type === 'out') b.sorties += m.quantity
      if (m.type === 'in') b.entrees += m.quantity
    })
    return [...buckets.values()]
  }, [movements, days])

  const bestMargin = [...products].filter((p) => p.stock > 0).sort((a, b) => marginPercent(b) - marginPercent(a))[0]
  const cheapestRotation = [...products].filter((p) => p.stock > 0).sort((a, b) => b.stock * b.cost - a.stock * a.cost)[0]

  const exportAll = () => {
    exportProductsCSV(products, suppliers)
    toast('Produits exportés')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Rapports</h2>
          <p className="mt-0.5 text-sm text-ink-500">Valeur, rotation et performance de votre stock</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-xl border border-ink-200 bg-white p-0.5">
            {[
              [30, '30 jours'],
              [90, '90 jours'],
              [365, '12 mois'],
            ].map(([d, label]) => (
              <button
                key={d}
                onClick={() => setDays(d as number)}
                className={cx(
                  'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                  days === d ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={exportAll} className="btn-ghost">
            <Download size={16} /> <span className="hidden sm:inline">Export produits</span>
          </button>
          <button
            onClick={() => {
              exportMovementsCSV(movements, products)
              toast('Mouvements exportés')
            }}
            className="btn-ghost"
          >
            <FileSpreadsheet size={16} /> <span className="hidden sm:inline">Export mouvements</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Metric icon={<Wallet size={16} />} label="Valeur du stock" value={formatMoney(stats.costValue, settings.currency, true)} hint={`${stats.count} références actives`} />
        <Metric
          icon={<TrendingUp size={16} />}
          label="CA sorties (période)"
          value={formatMoney(period.revenue, settings.currency, true)}
          hint={`${formatNumber(period.units)} unités sorties`}
        />
        <Metric
          icon={<TrendingUp size={16} />}
          label="Marge brute"
          value={formatMoney(period.margin, settings.currency, true)}
          hint={period.revenue > 0 ? `${((period.margin / period.revenue) * 100).toFixed(0)} % du CA` : 'aucune sortie'}
          tone="ok"
        />
        <Metric
          icon={<PackageX size={16} />}
          label="Rotation du stock"
          value={`${period.rotation.toFixed(2)}×`}
          hint={`sur ${days} jours`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="section-title">Sorties quotidiennes</h3>
              <p className="text-xs text-ink-400">Volume de produits sortis par jour</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Sorties
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Entrées
              </span>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }} barGap={2}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#8792a8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(days / 10))}
                />
                <YAxis tick={{ fontSize: 10, fill: '#8792a8' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'rgba(236,238,242,.6)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(value) => [`${Number(value)} unités`, '']}
                />
                <Bar dataKey="sorties" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="entrees" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-4">
          <h3 className="section-title">Valeur par catégorie</h3>
          <p className="text-xs text-ink-400">Répartition du capital immobilisé</p>
          <div className="mt-2 h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categories} dataKey="value" nameKey="category" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                  {categories.map((entry, index) => (
                    <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={(value, name) => [formatMoney(Number(value), settings.currency), String(name ?? '')]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 space-y-1.5">
            {categories.map((c, i) => (
              <li key={c.category} className="flex items-center gap-2 text-[11px]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-ink-600">{c.category}</span>
                <span className="shrink-0 font-semibold text-ink-900">{formatMoney(c.value, settings.currency, true)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-ink-100 px-4 py-3.5">
            <h3 className="section-title">Top produits sur {days} jours</h3>
            <p className="text-xs text-ink-400">Classement par quantité sortie</p>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Produit</th>
                <th className="table-head text-right">Sorties</th>
                <th className="table-head text-right">CA estimé</th>
                <th className="table-head text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {top.map(({ product, qty, value }) => (
                <tr key={product.id} className="hover:bg-ink-50/60">
                  <td className="table-cell">
                    <button onClick={() => openDetail(product.id)} className="text-left">
                      <p className="font-semibold text-ink-900 hover:underline">{product.name}</p>
                      <p className="text-[11px] text-ink-400">
                        {product.sku} · stock {product.stock} {product.unit}
                      </p>
                    </button>
                  </td>
                  <td className="table-cell text-right font-semibold text-ink-900">
                    {qty} <span className="text-[10px] font-medium text-ink-400">{product.unit}</span>
                  </td>
                  <td className="table-cell text-right text-ink-700">{formatMoney(value, settings.currency)}</td>
                  <td className="table-cell text-right">
                    <span className="chip bg-brand-50 text-brand-700">{marginPercent(product).toFixed(0)} %</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {top.length === 0 ? <p className="px-4 py-8 text-center text-sm text-ink-400">Aucune sortie sur la période.</p> : null}
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <h3 className="section-title">Points d’attention</h3>
            <ul className="mt-3 space-y-3 text-[13px]">
              <li className="rounded-xl bg-ink-50 p-3">
                <p className="font-semibold text-ink-900">Capital immobilisé</p>
                <p className="mt-0.5 text-ink-600">
                  {cheapestRotation ? (
                    <>
                      {cheapestRotation.name} représente{' '}
                      <strong>{formatMoney(cheapestRotation.stock * cheapestRotation.cost, settings.currency)}</strong> de stock.
                    </>
                  ) : (
                    'Aucun stock en réserve.'
                  )}
                </p>
              </li>
              <li className="rounded-xl bg-ink-50 p-3">
                <p className="font-semibold text-ink-900">Meilleure marge</p>
                <p className="mt-0.5 text-ink-600">
                  {bestMargin ? (
                    <>
                      {bestMargin.name} — <strong>{marginPercent(bestMargin).toFixed(0)} %</strong> de marge.
                    </>
                  ) : (
                    'Renseignez vos prix d’achat et de vente.'
                  )}
                </p>
              </li>
              <li className="rounded-xl bg-ink-50 p-3">
                <p className="font-semibold text-ink-900">Produits dormants</p>
                <p className="mt-0.5 text-ink-600">
                  {dormant.length} produit(s) sans sortie depuis 45 jours ·{' '}
                  {formatMoney(dormant.reduce((s, p) => s + p.stock * p.cost, 0), settings.currency, true)} immobilisés.
                </p>
              </li>
            </ul>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-ink-100 px-4 py-3">
              <h3 className="section-title text-sm">Stock dormant</h3>
            </div>
            <ul className="divide-y divide-ink-100">
              {dormant.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-ink-400">Tous vos produits tournent. 👏</li>
              ) : (
                dormant.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                    <button onClick={() => openDetail(p.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[13px] font-semibold text-ink-800">{p.name}</p>
                      <p className="text-[10px] text-ink-400">
                        {p.stock} {p.unit} · {formatMoney(p.stock * p.cost, settings.currency, true)}
                      </p>
                    </button>
                    <span className="chip bg-amber-50 text-amber-700">{p.stock > 0 ? 'dormant' : 'vide'}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone = 'ink',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone?: 'ink' | 'ok'
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <p className="stat-label">{label}</p>
        <span className={cx('flex h-7 w-7 items-center justify-center rounded-lg', tone === 'ok' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600')}>
          {icon}
        </span>
      </div>
      <p className="mt-1.5 text-xl font-extrabold text-ink-900">{value}</p>
      <p className="text-[10px] font-medium text-ink-400">{hint}</p>
    </div>
  )
}
