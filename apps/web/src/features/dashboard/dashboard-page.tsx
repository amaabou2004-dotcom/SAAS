import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, BarChart3, PackagePlus, Receipt, ShoppingBag, Store, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { periodRange, getReport } from '../reports/reports-api';
import { listStorefrontOrders } from '../storefront/storefront-api';
import { listStock } from '../workspace/workspace-api';
import { formatMoney, formatQuantity } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import { WorkspaceSection } from '../workspace/workspace-layout';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={cardClass}>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <Icon className="size-4 text-mint-dark" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function DashboardPage() {
  const { tenant, accessToken } = useWorkspace();
  // Période d'un jour = aujourd'hui, dans le fuseau de l'entreprise.
  const today = periodRange(1, tenant.timezone);

  const reportQuery = useQuery({
    queryKey: ['reports', tenant.id, today.from, today.to],
    queryFn: () => getReport(accessToken, tenant.id, today.from, today.to),
  });
  const stockQuery = useQuery({
    queryKey: ['inventory', 'stock', tenant.id],
    queryFn: () => listStock(accessToken, tenant.id),
  });
  const ordersQuery = useQuery({
    queryKey: ['storefront', 'orders', tenant.id],
    queryFn: () => listStorefrontOrders(accessToken, tenant.id),
  });

  const currency = tenant.currency_code;
  const report = reportQuery.data;
  const stock = stockQuery.data ?? [];
  const outOfStock = stock.filter((row) => row.available <= 0);
  const pendingOrders = (ordersQuery.data ?? []).filter((order) => order.status === 'pending').length;
  const dayLabel = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeZone: tenant.timezone,
  }).format(new Date());

  return (
    <WorkspaceSection
      title={`Bonjour, ${tenant.name}`}
      description={`${dayLabel.charAt(0).toUpperCase()}${dayLabel.slice(1)} — voici l’essentiel de votre commerce aujourd’hui.`}
      action={
        <Button asChild variant="mint">
          <Link to="/workspace/ventes/nouvelle">
            <Receipt className="size-4" aria-hidden="true" />Nouvelle vente
          </Link>
        </Button>
      }
    >
      {reportQuery.isError ? (
        <Alert tone="info" className="mb-4">
          Vos chiffres du jour nécessitent le droit de lire les ventes. Les autres informations restent disponibles.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Receipt}
          label="Ventes aujourd’hui"
          value={report ? formatQuantity(report.today.sales) : '—'}
          hint={report ? `${formatQuantity(report.totals.items)} article(s) vendu(s)` : 'Chargement…'}
        />
        <Stat
          icon={Wallet}
          label="Chiffre d’affaires"
          value={report ? formatMoney(report.today.revenue, currency) : '—'}
          hint={report ? `Panier moyen ${formatMoney(report.totals.average_basket, currency)}` : 'Chargement…'}
        />
        <Stat
          icon={BarChart3}
          label="Marge du jour"
          value={report ? formatMoney(report.today.margin, currency) : '—'}
          hint="Ventes encaissées uniquement"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className={cardClass}>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <ShoppingBag className="size-4 text-mint-dark" aria-hidden="true" />
            Commandes en ligne
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">
            {ordersQuery.isError ? '—' : formatQuantity(pendingOrders)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ordersQuery.isError
              ? 'Droit de lire les ventes requis'
              : pendingOrders > 0
                ? 'commande(s) à confirmer'
                : 'aucune commande en attente'}
          </p>
          <Link
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-mint-dark hover:underline"
            to="/workspace/commandes"
          >
            Voir les commandes<ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className={cardClass}>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
            Ruptures de stock
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">
            {stockQuery.isLoading ? '—' : formatQuantity(new Set(outOfStock.map((row) => row.variant_id)).size)}
          </p>
          <p className="mt-1 text-xs text-slate-500">produit(s) épuisé(s) sur un emplacement</p>
          <Link
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-mint-dark hover:underline"
            to="/workspace/stock"
          >
            Voir le stock<ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className={cardClass}>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Store className="size-4 text-mint-dark" aria-hidden="true" />
            Valeur du stock
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-ink">
            {report ? formatMoney(report.stock_value, currency) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {report ? `${formatQuantity(report.product_count)} produit(s) au catalogue` : 'Chargement…'}
          </p>
        </div>
      </div>

      {outOfStock.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-bold text-ink">À réapprovisionner</h2>
          <ul className={`${cardClass} mt-2 divide-y divide-slate-100 p-0`}>
            {outOfStock.slice(0, 5).map((row) => (
              <li key={`${row.variant_id}-${row.location_id}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{row.product_name}</span>
                  <span className="text-xs text-slate-500">{row.sku} · {row.location_name}</span>
                </span>
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                  épuisé
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-bold text-ink">Actions rapides</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/workspace/ventes/nouvelle">
              <Receipt className="size-4" aria-hidden="true" />Encaisser une vente
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/workspace/produits">
              <PackagePlus className="size-4" aria-hidden="true" />Ajouter un produit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/workspace/mouvements">
              <ArrowRight className="size-4" aria-hidden="true" />Réception / transfert
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/workspace/rapports">
              <BarChart3 className="size-4" aria-hidden="true" />Voir les rapports
            </Link>
          </Button>
        </div>
      </section>
    </WorkspaceSection>
  );
}
