import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, BarChart3, PackagePlus, Receipt, ShoppingBag, Store, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { periodRange, getReport } from '../reports/reports-api';
import { getStorefrontSettings, listStorefrontOrders } from '../storefront/storefront-api';
import { listProducts, listStock } from '../workspace/workspace-api';
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

interface FirstStep {
  done: boolean;
  title: string;
  text: string;
  to: string;
  cta: string;
}

/**
 * Le parcours de démarrage, en trois gestes. Il disparaît de lui-même une fois
 * les trois faits : l'écran d'accueil ne garde alors que les chiffres.
 */
function FirstSteps({ steps }: { steps: FirstStep[] }) {
  const remaining = steps.filter((step) => !step.done);
  if (remaining.length === 0) return null;
  const current = remaining[0]!;

  return (
    <section className="mb-5 rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <p className="text-xs font-bold tracking-wide text-mint-dark uppercase">
        {`Vos premiers pas · ${steps.length - remaining.length}/${steps.length} fait`}
      </p>
      <h2 className="mt-1 text-lg font-bold text-ink">{current.title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">{current.text}</p>
      <Button asChild variant="mint" className="mt-3">
        <Link to={current.to}>
          {current.cta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {steps.map((step) => (
          <li key={step.title} className="flex items-center gap-1.5">
            <span
              className={`grid size-4 place-items-center rounded-full text-[10px] font-bold ${step.done ? 'bg-mint text-white' : 'border border-slate-300 bg-white text-transparent'}`}
              aria-hidden="true"
            >
              ✓
            </span>
            <span className={step.done ? 'line-through decoration-slate-400' : 'font-semibold text-ink'}>{step.title}</span>
          </li>
        ))}
      </ol>
    </section>
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
  const productsQuery = useQuery({
    queryKey: ['catalog', 'products', tenant.id],
    queryFn: () => listProducts(accessToken, tenant.id),
  });
  const shopSettingsQuery = useQuery({
    queryKey: ['storefront', 'settings', tenant.id],
    queryFn: () => getStorefrontSettings(accessToken, tenant.id),
    retry: false,
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
          <Link to="/workspace/ventes/caisse">
            <Receipt className="size-4" aria-hidden="true" />Encaisser une vente
          </Link>
        </Button>
      }
    >
      <FirstSteps
        steps={[
          {
            done: (productsQuery.data?.length ?? 0) > 0,
            title: 'Ajoutez un produit',
            text: 'Un nom et un prix de vente suffisent. La photo et la quantité sont facultatives.',
            to: '/workspace/produits',
            cta: 'Ajouter un produit',
          },
          {
            done: stock.some((row) => row.available > 0),
            title: 'Mettez du stock',
            text: 'Sur la fiche du produit, indiquez combien vous en avez. Tant qu’il est à zéro, la boutique l’affiche en rupture.',
            to: '/workspace/produits',
            cta: 'Mettre du stock',
          },
          ...(shopSettingsQuery.data
            ? [{
                done: shopSettingsQuery.data.published,
                title: 'Ouvrez votre boutique en ligne',
                text: 'Vos produits y apparaissent automatiquement. Il ne reste qu’à activer la boutique et partager le lien sur WhatsApp.',
                to: '/workspace/commandes',
                cta: 'Ouvrir la boutique',
              }]
            : []),
        ]}
      />

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
            <Link to="/workspace/ventes/caisse">
              <Receipt className="size-4" aria-hidden="true" />Caisse rapide
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
