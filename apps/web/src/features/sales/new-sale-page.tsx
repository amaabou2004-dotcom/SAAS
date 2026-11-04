import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { formatMoney, formatQuantity } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import { WorkspaceSection } from '../workspace/workspace-layout';
import { listLocations, listProducts, listStock } from '../workspace/workspace-api';
import { SaleTicket } from './sale-ticket';
import {
  createSale,
  paymentMethodLabels,
  paymentMethods,
  type PaymentMethod,
  type SaleDetail,
} from './sales-api';
import { salesErrorMessage } from './sales-error';

const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100';
const QUANTITY = /^\d+(\.\d{1,4})?$/;
const PRICE = /^\d+(\.\d{1,2})?$/;

interface CartLine {
  variant_id: string;
  product_name: string;
  sku: string;
  unit_price: string;
  quantity: string;
}

export function NewSalePage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const keyRef = useRef<string | null>(null);
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<SaleDetail | null>(null);

  const locationsQuery = useQuery({
    queryKey: ['inventory', 'locations', tenant.id],
    queryFn: () => listLocations(accessToken, tenant.id),
  });
  const productsQuery = useQuery({
    queryKey: ['catalog', 'products', tenant.id],
    queryFn: () => listProducts(accessToken, tenant.id),
  });
  const stockQuery = useQuery({
    queryKey: ['inventory', 'stock', tenant.id],
    queryFn: () => listStock(accessToken, tenant.id),
  });
  const locations = (locationsQuery.data ?? []).filter((location) => location.active);
  const activeLocationId = locationId || locations[0]?.id || '';
  /** Stock disponible d'une variante à l'emplacement choisi. */
  const availableAt = (variantId: string) =>
    (stockQuery.data ?? [])
      .filter((row) => row.location_id === activeLocationId && row.variant_id === variantId)
      .reduce((sum, row) => sum + row.available, 0);

  const saleMutation = useMutation({
    mutationFn: ({ key }: { key: string }) =>
      createSale(
        accessToken,
        tenant.id,
        {
          location_id: activeLocationId,
          payment_method: paymentMethod,
          payment_reference: paymentReference.trim() || null,
          customer_name: customerName.trim() || null,
          note: note.trim() || null,
          items: cart.map((line) => ({
            variant_id: line.variant_id,
            quantity: Number(line.quantity),
            unit_price: Number(line.unit_price),
          })),
        },
        key,
      ),
  });

  const sellable = useMemo(
    () =>
      (productsQuery.data ?? [])
        .filter((product) => product.active)
        .flatMap((product) =>
          product.variants
            .filter((variant) => variant.active)
            .map((variant) => ({
              id: variant.id,
              productName: product.name,
              sku: variant.sku,
              salePrice: product.sale_price,
            })),
        ),
    [productsQuery.data],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = needle
      ? sellable.filter(
          (item) => item.productName.toLowerCase().includes(needle) || item.sku.toLowerCase().includes(needle),
        )
      : sellable;
    return rows.slice(0, 8);
  }, [search, sellable]);

  const total = cart.reduce((sum, line) => {
    const price = Number(line.unit_price);
    const quantity = Number(line.quantity);
    if (!Number.isFinite(price) || !Number.isFinite(quantity)) return sum;
    return sum + price * quantity;
  }, 0);

  const resetForm = () => {
    keyRef.current = null;
    setCart([]);
    setPaymentReference('');
    setCustomerName('');
    setNote('');
    setPaymentMethod('cash');
    setSearch('');
    setFormError(null);
  };

  const addToCart = (item: { id: string; productName: string; sku: string; salePrice: number }) => {
    setFormError(null);
    keyRef.current = null;
    setCart((lines) => {
      const existing = lines.find((line) => line.variant_id === item.id);
      if (existing) {
        return lines.map((line) =>
          line.variant_id === item.id
            ? { ...line, quantity: String(Number(line.quantity) + 1) }
            : line,
        );
      }
      return [
        ...lines,
        {
          variant_id: item.id,
          product_name: item.productName,
          sku: item.sku,
          unit_price: String(item.salePrice),
          quantity: '1',
        },
      ];
    });
  };

  const updateLine = (variantId: string, patch: Partial<Pick<CartLine, 'quantity' | 'unit_price'>>) => {
    keyRef.current = null;
    setFormError(null);
    setCart((lines) => lines.map((line) => (line.variant_id === variantId ? { ...line, ...patch } : line)));
  };

  const removeLine = (variantId: string) => {
    keyRef.current = null;
    setCart((lines) => lines.filter((line) => line.variant_id !== variantId));
  };

  const submit = async () => {
    setFormError(null);
    if (!activeLocationId) {
      setFormError('Choisissez l’emplacement qui sort le stock.');
      return;
    }
    if (cart.length === 0) {
      setFormError('Ajoutez au moins un produit au panier.');
      return;
    }
    for (const line of cart) {
      if (!QUANTITY.test(line.quantity) || Number(line.quantity) <= 0) {
        setFormError(`Quantité invalide pour ${line.product_name} (quatre décimales maximum).`);
        return;
      }
      if (!PRICE.test(line.unit_price)) {
        setFormError(`Prix invalide pour ${line.product_name}.`);
        return;
      }
    }
    if (paymentMethod === 'mobile_money' && paymentReference.trim().length < 4) {
      setFormError('Renseignez la référence Mobile Money (au moins 4 caractères).');
      return;
    }
    const key = keyRef.current ?? crypto.randomUUID();
    keyRef.current = key;
    try {
      const sale = await saleMutation.mutateAsync({ key });
      setCreated(sale);
      keyRef.current = null;
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'movements', tenant.id] }),
      ]);
    } catch (caught) {
      setFormError(`${salesErrorMessage(caught)} Vous pouvez réessayer : la clé d’envoi est conservée, aucune vente ne sera comptée deux fois.`);
    }
  };

  if (created) {
    return (
      <WorkspaceSection
        title="Vente enregistrée"
        description="Le ticket est prêt. Le stock a été mis à jour et l’opération est tracée dans les mouvements."
      >
        <div className="mx-auto max-w-2xl space-y-4">
          <Alert tone="success">
            Vente {created.number} enregistrée pour {formatMoney(created.total, tenant.currency_code)}.
          </Alert>
          <SaleTicket
            sale={created}
            currency={tenant.currency_code}
            timezone={tenant.timezone}
            footer={
              <div data-print="hide" className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button type="button" variant="mint" className="sm:flex-1" onClick={() => setCreated(null)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nouvelle vente
                </Button>
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  <Printer className="size-4" aria-hidden="true" />
                  Imprimer
                </Button>
                <Button type="button" variant="ghost" onClick={() => { void navigate('/workspace/ventes'); }}>
                  Mes ventes
                </Button>
              </div>
            }
          />
        </div>
      </WorkspaceSection>
    );
  }

  return (
    <WorkspaceSection
      title="Nouvelle vente"
      description="Cherchez le produit, composez le panier, encaissez. Le total, la marge et les numéros de ticket sont calculés par le serveur, jamais par le navigateur."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/workspace/ventes">Retour aux ventes</Link>
        </Button>
      }
    >
      {locationsQuery.isError || productsQuery.isError || stockQuery.isError ? (
        <Alert tone="error" className="mb-5">
          Le catalogue ou le stock n’a pas pu être chargé. Rechargez la page avant d’encaisser.
        </Alert>
      ) : null}
      {!locationsQuery.isLoading && locations.length === 0 ? (
        <Alert tone="warning" className="mb-5">
          Créez d’abord un emplacement actif dans <Link className="font-semibold underline" to="/workspace/emplacements">Emplacements</Link> :
          une vente doit sortir le stock d’un endroit précis.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <Label htmlFor="sale-location" className="mb-2 block">Emplacement qui sort le stock</Label>
            <select
              id="sale-location"
              className={inputClass}
              value={activeLocationId}
              onChange={(event) => { keyRef.current = null; setLocationId(event.target.value); }}
            >
              <option value="">Sélectionner un emplacement</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name} ({location.code})</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <Label htmlFor="sale-search" className="mb-2 block">Chercher un produit</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="sale-search"
                className={`${inputClass} pl-9`}
                placeholder="Nom ou code (SKU)"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {productsQuery.isLoading ? (
              <div className="grid min-h-24 place-items-center" role="status">
                <LoaderCircle className="size-6 animate-spin text-mint" aria-label="Chargement du catalogue" />
              </div>
            ) : sellable.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Aucun produit actif. Créez un produit dans <Link className="font-semibold text-mint-dark underline" to="/workspace/produits">Produits</Link>.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {filtered.map((item) => {
                  const available = availableAt(item.id);
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{item.productName}</p>
                        <p className="text-xs text-slate-500">
                          <span className="font-mono">{item.sku}</span> · {formatMoney(item.salePrice, tenant.currency_code)} · dispo{' '}
                          <strong className={available > 0 ? 'text-emerald-700' : 'text-red-600'}>{formatQuantity(available)}</strong>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addToCart(item)}
                        aria-label={`Ajouter ${item.productName}`}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Ajouter
                      </Button>
                    </li>
                  );
                })}
                {filtered.length === 0 ? <li className="py-3 text-sm text-slate-500">Aucun produit ne correspond à « {search} ».</li> : null}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <ShoppingCart className="size-5 text-mint-dark" aria-hidden="true" />
              Panier {cart.length > 0 ? <span className="text-sm font-semibold text-slate-500">({cart.length})</span> : null}
            </h2>
            {cart.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Le panier est vide. Ajoutez un produit depuis la liste.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {cart.map((line) => {
                  const available = availableAt(line.variant_id);
                  const over = Number(line.quantity) > available;
                  const lineTotal = Number(line.quantity) * Number(line.unit_price);
                  return (
                    <li key={line.variant_id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{line.product_name}</p>
                          <p className="font-mono text-xs text-slate-500">{line.sku}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.variant_id)}
                          aria-label={`Retirer ${line.product_name}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor={`qty-${line.variant_id}`} className="mb-1 block text-xs">Quantité</Label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Diminuer ${line.product_name}`}
                              onClick={() =>
                                updateLine(line.variant_id, {
                                  quantity: String(Math.max(1, Number(line.quantity) - 1)),
                                })
                              }
                            >
                              <Minus className="size-3.5" aria-hidden="true" />
                            </Button>
                            <input
                              id={`qty-${line.variant_id}`}
                              className={`${inputClass} text-center`}
                              inputMode="decimal"
                              value={line.quantity}
                              onChange={(event) => updateLine(line.variant_id, { quantity: event.target.value })}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Augmenter ${line.product_name}`}
                              onClick={() =>
                                updateLine(line.variant_id, {
                                  quantity: String(Number(line.quantity) + 1),
                                })
                              }
                            >
                              <Plus className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`price-${line.variant_id}`} className="mb-1 block text-xs">Prix unitaire</Label>
                          <input
                            id={`price-${line.variant_id}`}
                            className={inputClass}
                            inputMode="decimal"
                            value={line.unit_price}
                            onChange={(event) => updateLine(line.variant_id, { unit_price: event.target.value })}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className={over ? 'font-semibold text-red-600' : 'text-slate-500'}>
                          {over ? `Stock insuffisant (dispo ${formatQuantity(available)})` : `Disponible : ${formatQuantity(available)}`}
                        </span>
                        <span className="font-bold tabular-nums text-ink">
                          {Number.isFinite(lineTotal) ? formatMoney(lineTotal, tenant.currency_code) : '—'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="text-2xl font-bold tabular-nums text-ink">{formatMoney(total, tenant.currency_code)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-bold text-ink">Paiement</h2>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="sale-payment" className="mb-2 block">Moyen de paiement</Label>
                <select
                  id="sale-payment"
                  className={inputClass}
                  value={paymentMethod}
                  onChange={(event) => { keyRef.current = null; setPaymentMethod(event.target.value as PaymentMethod); }}
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>{paymentMethodLabels[method]}</option>
                  ))}
                </select>
              </div>
              {paymentMethod === 'mobile_money' ? (
                <div>
                  <Label htmlFor="sale-reference" className="mb-2 block">Référence Mobile Money</Label>
                  <input
                    id="sale-reference"
                    className={inputClass}
                    placeholder="N° de transaction"
                    value={paymentReference}
                    maxLength={120}
                    onChange={(event) => { keyRef.current = null; setPaymentReference(event.target.value); }}
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="sale-customer" className="mb-2 block">
                  Client <span className="font-normal text-slate-400">(optionnel)</span>
                </Label>
                <input
                  id="sale-customer"
                  className={inputClass}
                  placeholder="Nom du client"
                  value={customerName}
                  maxLength={120}
                  onChange={(event) => { keyRef.current = null; setCustomerName(event.target.value); }}
                />
              </div>
              <div>
                <Label htmlFor="sale-note" className="mb-2 block">
                  Note <span className="font-normal text-slate-400">(optionnelle)</span>
                </Label>
                <input
                  id="sale-note"
                  className={inputClass}
                  placeholder="Ex. livraison demain"
                  value={note}
                  maxLength={500}
                  onChange={(event) => { keyRef.current = null; setNote(event.target.value); }}
                />
              </div>
            </div>

            {formError ? <Alert tone="error" className="mt-4">{formError}</Alert> : null}

            <Button
              type="button"
              variant="mint"
              size="lg"
              className="mt-4 w-full"
              loading={saleMutation.isPending}
              disabled={cart.length === 0 || !activeLocationId}
              onClick={() => { void submit(); }}
            >
              Encaisser {formatMoney(total, tenant.currency_code)}
            </Button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Le stock est retiré immédiatement. En cas de double clic, une seule vente est enregistrée.
            </p>
          </div>
        </div>
      </div>
    </WorkspaceSection>
  );
}
