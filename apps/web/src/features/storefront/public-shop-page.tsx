import { useMutation, useQuery } from '@tanstack/react-query';
import { LoaderCircle, Minus, Plus, Search, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Brand } from '../../components/brand';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatMoney } from '../workspace/workspace-format';
import {
  getShopCatalog,
  getShopInfo,
  isValidSlug,
  placeShopOrder,
  whatsappShareUrl,
  type ShopItem,
  type ShopOrderReceipt,
} from './storefront-api';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

function ShopUnavailable({ reason }: { reason: string }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-5">
      <div className="text-center">
        <Store className="mx-auto size-10 text-slate-400" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-ink">Boutique indisponible</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{reason}</p>
        <p className="mt-6 text-xs text-slate-500">
          Demandez au commerçant de vous renvoyer son lien à jour.
        </p>
      </div>
    </main>
  );
}

function formatPrice(value: number, currency: string) {
  return formatMoney(value, currency);
}

export function PublicShopPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const validSlug = isValidSlug(slug);

  const infoQuery = useQuery({
    queryKey: ['shop', slug, 'info'],
    queryFn: () => getShopInfo(slug),
    enabled: validSlug,
    retry: 0,
  });

  const catalogQuery = useQuery({
    queryKey: ['shop', slug, 'catalog'],
    queryFn: () => getShopCatalog(slug),
    enabled: validSlug && Boolean(infoQuery.data),
    retry: 0,
  });

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ShopOrderReceipt | null>(null);
  const keyRef = useRef<string | null>(null);

  const info = infoQuery.data ?? null;
  const currency = info?.currency_code ?? 'XOF';
  const items = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        (item.category_name ?? '').toLowerCase().includes(term),
    );
  }, [items, search]);

  const lines = useMemo(
    () =>
      items
        .filter((item) => (quantities[item.variant_id] ?? 0) > 0)
        .map((item) => ({ item, quantity: quantities[item.variant_id] ?? 0 })),
    [items, quantities],
  );

  const cartCount = lines.reduce((total, line) => total + line.quantity, 0);
  const cartTotal = lines.reduce((total, line) => total + line.quantity * line.item.unit_price, 0);

  const order = useMutation({
    mutationFn: (payload: { input: Parameters<typeof placeShopOrder>[1]; key: string }) =>
      placeShopOrder(slug, payload.input, payload.key),
  });

  const add = (item: ShopItem, delta: number) => {
    setQuantities((current) => {
      const next = Math.min(Math.max((current[item.variant_id] ?? 0) + delta, 0), item.available);
      const updated = { ...current };
      if (next <= 0) delete updated[item.variant_id];
      else updated[item.variant_id] = next;
      return updated;
    });
  };

  const submit = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Indiquez votre nom.');
      return;
    }
    if (!/^[0-9+() .-]{6,32}$/.test(phone.trim())) {
      setFormError('Indiquez un numéro de téléphone valide (au moins 6 chiffres).');
      return;
    }
    if (lines.length === 0) {
      setFormError('Votre panier est vide.');
      return;
    }
    const key = keyRef.current ?? crypto.randomUUID();
    keyRef.current = key;
    try {
      const placed = await order.mutateAsync({
        key,
        input: {
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          note: note.trim() ? note.trim() : null,
          items: lines.map((line) => ({ variant_id: line.item.variant_id, quantity: line.quantity })),
        },
      });
      keyRef.current = null;
      setReceipt(placed);
      setQuantities({});
      setCheckoutOpen(false);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'La commande n’a pas pu être envoyée.');
    }
  };

  if (!validSlug) {
    return <ShopUnavailable reason="Ce lien de boutique est incomplet." />;
  }

  if (infoQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas" role="status" aria-label="Chargement de la boutique">
        <LoaderCircle className="size-8 animate-spin text-mint" aria-hidden="true" />
      </div>
    );
  }

  if (infoQuery.isError) {
    return (
      <ShopUnavailable
        reason={infoQuery.error instanceof Error ? infoQuery.error.message : 'Impossible de joindre cette boutique.'}
      />
    );
  }

  if (!info) {
    return <ShopUnavailable reason="Cette boutique n’est pas encore ouverte, ou l’adresse a changé." />;
  }

  return (
    <div className="min-h-screen bg-canvas pb-28">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Store className="size-6 shrink-0 text-mint-dark" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-ink">{info.display_name}</p>
              <p className="text-xs text-slate-500">Boutique en ligne · {info.tenant_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {info.whatsapp ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={whatsappShareUrl(`Bonjour ${info.display_name}, j’ai une question sur votre boutique.`, info.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </Button>
            ) : null}
            <span className="hidden text-xs text-slate-400 sm:block">
              <Brand className="w-24" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        {receipt ? (
          <section className={`${cardClass} mb-6 border-emerald-200 bg-emerald-50`}>
            <h2 className="text-lg font-bold text-emerald-900">Commande envoyée ✅</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Numéro <strong>{receipt.number}</strong> — {receipt.item_count} article(s) pour{' '}
              <strong>{formatPrice(receipt.total, currency)}</strong>.
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-900">
              La boutique va vous appeler au numéro indiqué pour confirmer la livraison.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="mint" onClick={() => setReceipt(null)}>Commander autre chose</Button>
              {info.whatsapp ? (
                <Button asChild variant="outline">
                  <a
                    href={whatsappShareUrl(`Bonjour, je viens de passer la commande ${receipt.number}.`, info.whatsapp)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Écrire à la boutique
                  </a>
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-ink">Catalogue</h1>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              className="pl-9"
              placeholder="Chercher un produit"
              aria-label="Chercher un produit"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {catalogQuery.isLoading ? (
          <p className="mt-6 text-sm text-slate-500" role="status">Chargement des produits…</p>
        ) : catalogQuery.isError ? (
          <Alert tone="error" className="mt-4">
            {catalogQuery.error instanceof Error ? catalogQuery.error.message : 'Le catalogue n’a pas pu être chargé.'}
          </Alert>
        ) : visibleItems.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
            {items.length === 0
              ? 'La boutique n’a pas encore de produit. Le commerçant doit ajouter un produit dans ses « Produits ».'
              : 'Aucun produit ne correspond à cette recherche.'}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {visibleItems.map((item) => {
              const quantity = quantities[item.variant_id] ?? 0;
              return (
                <li key={item.variant_id} className={cardClass}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="mb-3 aspect-[4/3] w-full rounded-xl bg-slate-100 object-cover"
                    />
                  ) : null}
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {item.category_name ?? 'Produit'}
                  </p>
                  <p className="mt-1 font-semibold text-ink">{item.name}</p>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>
                  ) : null}
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-base font-bold tabular-nums text-ink">
                        {formatPrice(item.unit_price, currency)}
                      </p>
                      {item.available > 0 ? (
                        <p className="text-xs text-slate-500">reste {item.available}</p>
                      ) : (
                        <p className="text-xs font-semibold text-amber-700">rupture de stock</p>
                      )}
                    </div>
                    {item.available <= 0 ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                        Indisponible
                      </span>
                    ) : quantity === 0 ? (
                      <Button size="sm" variant="mint" type="button" onClick={() => add(item, 1)}>
                        <Plus className="size-4" aria-hidden="true" />Ajouter
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          aria-label={`Retirer un ${item.name}`}
                          onClick={() => add(item, -1)}
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </Button>
                        <span className="min-w-6 text-center text-sm font-bold tabular-nums text-ink">{quantity}</span>
                        <Button
                          size="sm"
                          variant="mint"
                          type="button"
                          aria-label={`Ajouter un ${item.name}`}
                          disabled={quantity >= item.available}
                          onClick={() => add(item, 1)}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {checkoutOpen ? (
          <section className={`${cardClass} mt-6`}>
            <h2 className="text-lg font-bold text-ink">Vos coordonnées</h2>
            <p className="mt-1 text-sm text-slate-600">
              La boutique vous contacte pour confirmer. Aucun paiement n’est demandé en ligne.
            </p>
            <div className="mt-4 grid gap-3">
              <div>
                <Label htmlFor="shop-name">Votre nom</Label>
                <Input
                  id="shop-name"
                  className="mt-1"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="shop-phone">Téléphone (WhatsApp)</Label>
                <Input
                  id="shop-phone"
                  className="mt-1"
                  type="tel"
                  inputMode="tel"
                  placeholder="+227 90 00 00 00"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="shop-note">Précision (facultatif)</Label>
                <textarea
                  id="shop-note"
                  className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100"
                  placeholder="Adresse de livraison, heure souhaitée…"
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            </div>
            {formError ? <Alert tone="error" className="mt-3">{formError}</Alert> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="mint" type="button" loading={order.isPending} onClick={() => { void submit(); }}>
                <ShoppingBag className="size-4" aria-hidden="true" />Envoyer la commande
              </Button>
              <Button variant="ghost" type="button" onClick={() => setCheckoutOpen(false)}>Continuer mes achats</Button>
            </div>
          </section>
        ) : null}

        {lines.length > 0 ? (
          <section className={`${cardClass} mt-6`}>
            <h2 className="text-sm font-bold text-ink">Mon panier</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {lines.map(({ item, quantity }) => (
                <li key={item.variant_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-700">
                    {quantity} × {item.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-ink">
                      {formatPrice(quantity * item.unit_price, currency)}
                    </span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Retirer ${item.name} du panier`}
                      onClick={() => setQuantities((current) => {
                        const next = { ...current };
                        delete next[item.variant_id];
                        return next;
                      })}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      {cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="text-xs text-slate-500">{cartCount} article(s)</p>
              <p className="text-base font-bold tabular-nums text-ink">{formatPrice(cartTotal, currency)}</p>
            </div>
            <Button
              variant="mint"
              size="lg"
              type="button"
              onClick={() => {
                setReceipt(null);
                setCheckoutOpen(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ShoppingBag className="size-4" aria-hidden="true" />Commander
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
