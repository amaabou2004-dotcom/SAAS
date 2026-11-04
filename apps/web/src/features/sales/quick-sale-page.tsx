import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Check,
  LoaderCircle,
  MessageCircle,
  Minus,
  PackagePlus,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatMoney, formatQuantity } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import { WorkspaceSection } from '../workspace/workspace-layout';
import { listLocations, listProducts, listStock } from '../workspace/workspace-api';
import { SaleTicket } from './sale-ticket';
import {
  createSale,
  paymentMethods,
  type PaymentMethod,
  type SaleDetail,
} from './sales-api';
import { salesErrorMessage } from './sales-error';
import { receiptWhatsAppText, receiptWhatsAppUrl } from './sales-receipt';

interface Tile {
  variantId: string;
  name: string;
  sku: string;
  price: number;
  imageUrl: string | null;
  available: number;
}

interface CartLine {
  variantId: string;
  name: string;
  price: number;
  quantity: number;
}

const paymentIcons: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  mobile_money: Smartphone,
  credit: ShoppingBag,
};

const paymentHints: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  credit: 'À crédit',
};

/**
 * Caisse tactile : un produit se touche, le panier se remplit, un bouton
 * encaisse. Aucun champ n'est obligatoire pour une vente ordinaire.
 */
export function QuickSalePage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const keyRef = useRef<string | null>(null);

  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  /** Stock disponible d'une variante dans le dépôt qui sort la marchandise. */
  const availableAt = (variantId: string) =>
    (stockQuery.data ?? [])
      .filter((row) => row.location_id === activeLocationId && row.variant_id === variantId)
      .reduce((sum, row) => sum + row.available, 0);

  const tiles = useMemo<Tile[]>(
    () =>
      (productsQuery.data ?? [])
        .filter((product) => product.active)
        .flatMap((product) =>
          product.variants
            .filter((variant) => variant.active)
            .map((variant) => ({
              variantId: variant.id,
              name: product.name,
              sku: variant.sku,
              price: product.sale_price,
              imageUrl: product.image_url,
              available: availableAt(variant.id),
            })),
        ),
    // `availableAt` dépend du stock et du dépôt choisi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productsQuery.data, stockQuery.data, activeLocationId],
  );

  const visibleTiles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tiles;
    return tiles.filter(
      (tile) => tile.name.toLowerCase().includes(needle) || tile.sku.toLowerCase().includes(needle),
    );
  }, [search, tiles]);

  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  const saleMutation = useMutation({
    mutationFn: ({ key }: { key: string }) =>
      createSale(
        accessToken,
        tenant.id,
        {
          location_id: activeLocationId,
          payment_method: paymentMethod,
          payment_reference: paymentMethod === 'mobile_money' ? reference.trim() || null : null,
          customer_name: customerName.trim() || null,
          note: null,
          items: cart.map((line) => ({
            variant_id: line.variantId,
            quantity: line.quantity,
            unit_price: line.price,
          })),
        },
        key,
      ),
  });

  const add = (tile: Tile) => {
    setError(null);
    keyRef.current = null;
    setCart((lines) => {
      const existing = lines.find((line) => line.variantId === tile.variantId);
      if (existing) {
        if (existing.quantity >= tile.available) return lines;
        return lines.map((line) =>
          line.variantId === tile.variantId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      if (tile.available <= 0) return lines;
      return [...lines, { variantId: tile.variantId, name: tile.name, price: tile.price, quantity: 1 }];
    });
  };

  const changeQuantity = (variantId: string, delta: number) => {
    setError(null);
    keyRef.current = null;
    setCart((lines) =>
      lines
        .map((line) => (line.variantId === variantId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  const remove = (variantId: string) => {
    keyRef.current = null;
    setCart((lines) => lines.filter((line) => line.variantId !== variantId));
  };

  const reset = () => {
    keyRef.current = null;
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setReference('');
    setPaymentMethod('cash');
    setSearch('');
    setError(null);
  };

  const encaisser = async () => {
    setError(null);
    if (!activeLocationId) {
      setError('Choisissez d’abord le dépôt qui sort la marchandise.');
      return;
    }
    if (cart.length === 0) {
      setError('Touchez au moins un produit pour l’encaisser.');
      return;
    }
    if (paymentMethod === 'credit' && customerName.trim().length < 2) {
      setError('Pour une vente à crédit, indiquez le nom du client.');
      return;
    }
    if (paymentMethod === 'mobile_money' && reference.trim().length < 4) {
      setError('Indiquez la référence Mobile Money (au moins 4 caractères).');
      return;
    }

    const key = keyRef.current ?? crypto.randomUUID();
    keyRef.current = key;
    try {
      const sale = await saleMutation.mutateAsync({ key });
      setCreated(sale);
      reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'movements', tenant.id] }),
      ]);
    } catch (caught) {
      setError(salesErrorMessage(caught));
    }
  };

  if (created) {
    const receipt = receiptWhatsAppText(created, {
      shopName: tenant.name,
      currency: tenant.currency_code,
      timezone: tenant.timezone,
    });

    return (
      <WorkspaceSection
        title="Vente encaissée"
        description="Le stock est à jour. Envoyez le reçu au client, puis servez le suivant."
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
                <Button asChild variant="mint" className="sm:flex-1">
                  <a href={receiptWhatsAppUrl(receipt, customerPhone)} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" aria-hidden="true" />
                    Envoyer le reçu sur WhatsApp
                  </a>
                </Button>
                <Button type="button" variant="outline" onClick={() => setCreated(null)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Vente suivante
                </Button>
              </div>
            }
          />

          <p className="text-center text-xs text-slate-500">
            Le reçu s’ouvre dans WhatsApp, déjà rédigé : vous choisissez le contact et vous envoyez.
          </p>
        </div>
      </WorkspaceSection>
    );
  }

  return (
    <WorkspaceSection
      title="Caisse"
      description="Touchez vos produits, encaissez en un geste, puis envoyez le reçu au client."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {locations.length > 1 ? (
          <div className="min-w-40">
            <Label htmlFor="caisse-depot">Dépôt qui sort le stock</Label>
            <select
              id="caisse-depot"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              value={activeLocationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="relative min-w-48 flex-1">
          <Label htmlFor="caisse-recherche">Chercher un produit</Label>
          <Search className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-slate-400" aria-hidden="true" />
          <Input
            id="caisse-recherche"
            className="mt-1 pl-9"
            placeholder="Nom ou code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {productsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Chargement des produits…
        </div>
      ) : tiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <PackagePlus className="mx-auto size-8 text-slate-400" aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">Aucun produit à vendre pour l’instant</p>
          <p className="mt-1 text-sm text-slate-600">Ajoutez un produit : il apparaîtra ici, prêt à être touché.</p>
          <Button asChild variant="mint" className="mt-4">
            <Link to="/workspace/produits">Ajouter un produit</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleTiles.map((tile) => {
            const quantity = cart.find((line) => line.variantId === tile.variantId)?.quantity ?? 0;
            const soldOut = tile.available <= 0;
            return (
              <li key={tile.variantId}>
                <button
                  type="button"
                  onClick={() => add(tile)}
                  disabled={soldOut}
                  aria-label={`Ajouter ${tile.name} — ${formatMoney(tile.price, tenant.currency_code)}`}
                  className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition ${
                    soldOut
                      ? 'cursor-not-allowed border-slate-200 opacity-60'
                      : 'border-slate-200 hover:border-mint hover:shadow-md active:scale-[0.99]'
                  }`}
                >
                  <span className="relative block aspect-square w-full bg-slate-100">
                    {tile.imageUrl ? (
                      <img src={tile.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-xl font-bold text-slate-400">
                        {tile.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    {quantity > 0 ? (
                      <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-mint text-sm font-bold text-white shadow">
                        {quantity}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="line-clamp-2 text-sm font-semibold text-ink">{tile.name}</span>
                    <span className="text-sm font-bold tabular-nums text-mint-dark">
                      {formatMoney(tile.price, tenant.currency_code)}
                    </span>
                    <span className={`text-xs ${soldOut ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                      {soldOut ? 'Rupture de stock' : `reste ${formatQuantity(tile.available)}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {visibleTiles.length === 0 && tiles.length > 0 ? (
        <p className="mt-4 text-sm text-slate-500">Aucun produit ne correspond à « {search} ».</p>
      ) : null}

      {/* Panier : toujours visible en bas de l'écran, comme une caisse. */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <ShoppingBag className="size-5 text-mint-dark" aria-hidden="true" />
            Panier
            {itemCount > 0 ? <span className="text-sm font-semibold text-slate-500">({formatQuantity(itemCount)})</span> : null}
          </h2>
          <span className="text-xl font-bold tabular-nums text-ink">{formatMoney(total, tenant.currency_code)}</span>
        </div>

        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Touchez un produit ci-dessus : il s’ajoute ici automatiquement.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {cart.map((line) => (
              <li key={line.variantId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{line.name}</p>
                  <p className="text-xs text-slate-500">{formatMoney(line.price, tenant.currency_code)} l’unité</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Retirer un ${line.name}`}
                    onClick={() => changeQuantity(line.variantId, -1)}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </Button>
                  <span className="min-w-6 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Ajouter un ${line.name}`}
                    onClick={() => changeQuantity(line.variantId, 1)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Enlever ${line.name} du panier`}
                    onClick={() => remove(line.variantId)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="caisse-client">Nom du client (facultatif)</Label>
            <Input
              id="caisse-client"
              className="mt-1"
              value={customerName}
              placeholder="Ex. Fatou"
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="caisse-telephone">Téléphone WhatsApp (pour le reçu)</Label>
            <Input
              id="caisse-telephone"
              className="mt-1"
              type="tel"
              inputMode="tel"
              value={customerPhone}
              placeholder="+227 90 00 00 00"
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </div>
        </div>

        <p className="mt-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">Paiement</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {paymentMethods.map((method) => {
            const Icon = paymentIcons[method];
            const active = paymentMethod === method;
            return (
              <button
                key={method}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPaymentMethod(method);
                  setError(null);
                }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                  active
                    ? 'border-mint bg-teal-50 text-mint-dark'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {paymentHints[method]}
                {active ? <Check className="size-4" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        {paymentMethod === 'mobile_money' ? (
          <div className="mt-3">
            <Label htmlFor="caisse-reference">Référence Mobile Money</Label>
            <Input
              id="caisse-reference"
              className="mt-1"
              value={reference}
              placeholder="Ex. 1234 5678"
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
        ) : null}

        {error ? <Alert tone="error" className="mt-4">{error}</Alert> : null}

        <Button
          type="button"
          variant="mint"
          size="lg"
          className="mt-4 w-full"
          loading={saleMutation.isPending}
          disabled={cart.length === 0}
          onClick={() => { void encaisser(); }}
        >
          <Banknote className="size-5" aria-hidden="true" />
          Encaisser {total > 0 ? formatMoney(total, tenant.currency_code) : ''}
        </Button>
      </section>
    </WorkspaceSection>
  );
}
