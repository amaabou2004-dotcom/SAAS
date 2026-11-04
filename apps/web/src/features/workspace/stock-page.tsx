import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, LoaderCircle, PackageOpen } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { EmptyWorkspace, WorkspaceSection } from './workspace-layout';
import { useWorkspace } from './workspace-context';
import { formatQuantity } from './workspace-format';
import { listLocations, listProducts, listStock, postStockOperation, type StockOperationInput } from './workspace-api';

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100';
type OperationType = StockOperationInput['operation_type'];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

export function StockPage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const operationKey = useRef<string | null>(null);
  const [operationType, setOperationType] = useState<OperationType>('receipt');
  const [variantId, setVariantId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const stockQuery = useQuery({ queryKey: ['inventory', 'stock', tenant.id], queryFn: () => listStock(accessToken, tenant.id) });
  const productsQuery = useQuery({ queryKey: ['catalog', 'products', tenant.id], queryFn: () => listProducts(accessToken, tenant.id) });
  const locationsQuery = useQuery({ queryKey: ['inventory', 'locations', tenant.id], queryFn: () => listLocations(accessToken, tenant.id) });
  const operationMutation = useMutation({
    mutationFn: ({ input, key }: { input: StockOperationInput; key: string }) => postStockOperation(accessToken, tenant.id, input, key),
  });

  const changed = () => {
    operationKey.current = null;
    setSuccess(null);
    setFormError(null);
  };
  const products = productsQuery.data ?? [];
  const variants = products.filter((product) => product.active).flatMap((product) =>
    product.variants.filter((variant) => variant.active).map((variant) => ({ ...variant, productName: product.name })),
  );
  const locations = (locationsQuery.data ?? []).filter((location) => location.active);
  const stock = stockQuery.data ?? [];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null); setSuccess(null);
    if (!variantId || !locationId || !quantity || !reason.trim()) {
      setFormError('La variante, l’emplacement, la quantité et le motif sont obligatoires.');
      return;
    }
    if (!/^-?\d+(\.\d{1,4})?$/.test(quantity) || Number(quantity) === 0) {
      setFormError('Saisissez une quantité non nulle avec au maximum quatre décimales.');
      return;
    }
    if (operationType !== 'adjustment' && Number(quantity) < 0) {
      setFormError('Cette opération exige une quantité positive. Utilisez un ajustement pour une sortie manuelle.');
      return;
    }
    if (operationType === 'transfer' && (!destinationId || destinationId === locationId)) {
      setFormError('Choisissez une destination différente de la source.');
      return;
    }
    const lines = operationType === 'transfer'
      ? [
          { variant_id: variantId, location_id: locationId, quantity_delta: `-${quantity}` },
          { variant_id: variantId, location_id: destinationId, quantity_delta: quantity },
        ]
      : [{ variant_id: variantId, location_id: locationId, quantity_delta: quantity }];
    const input: StockOperationInput = {
      operation_type: operationType,
      reason: reason.trim(),
      reference: reference.trim() || null,
      lines,
    };
    const key = operationKey.current ?? crypto.randomUUID();
    operationKey.current = key;
    try {
      const result = await operationMutation.mutateAsync({ input, key });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'movements', tenant.id] }),
      ]);
      operationKey.current = null;
      setQuantity(''); setReason(''); setReference('');
      setSuccess(`Opération enregistrée et tracée (${result.id}).`);
    } catch (error) {
      setFormError(`${errorMessage(error)} Vous pouvez réessayer avec les mêmes informations : la clé d’idempotence est conservée.`);
    }
  };

  return (
    <WorkspaceSection title="Stock" description="Ce qu’il vous reste, dépôt par dépôt. Chaque entrée, sortie ou transfert laisse une trace ; rien n’est écrasé.">
      <div className="grid gap-7 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-ink"><ArrowLeftRight className="size-5 text-mint-dark" aria-hidden="true" />Nouvelle opération</h2>
          <p className="mb-5 text-xs leading-5 text-slate-500">Une clé unique protège l’envoi contre les doublons. Le serveur verrouille les soldes pendant la transaction.</p>
          {formError ? <Alert tone="error" className="mb-4">{formError}</Alert> : null}
          {success ? <Alert tone="success" className="mb-4 break-all">{success}</Alert> : null}
          <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
            <div>
              <Label htmlFor="operation-type" className="mb-2 block">Type d’opération</Label>
              <select id="operation-type" className={inputClass} value={operationType} onChange={(event) => { changed(); setOperationType(event.target.value as OperationType); }}>
                <option value="receipt">Réception</option>
                <option value="opening">Stock initial</option>
                <option value="adjustment">Ajustement</option>
                <option value="transfer">Transfert entre emplacements</option>
              </select>
            </div>
            <div>
              <Label htmlFor="operation-variant" className="mb-2 block">Produit / variante</Label>
              <select id="operation-variant" className={inputClass} value={variantId} onChange={(event) => { changed(); setVariantId(event.target.value); }} required>
                <option value="">Sélectionner une variante</option>
                {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.productName} — {variant.sku}</option>)}
              </select>
              {!productsQuery.isLoading && variants.length === 0 ? <p className="mt-2 text-xs text-amber-700">Créez d’abord un produit actif dans le catalogue.</p> : null}
            </div>
            <div className={`grid gap-4 ${operationType === 'transfer' ? 'sm:grid-cols-2' : ''}`}>
              <div>
                <Label htmlFor="operation-location" className="mb-2 block">{operationType === 'transfer' ? 'Source' : 'Emplacement'}</Label>
                <select id="operation-location" className={inputClass} value={locationId} onChange={(event) => { changed(); setLocationId(event.target.value); }} required>
                  <option value="">Sélectionner</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.code})</option>)}
                </select>
              </div>
              {operationType === 'transfer' ? (
                <div>
                  <Label htmlFor="operation-destination" className="mb-2 block">Destination</Label>
                  <select id="operation-destination" className={inputClass} value={destinationId} onChange={(event) => { changed(); setDestinationId(event.target.value); }} required>
                    <option value="">Sélectionner</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.code})</option>)}
                  </select>
                </div>
              ) : null}
            </div>
            <div>
              <Label htmlFor="operation-quantity" className="mb-2 block">Quantité {operationType === 'adjustment' ? '(positive ou négative)' : '(positive)'}</Label>
              <input id="operation-quantity" type="text" inputMode="decimal" className={inputClass} value={quantity} onChange={(event) => { changed(); setQuantity(event.target.value); }} required />
            </div>
            <div>
              <Label htmlFor="operation-reason" className="mb-2 block">Motif</Label>
              <input id="operation-reason" className={inputClass} value={reason} onChange={(event) => { changed(); setReason(event.target.value); }} required maxLength={500} />
            </div>
            <div>
              <Label htmlFor="operation-reference" className="mb-2 block">Référence <span className="font-normal text-slate-400">(optionnelle)</span></Label>
              <input id="operation-reference" className={inputClass} value={reference} onChange={(event) => { changed(); setReference(event.target.value); }} maxLength={120} />
            </div>
            <Button type="submit" variant="mint" className="w-full" loading={operationMutation.isPending} disabled={variants.length === 0 || locations.length === 0}>Enregistrer l’opération</Button>
          </form>
        </div>

        <div className="min-w-0">
          <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950"><strong>Disponible = physique − réservé.</strong> Les réservations ne sont pas modifiables depuis ce formulaire.</div>
          {stockQuery.isLoading ? <div className="grid min-h-64 place-items-center" role="status"><LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement du stock" /></div>
            : stockQuery.isError ? <Alert tone="error">{errorMessage(stockQuery.error)} <Button type="button" variant="link" onClick={() => { void stockQuery.refetch(); }}>Réessayer</Button></Alert>
              : stock.length === 0 ? <EmptyWorkspace icon={PackageOpen} title="Aucun stock enregistré" description="Enregistrez un stock initial ou une réception pour obtenir un solde. Aucun chiffre n’est prérempli." />
                : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Produit / emplacement</th><th className="px-4 py-3 text-right">Physique</th><th className="px-4 py-3 text-right">Réservé</th><th className="px-4 py-3 text-right">Disponible</th></tr></thead>
                      <tbody>
                        {stock.map((row) => (
                          <tr key={`${row.variant_id}-${row.location_id}`} className="border-t border-slate-100">
                            <td className="px-4 py-4"><strong className="block text-ink">{row.product_name}</strong><span className="mt-1 block font-mono text-xs text-slate-500">{row.sku} · {row.location_name} ({row.location_code})</span></td>
                            <td className="px-4 py-4 text-right tabular-nums">{formatQuantity(row.on_hand)}</td>
                            <td className="px-4 py-4 text-right tabular-nums">{formatQuantity(row.reserved)}</td>
                            <td className="px-4 py-4 text-right font-bold tabular-nums text-ink">{formatQuantity(row.available)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
          {productsQuery.isError || locationsQuery.isError ? <Alert tone="error" className="mt-4">Le formulaire n’a pas pu charger toutes ses références. Rechargez la page avant de valider une opération.</Alert> : null}
        </div>
      </div>
    </WorkspaceSection>
  );
}
