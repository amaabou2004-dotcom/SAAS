import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, LoaderCircle, Smartphone, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { friendlyError } from '../../lib/friendly-error';
import { formatMoney } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import { WorkspaceSection } from '../workspace/workspace-layout';
import { addCreditPayment, listCreditSales, type CreditSale } from './sales-api';
import { formatSaleDay } from './sales-format';

function PaymentForm({ sale, onDone }: { sale: CreditSale; onDone: () => void }) {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(sale.remaining));
  const [method, setMethod] = useState<'cash' | 'mobile_money'>('cash');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      addCreditPayment(accessToken, tenant.id, sale.id, {
        amount: Number(amount),
        method,
        reference: method === 'mobile_money' ? reference.trim() || null : null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['credits', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['sales', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['reports', tenant.id] }),
      ]);
      onDone();
    },
    onError: (caught) => setError(friendlyError(caught, 'Le règlement n’a pas pu être enregistré.')),
  });

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`montant-${sale.id}`}>Montant reçu</Label>
          <Input
            id={`montant-${sale.id}`}
            className="mt-1"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`moyen-${sale.id}`}>Moyen</Label>
          <select
            id={`moyen-${sale.id}`}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            value={method}
            onChange={(event) => setMethod(event.target.value === 'mobile_money' ? 'mobile_money' : 'cash')}
          >
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
        </div>
        {method === 'mobile_money' ? (
          <div className="sm:col-span-2">
            <Label htmlFor={`ref-${sale.id}`}>Référence Mobile Money</Label>
            <Input
              id={`ref-${sale.id}`}
              className="mt-1"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      {error ? <Alert tone="error" className="mt-3">{error}</Alert> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="mint"
          loading={mutation.isPending}
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Enregistrer le règlement
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>
      </div>
    </div>
  );
}

/**
 * Crédits : la liste des clients qui doivent encore de l'argent, et
 * l'encaissement du reste sans toucher à la vente d'origine.
 */
export function CreditsPage() {
  const { tenant, accessToken } = useWorkspace();
  const [payingId, setPayingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['credits', tenant.id],
    queryFn: () => listCreditSales(accessToken, tenant.id),
  });

  const credits = query.data ?? [];
  const totalDue = credits.reduce((sum, sale) => sum + sale.remaining, 0);

  return (
    <WorkspaceSection
      title="Crédits"
      description="Les ventes qui n’ont pas encore été entièrement payées. Encaissez le reste quand le client revient."
    >
      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Chargement des crédits…
        </div>
      ) : query.isError ? (
        <Alert tone="error">
          {friendlyError(query.error, 'Les crédits n’ont pas pu être chargés.')}
          <Button className="mt-3" size="sm" variant="outline" onClick={() => { void query.refetch(); }}>
            Réessayer
          </Button>
        </Alert>
      ) : credits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <Wallet className="mx-auto size-8 text-slate-400" aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">Personne ne vous doit d’argent</p>
          <p className="mt-1 text-sm text-slate-600">
            Une vente à crédit apparaît ici automatiquement, avec le nom du client.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">Reste à encaisser</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
              {formatMoney(totalDue, tenant.currency_code)}
            </p>
            <p className="mt-1 text-sm text-amber-900">
              {credits.length} vente(s) à crédit en attente.
            </p>
          </div>

          <ul className="space-y-3">
            {credits.map((sale) => (
              <li key={sale.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{sale.customer_name ?? 'Client non nommé'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {sale.number} · {formatSaleDay(sale.created_at, tenant.timezone)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Reste à payer</p>
                    <p className="text-lg font-bold tabular-nums text-ink">
                      {formatMoney(sale.remaining, tenant.currency_code)}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>Vente : {formatMoney(sale.total, tenant.currency_code)}</span>
                  <span>Déjà payé : {formatMoney(sale.paid, tenant.currency_code)}</span>
                </div>

                {payingId === sale.id ? (
                  <PaymentForm sale={sale} onDone={() => setPayingId(null)} />
                ) : (
                  <Button
                    type="button"
                    variant="mint"
                    className="mt-3"
                    onClick={() => setPayingId(sale.id)}
                  >
                    <Banknote className="size-4" aria-hidden="true" />
                    Encaisser le reste
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Smartphone className="size-3.5" aria-hidden="true" />
            Un règlement partiel est accepté : le reste dû se met à jour tout seul.
          </p>
        </>
      )}
    </WorkspaceSection>
  );
}
