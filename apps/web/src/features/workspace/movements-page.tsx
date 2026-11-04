import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, LoaderCircle, RotateCcw } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyWorkspace, WorkspaceSection } from './workspace-layout';
import { useWorkspace } from './workspace-context';
import { formatDate, formatQuantity } from './workspace-format';
import { listMovements, reverseStockOperation, type StockMovement } from './workspace-api';

const operationLabels: Record<string, string> = {
  opening: 'Stock initial',
  receipt: 'Réception',
  adjustment: 'Ajustement',
  transfer: 'Transfert',
  reversal: 'Contre-passation',
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

export function MovementsPage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const reversalKeys = useRef(new Map<string, string>());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const movementsQuery = useQuery({
    queryKey: ['inventory', 'movements', tenant.id],
    queryFn: () => listMovements(accessToken, tenant.id),
  });
  const reversalMutation = useMutation({
    mutationFn: ({ operationId, reason, key }: { operationId: string; reason: string; key: string }) =>
      reverseStockOperation(accessToken, tenant.id, operationId, reason, key),
  });
  const movements = movementsQuery.data ?? [];
  const reversedOperationIds = new Set(movements.map((movement) => movement.reverses_operation_id).filter((id): id is string => Boolean(id)));
  const operations: Array<{ id: string; lines: StockMovement[] }> = [];
  const grouped = new Map<string, StockMovement[]>();
  for (const movement of movements) {
    const lines = grouped.get(movement.operation_id) ?? [];
    lines.push(movement);
    grouped.set(movement.operation_id, lines);
  }
  for (const [id, lines] of grouped) operations.push({ id, lines });

  const reverse = async (event: FormEvent<HTMLFormElement>, operationId: string) => {
    event.preventDefault();
    const reason = reasons[operationId]?.trim();
    setError(null); setSuccess(null);
    if (!reason) {
      setError('Un motif est obligatoire pour contre-passer une opération.');
      return;
    }
    const key = reversalKeys.current.get(operationId) ?? crypto.randomUUID();
    reversalKeys.current.set(operationId, key);
    try {
      await reversalMutation.mutateAsync({ operationId, reason, key });
      reversalKeys.current.delete(operationId);
      setReasons((current) => ({ ...current, [operationId]: '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'movements', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', tenant.id] }),
      ]);
      setSuccess('La contre-passation a été enregistrée. L’opération d’origine reste inchangée.');
    } catch (mutationError) {
      setError(`${errorMessage(mutationError)} La même clé sera réutilisée si vous réessayez sans changer le motif.`);
    }
  };

  return (
    <WorkspaceSection title="Historique" description="Toutes les entrées et sorties, dans l’ordre. Pour corriger une erreur, annulez l’opération : l’original et la correction restent visibles.">
      {error ? <Alert tone="error" className="mb-5">{error}</Alert> : null}
      {success ? <Alert tone="success" className="mb-5">{success}</Alert> : null}
      {movementsQuery.isLoading ? <div className="grid min-h-64 place-items-center" role="status"><LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement des mouvements" /></div>
        : movementsQuery.isError ? <Alert tone="error">{errorMessage(movementsQuery.error)} <Button type="button" variant="link" onClick={() => { void movementsQuery.refetch(); }}>Réessayer</Button></Alert>
          : operations.length === 0 ? <EmptyWorkspace icon={History} title="Aucun mouvement" description="Les réceptions, ajustements, transferts et contre-passations apparaîtront ici après leur enregistrement." />
            : (
              <div className="space-y-5">
                {operations.map(({ id, lines }) => {
                  const first = lines[0];
                  if (!first) return null;
                  const isReversal = first.operation_type === 'reversal';
                  const isReversed = reversedOperationIds.has(id);
                  return (
                    <article key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-bold text-ink">{operationLabels[first.operation_type] ?? first.operation_type}</h2>
                            {isReversed ? <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600">Contre-passée</span> : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(first.created_at, tenant.timezone)} · Acteur : <span className="font-mono">{first.actor_user_id}</span></p>
                          {first.reference ? <p className="mt-1 text-xs text-slate-600">Référence : {first.reference}</p> : null}
                          {first.reason ? <p className="mt-1 text-sm text-slate-600">Motif : {first.reason}</p> : null}
                          {first.reverses_operation_id ? <p className="mt-1 break-all font-mono text-xs text-slate-500">Opération d’origine : {first.reverses_operation_id}</p> : null}
                        </div>
                        <span className="break-all font-mono text-[11px] text-slate-400">{id}</span>
                      </header>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] text-left text-sm">
                          <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3 font-medium">Produit / emplacement</th><th className="px-5 py-3 text-right font-medium">Variation</th><th className="px-5 py-3 text-right font-medium">Physique après</th><th className="px-5 py-3 text-right font-medium">Réservé après</th></tr></thead>
                          <tbody>
                            {lines.map((line) => (
                              <tr key={line.id} className="border-t border-slate-100">
                                <td className="px-5 py-3"><strong className="block text-ink">{line.product_name}</strong><span className="font-mono text-xs text-slate-500">{line.sku} · {line.location_name}</span></td>
                                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${line.quantity_delta < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{line.quantity_delta > 0 ? '+' : ''}{formatQuantity(line.quantity_delta)}</td>
                                <td className="px-5 py-3 text-right tabular-nums">{formatQuantity(line.on_hand_after)}</td>
                                <td className="px-5 py-3 text-right tabular-nums">{formatQuantity(line.reserved_after)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!isReversal && !isReversed ? (
                        <form onSubmit={(event) => { void reverse(event, id); }} className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4">
                          <label htmlFor={`reversal-${id}`} className="sr-only">Motif de la contre-passation</label>
                          <input id={`reversal-${id}`} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-mint focus:ring-4 focus:ring-teal-100" placeholder="Motif de la correction" value={reasons[id] ?? ''} onChange={(event) => { reversalKeys.current.delete(id); setReasons((current) => ({ ...current, [id]: event.target.value })); }} required maxLength={500} />
                          <Button type="submit" variant="outline" size="sm" loading={reversalMutation.isPending && reversalMutation.variables?.operationId === id}><RotateCcw className="size-4" aria-hidden="true" />Contre-passer</Button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
    </WorkspaceSection>
  );
}
