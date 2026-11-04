import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, LoaderCircle, Plus, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { formatMoney } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import { EmptyWorkspace, WorkspaceSection } from '../workspace/workspace-layout';
import { SaleTicket } from './sale-ticket';
import { getSale, listSales, paymentMethodLabels, voidSale, type SaleSummary } from './sales-api';
import { salesErrorMessage } from './sales-error';
import { formatSaleDay, formatSaleTime, saleDayKey, sumBy } from './sales-format';

const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100';

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="size-4 text-mint-dark" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function VoidSaleForm({ saleId }: { saleId: string }) {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const keyRef = useRef<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ id, text, key }: { id: string; text: string; key: string }) =>
      voidSale(accessToken, tenant.id, id, text, key),
  });

  const submit = async () => {
    setError(null);
    if (reason.trim().length < 2) {
      setError('Indiquez le motif de l’annulation (2 caractères minimum).');
      return;
    }
    const key = keyRef.current ?? crypto.randomUUID();
    keyRef.current = key;
    try {
      await mutation.mutateAsync({ id: saleId, text: reason.trim(), key });
      keyRef.current = null;
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'movements', tenant.id] }),
      ]);
    } catch (caught) {
      setError(salesErrorMessage(caught));
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">Annuler cette vente</p>
      <p className="mt-1 text-xs leading-5 text-amber-900">
        Le stock revient à son emplacement, la vente reste visible et barrée. L’annulation exige aussi le droit de gérer le
        stock.
      </p>
      {error ? <Alert tone="error" className="mt-3">{error}</Alert> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`void-reason-${saleId}`} className="sr-only">
            Motif de l’annulation
          </Label>
          <input
            id={`void-reason-${saleId}`}
            className={inputClass}
            placeholder="Motif (erreur de saisie, retour client…)"
            value={reason}
            maxLength={400}
            onChange={(event) => {
              keyRef.current = null;
              setReason(event.target.value);
            }}
          />
        </div>
        <Button type="button" variant="outline" loading={mutation.isPending} onClick={() => { void submit(); }}>
          Confirmer l’annulation
        </Button>
      </div>
    </div>
  );
}

function SaleRow({ sale }: { sale: SaleSummary }) {
  const { tenant, accessToken } = useWorkspace();
  const [open, setOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: ['sales', tenant.id, sale.id],
    queryFn: () => getSale(accessToken, tenant.id, sale.id),
    enabled: open,
  });
  const voided = sale.status === 'voided';

  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-bold text-ink">{sale.number}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${voided ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
            >
              {voided ? 'Annulée' : 'Encaissée'}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {formatSaleDay(sale.created_at, tenant.timezone)} à {formatSaleTime(sale.created_at, tenant.timezone)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {sale.location_name} · {paymentMethodLabels[sale.payment_method]}
            {sale.payment_reference ? ` (${sale.payment_reference})` : ''} · {sale.item_count} ligne
            {sale.item_count > 1 ? 's' : ''}
            {sale.customer_name ? ` · ${sale.customer_name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-lg font-bold tabular-nums ${voided ? 'text-slate-400 line-through' : 'text-ink'}`}>
              {formatMoney(sale.total, tenant.currency_code)}
            </p>
            {!voided ? (
              <p className="text-xs text-slate-500">Marge {formatMoney(sale.margin, tenant.currency_code)}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            <span className="sr-only sm:not-sr-only">Détails</span>
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-100 p-4 sm:p-5">
          {detailQuery.isLoading ? (
            <div className="grid min-h-32 place-items-center" role="status">
              <LoaderCircle className="size-6 animate-spin text-mint" aria-label="Chargement du ticket" />
            </div>
          ) : detailQuery.isError ? (
            <Alert tone="error">{salesErrorMessage(detailQuery.error)}</Alert>
          ) : detailQuery.data ? (
            <div className="space-y-4">
              <SaleTicket sale={detailQuery.data} currency={tenant.currency_code} timezone={tenant.timezone} />
              {!voided ? <VoidSaleForm saleId={sale.id} /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function SalesPage() {
  const { tenant, accessToken } = useWorkspace();
  const salesQuery = useQuery({
    queryKey: ['sales', tenant.id],
    queryFn: () => listSales(accessToken, tenant.id),
  });

  const sales = salesQuery.data ?? [];
  const todayKey = saleDayKey(new Date().toISOString(), tenant.timezone);
  const todaySales = sales.filter(
    (sale) => sale.status === 'completed' && saleDayKey(sale.created_at, tenant.timezone) === todayKey,
  );
  const todayRevenue = sumBy(todaySales, (sale) => sale.total);
  const todayMargin = sumBy(todaySales, (sale) => sale.margin);

  return (
    <WorkspaceSection
      title="Ventes"
      description="Chaque vente retire le stock de l’emplacement choisi, calcule la marge et peut être annulée sans jamais effacer l’historique."
      action={
        <Button asChild variant="mint" size="lg">
          <Link to="/workspace/ventes/nouvelle">
            <Plus className="size-4" aria-hidden="true" />
            Nouvelle vente
          </Link>
        </Button>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard icon={ShoppingCart} label="Ventes du jour" value={String(todaySales.length)} hint="Ventes encaissées, hors annulées" />
        <StatCard
          icon={Wallet}
          label="Encaissé aujourd’hui"
          value={formatMoney(todayRevenue, tenant.currency_code)}
          hint={`Fuseau ${tenant.timezone}`}
        />
        <StatCard icon={TrendingUp} label="Marge du jour" value={formatMoney(todayMargin, tenant.currency_code)} />
      </div>

      {salesQuery.isLoading ? (
        <div className="grid min-h-64 place-items-center" role="status">
          <LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement des ventes" />
        </div>
      ) : salesQuery.isError ? (
        <Alert tone="error">
          {salesErrorMessage(salesQuery.error)}{' '}
          <Button type="button" variant="link" onClick={() => { void salesQuery.refetch(); }}>
            Réessayer
          </Button>
        </Alert>
      ) : sales.length === 0 ? (
        <EmptyWorkspace
          icon={Receipt}
          title="Aucune vente enregistrée"
          description="Ouvrez « Nouvelle vente » pour encaisser votre premier ticket. Le numéro, le total et la marge seront calculés par le serveur."
        />
      ) : (
        <ul className="space-y-3">
          {sales.map((sale) => (
            <SaleRow key={sale.id} sale={sale} />
          ))}
        </ul>
      )}
    </WorkspaceSection>
  );
}
