import { friendlyError } from '../../lib/friendly-error';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, LoaderCircle, PackageSearch, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { formatMoney, formatQuantity } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import { EmptyWorkspace, WorkspaceSection } from '../workspace/workspace-layout';
import { buildReportCsv, getReport, periodRange, type Report } from './reports-api';

const PERIODS = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
];

const dayLabel = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function errorMessage(error: unknown) {
  return friendlyError(error);
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'plain',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
  tone?: 'plain' | 'mint';
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${tone === 'mint' ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'}`}
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="size-4 text-mint-dark" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function downloadCsv(report: Report, tenantName: string) {
  const blob = new Blob([`\uFEFF${buildReportCsv(report)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rapport-${tenantName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${report.from}-${report.to}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DailyChart({ report, currency }: { report: Report; currency: string }) {
  const max = useMemo(
    () => Math.max(...report.daily.map((day) => day.revenue), 1),
    [report.daily],
  );
  const rows = report.daily;
  const compact = rows.length > 31;

  return (
    <div>
      <div
        className="flex h-40 items-end gap-1 overflow-x-auto rounded-xl bg-slate-50 p-3"
        role="img"
        aria-label={`Chiffre d’affaires par jour, du ${report.from} au ${report.to}`}
      >
        {rows.map((day) => {
          const height = Math.round((day.revenue / max) * 100);
          return (
            <div key={day.day} className="flex min-w-[6px] flex-1 flex-col items-center justify-end self-stretch">
              <div
                title={`${dayLabel.format(new Date(`${day.day}T00:00:00Z`))} · ${formatMoney(day.revenue, currency)} · ${day.sales} vente(s)`}
                className={`w-full rounded-t ${day.revenue > 0 ? 'bg-mint' : 'bg-slate-200'}`}
                style={{ height: `${Math.max(height, day.revenue > 0 ? 4 : 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{dayLabel.format(new Date(`${report.from}T00:00:00Z`))}</span>
        {!compact ? <span className="text-slate-400">Chaque barre = un jour</span> : null}
        <span>{dayLabel.format(new Date(`${report.to}T00:00:00Z`))}</span>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { tenant, accessToken } = useWorkspace();
  const [days, setDays] = useState(30);
  const range = periodRange(days, tenant.timezone);
  const reportQuery = useQuery({
    queryKey: ['reports', tenant.id, range.from, range.to],
    queryFn: () => getReport(accessToken, tenant.id, range.from, range.to),
  });

  const report = reportQuery.data;
  const currency = tenant.currency_code;

  return (
    <WorkspaceSection
      title="Rapports"
      description="Ce que la caisse a réellement produit : chiffre d’affaires, marge, produits qui rapportent et produits qui dorment. Les ventes annulées ne sont jamais comptées."
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!report}
          onClick={() => {
            if (report) downloadCsv(report, tenant.name);
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Exporter en CSV
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Période du rapport">
        {PERIODS.map((period) => (
          <Button
            key={period.days}
            type="button"
            size="sm"
            variant={days === period.days ? 'mint' : 'outline'}
            aria-pressed={days === period.days}
            onClick={() => setDays(period.days)}
          >
            {period.label}
          </Button>
        ))}
        <span className="ml-auto self-center text-xs text-slate-500">{range.from} → {range.to}</span>
      </div>

      {reportQuery.isLoading ? (
        <div className="grid min-h-64 place-items-center" role="status">
          <LoaderCircle className="size-7 animate-spin text-mint" aria-label="Calcul des rapports" />
        </div>
      ) : reportQuery.isError ? (
        <Alert tone="error">
          {errorMessage(reportQuery.error)}{' '}
          <Button type="button" variant="link" onClick={() => { void reportQuery.refetch(); }}>
            Réessayer
          </Button>
        </Alert>
      ) : !report ? null : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Encaissé aujourd’hui"
              value={formatMoney(report.today.revenue, currency)}
              hint={`${report.today.sales} vente(s) · marge ${formatMoney(report.today.margin, currency)}`}
              icon={Wallet}
              tone="mint"
            />
            <Kpi
              label={`Chiffre d’affaires · ${days} j`}
              value={formatMoney(report.totals.revenue, currency)}
              hint={`${report.totals.sales} vente(s) · ${formatQuantity(report.totals.items)} article(s)`}
              icon={TrendingUp}
            />
            <Kpi
              label="Marge"
              value={formatMoney(report.totals.margin, currency)}
              hint={`Panier moyen ${formatMoney(report.totals.average_basket, currency)}`}
              icon={BarChart3}
            />
            <Kpi
              label="Capital immobilisé"
              value={formatMoney(report.stock_value, currency)}
              hint={`${report.product_count} produit(s) actif(s) en stock`}
              icon={PackageSearch}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-bold text-ink">Chiffre d’affaires jour par jour</h2>
            <DailyChart report={report} currency={currency} />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-1 font-bold text-ink">Produits qui rapportent</h2>
              <p className="mb-3 text-xs text-slate-500">Classés par chiffre d’affaires sur la période.</p>
              {report.top_products.length === 0 ? (
                <EmptyWorkspace
                  icon={BarChart3}
                  title="Aucune vente sur cette période"
                  description="Choisissez une période plus large ou encaissez une première vente depuis l’onglet Ventes."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-2">Produit</th>
                        <th className="py-2 text-right">Qté</th>
                        <th className="py-2 text-right">CA</th>
                        <th className="py-2 text-right">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.top_products.map((product) => (
                        <tr key={product.variant_id} className="border-t border-slate-100">
                          <td className="py-2.5 pr-3">
                            <strong className="block font-semibold text-ink">{product.product_name}</strong>
                            <span className="font-mono text-xs text-slate-500">{product.sku}</span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{formatQuantity(product.quantity)}</td>
                          <td className="py-2.5 text-right tabular-nums">{formatMoney(product.revenue, currency)}</td>
                          <td className="py-2.5 text-right font-semibold tabular-nums text-mint-dark">
                            {formatMoney(product.margin, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-1 font-bold text-ink">Catégories</h2>
              <p className="mb-3 text-xs text-slate-500">Où se concentre votre chiffre d’affaires.</p>
              {report.top_categories.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune catégorie vendue sur la période.</p>
              ) : (
                <ul className="space-y-3">
                  {report.top_categories.map((category) => {
                    const share = report.totals.revenue > 0 ? category.revenue / report.totals.revenue : 0;
                    return (
                      <li key={category.category_id ?? category.category_name}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold text-ink">{category.category_name}</span>
                          <span className="tabular-nums text-slate-600">{formatMoney(category.revenue, currency)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-mint" style={{ width: `${Math.round(share * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatQuantity(category.quantity)} article(s) · {Math.round(share * 100)} % du CA
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-1 font-bold text-ink">Produits dormants</h2>
            <p className="mb-3 text-xs text-slate-500">
              Du stock, mais aucune vente depuis 30 jours (ou jamais vendu). C’est de l’argent qui dort.
            </p>
            {report.dormant.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun produit dormant : tout votre stock tourne.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.dormant.map((product) => (
                  <li key={product.variant_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{product.product_name}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {product.sku} · stock {formatQuantity(product.on_hand)} ·{' '}
                        {product.last_sold_at ? 'dernière vente il y a plus de 30 jours' : 'jamais vendu'}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-ink">
                      {formatMoney(product.stock_value, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </WorkspaceSection>
  );
}
