import { friendlyError } from '../../lib/friendly-error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, LoaderCircle, MapPin, Package, Phone, Send, Store, Truck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { listLocations, listProducts, type Product } from '../workspace/workspace-api';
import { formatDate, formatMoney } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import { EmptyWorkspace, WorkspaceSection } from '../workspace/workspace-layout';
import { hasPermission } from '../team/team-api';
import { OrderNotificationsCard } from './order-notifications-card';
import {
  cancelStorefrontOrder,
  confirmStorefrontOrder,
  getStorefrontSettings,
  listStorefrontOrders,
  markStorefrontOrderDelivered,
  orderStatusLabels,
  orderStatusTones,
  publicShopUrl,
  saveStorefrontSettings,
  slugify,
  whatsappShareUrl,
  type StorefrontOrder,
  type StorefrontSettings,
} from './storefront-api';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';

function errorMessage(caught: unknown, fallback: string) {
  return friendlyError(caught, fallback);
}

function StatusBadge({ status }: { status: StorefrontOrder['status'] }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${orderStatusTones[status]}`}>
      {orderStatusLabels[status]}
    </span>
  );
}

function SettingsForm({
  settings,
  canManage,
  locations,
  onSaved,
}: {
  settings: StorefrontSettings;
  canManage: boolean;
  locations: Array<{ id: string; name: string; active: boolean }>;
  onSaved: (next: StorefrontSettings) => void;
}) {
  const { tenant, accessToken } = useWorkspace();
  const [slug, setSlug] = useState(settings.slug);
  const [name, setName] = useState(settings.display_name);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp ?? '');
  const [locationId, setLocationId] = useState(settings.default_location_id ?? '');
  const [published, setPublished] = useState(settings.published);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof saveStorefrontSettings>[2]) =>
      saveStorefrontSettings(accessToken, tenant.id, input),
  });

  const activeLocations = locations.filter((location) => location.active);
  const link = settings.slug ? publicShopUrl(settings.slug) : '';

  const save = async () => {
    setError(null);
    setSaved(false);
    try {
      const next = await mutation.mutateAsync({
        slug: slugify(slug),
        display_name: name.trim() || null,
        whatsapp: whatsapp.trim() || null,
        published,
        default_location_id: locationId || null,
      });
      onSaved(next);
      setSaved(true);
    } catch (caught) {
      setError(errorMessage(caught, 'La boutique n’a pas pu être enregistrée.'));
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Le lien n’a pas pu être copié. Sélectionnez-le à la main.');
    }
  };

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Store className="size-5 text-mint-dark" aria-hidden="true" />Ma boutique en ligne
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
            Partagez ce lien sur WhatsApp : vos clients voient le catalogue sans créer de compte et vous envoient leur
            commande. Les photos ajoutées dans « Produits » s’affichent ici et sur la page publique.
          </p>
        </div>
        <StatusBadge status={published ? 'confirmed' : 'cancelled'} />
      </div>

      {!canManage ? (
        <Alert tone="info" className="mt-4">
          Seul un administrateur (droit « gérer la boutique ») peut modifier ces réglages. Vous pouvez consulter et
          traiter les commandes.
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="shop-slug">Adresse de la boutique</Label>
          <div className="mt-1 flex items-center gap-2">
            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-2 text-sm text-slate-500">/b/</span>
            <Input
              id="shop-slug"
              value={slug}
              disabled={!canManage}
              placeholder="ma-boutique"
              onChange={(event) => setSlug(slugify(event.target.value))}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">3 à 40 caractères : lettres minuscules, chiffres et tirets.</p>
        </div>
        <div>
          <Label htmlFor="shop-name">Nom affiché</Label>
          <Input
            id="shop-name"
            className="mt-1"
            value={name}
            disabled={!canManage}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="shop-whatsapp">Numéro WhatsApp</Label>
          <Input
            id="shop-whatsapp"
            className="mt-1"
            type="tel"
            inputMode="tel"
            value={whatsapp}
            disabled={!canManage}
            placeholder="+227 90 00 00 00"
            onChange={(event) => setWhatsapp(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="shop-location">Emplacement de confirmation</Label>
          <select
            id="shop-location"
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            value={locationId}
            disabled={!canManage}
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">Demander à chaque confirmation</option>
            {activeLocations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Le stock de cet emplacement sera retiré quand vous confirmez une commande.
          </p>
        </div>
      </div>

      {error ? <Alert tone="error" className="mt-4">{error}</Alert> : null}
      {saved ? <Alert tone="success" className="mt-4">Réglages enregistrés.</Alert> : null}

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="mint" type="button" loading={mutation.isPending} onClick={() => { void save(); }}>
            Enregistrer
          </Button>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Boutique ouverte au public
          </label>
        </div>
      ) : null}

      {link ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {settings.published ? 'Lien à partager' : 'Lien (boutique fermée)'}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-ink">{link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" type="button" onClick={() => { void copy(); }}>
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? 'Lien copié' : 'Copier le lien'}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />Ouvrir la boutique
              </a>
            </Button>
            <Button asChild size="sm" variant="mint">
              <a
                href={whatsappShareUrl(
                  `Bonjour ! Voici ma boutique ${settings.display_name} : ${link}`,
                  settings.whatsapp,
                )}
                target="_blank"
                rel="noreferrer"
              >
                <Send className="size-4" aria-hidden="true" />Envoyer sur WhatsApp
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Choisissez une adresse puis enregistrez : votre lien de boutique apparaîtra ici.
        </p>
      )}
    </section>
  );
}

/**
 * Rappel visuel : la boutique ne demande aucun ajout manuel de produit.
 * Tout produit actif du catalogue y apparaît, avec ou sans stock.
 */
function ShopCatalogueCard({ products, published }: { products: Product[]; published: boolean }) {
  const activeCount = products.filter((product) => product.active).length;
  return (
    <section className={cardClass}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <Package className="size-5 text-mint-dark" aria-hidden="true" />Produits affichés dans la boutique
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
        {activeCount > 0
          ? `Vos ${activeCount} produit(s) actif(s) sont déjà en ligne, sans rien ajouter ici.`
          : 'Aucun produit actif pour l’instant. Ajoutez un produit : il apparaîtra ici automatiquement.'}
      </p>
      <ul className="mt-3 grid gap-1 text-sm text-slate-600">
        <li>• Un produit <strong>actif</strong> s’affiche : nom, photo, prix de vente, catégorie.</li>
        <li>• Sans stock, il s’affiche quand même avec la mention <strong>« rupture de stock »</strong> et ne peut pas être commandé.</li>
        <li>• Un produit <strong>désactivé</strong> est masqué, sans rien supprimer de votre historique.</li>
      </ul>
      {!published ? (
        <Alert tone="info" className="mt-4">
          La boutique est encore fermée : cochez « Boutique ouverte au public » plus haut puis enregistrez pour que vos
          clients voient ces produits.
        </Alert>
      ) : null}
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link to="/workspace/produits">
          <Package className="size-4" aria-hidden="true" />Ajouter ou modifier un produit
        </Link>
      </Button>
    </section>
  );
}

function OrderCard({
  order,
  canManageSales,
  defaultLocationId,
  locations,
  currency,
  timezone,
}: {
  order: StorefrontOrder;
  canManageSales: boolean;
  defaultLocationId: string | null;
  locations: Array<{ id: string; name: string; active: boolean }>;
  currency: string;
  timezone: string;
}) {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(defaultLocationId ?? '');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['storefront', 'orders', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['storefront', 'settings', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['sales', tenant.id] }),
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', tenant.id] }),
    ]);
  };

  const confirm = useMutation({
    mutationFn: () => confirmStorefrontOrder(accessToken, tenant.id, order.id, locationId || null),
  });
  const cancel = useMutation({
    mutationFn: (text: string) => cancelStorefrontOrder(accessToken, tenant.id, order.id, text),
  });
  const deliver = useMutation({
    mutationFn: () => markStorefrontOrderDelivered(accessToken, tenant.id, order.id),
  });

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await action();
      await invalidate();
    } catch (caught) {
      setError(errorMessage(caught, fallback));
    }
  };

  const activeLocations = locations.filter((location) => location.active);

  return (
    <li className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">{order.number}</p>
          <p className="text-xs text-slate-500">{formatDate(order.created_at, timezone)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        <span className="font-semibold">{order.customer_name}</span>
        <a className="inline-flex items-center gap-1 text-mint-dark underline-offset-4 hover:underline" href={`tel:${order.customer_phone}`}>
          <Phone className="size-3.5" aria-hidden="true" />{order.customer_phone}
        </a>
        <a
          className="text-xs font-semibold text-slate-500 hover:text-mint-dark"
          href={whatsappShareUrl(`Bonjour ${order.customer_name}, votre commande ${order.number} est en préparation.`, order.customer_phone)}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
      </div>

      {order.note ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{order.note}</p> : null}

      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {order.items.map((item) => (
          <li key={item.variant_id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate text-slate-700">{item.quantity} × {item.product_name}</span>
            <span className="font-semibold tabular-nums text-ink">{formatMoney(item.line_total, currency)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-500">{order.item_count} article(s)</span>
        <span className="font-bold tabular-nums text-ink">{formatMoney(order.total, currency)}</span>
      </p>

      {order.cancel_reason ? (
        <p className="mt-2 text-xs text-slate-500">Motif d’annulation : {order.cancel_reason}</p>
      ) : null}

      {error ? <Alert tone="error" className="mt-3">{error}</Alert> : null}

      {order.status === 'pending' && canManageSales ? (
        <div className="mt-4 space-y-3">
          {!defaultLocationId ? (
            <div>
              <Label htmlFor={`order-location-${order.id}`} className="text-xs">Emplacement du stock</Label>
              <select
                id={`order-location-${order.id}`}
                className="mt-1 min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">Choisir…</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="mint"
              size="sm"
              type="button"
              loading={confirm.isPending}
              disabled={!locationId}
              onClick={() => { void run(() => confirm.mutateAsync(), 'La commande n’a pas pu être confirmée.'); }}
            >
              <Truck className="size-4" aria-hidden="true" />Confirmer en vente
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setCancelOpen((open) => !open)}
            >
              <X className="size-4" aria-hidden="true" />Annuler la commande
            </Button>
          </div>
          {!locationId ? (
            <p className="text-xs text-amber-700">Choisissez l’emplacement d’où sortira le stock.</p>
          ) : null}
          {cancelOpen ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Label htmlFor={`order-reason-${order.id}`} className="text-xs">Motif (visible dans l’historique)</Label>
              <Input
                id={`order-reason-${order.id}`}
                className="mt-1"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Client injoignable"
              />
              <Button
                className="mt-2"
                size="sm"
                variant="default"
                type="button"
                loading={cancel.isPending}
                onClick={() => {
                  if (reason.trim().length < 2) {
                    setError('Indiquez un motif d’annulation (2 caractères minimum).');
                    return;
                  }
                  void run(() => cancel.mutateAsync(reason.trim()), 'La commande n’a pas pu être annulée.');
                }}
              >
                Confirmer l’annulation
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {order.status === 'confirmed' && canManageSales ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            loading={deliver.isPending}
            onClick={() => { void run(() => deliver.mutateAsync(), 'La livraison n’a pas pu être enregistrée.'); }}
          >
            <Check className="size-4" aria-hidden="true" />Marquer comme livrée
          </Button>
          <span className="text-xs text-slate-500">
            Vente créée : retrouvez-la et annulez-la depuis l’onglet Ventes.
          </span>
        </div>
      ) : null}
    </li>
  );
}

export function StorefrontPage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['storefront', 'settings', tenant.id],
    queryFn: () => getStorefrontSettings(accessToken, tenant.id),
  });
  const ordersQuery = useQuery({
    queryKey: ['storefront', 'orders', tenant.id],
    queryFn: () => listStorefrontOrders(accessToken, tenant.id),
  });
  const locationsQuery = useQuery({
    queryKey: ['inventory', 'locations', tenant.id],
    queryFn: () => listLocations(accessToken, tenant.id),
  });
  const productsQuery = useQuery({
    queryKey: ['catalog', 'products', tenant.id],
    queryFn: () => listProducts(accessToken, tenant.id),
  });
  const permissionQuery = useQuery({
    queryKey: ['permissions', tenant.id, 'stores.manage'],
    queryFn: () => hasPermission(accessToken, tenant.id, 'stores.manage'),
  });
  const salesPermissionQuery = useQuery({
    queryKey: ['permissions', tenant.id, 'sales.manage'],
    queryFn: () => hasPermission(accessToken, tenant.id, 'sales.manage'),
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const locations = locationsQuery.data ?? [];
  const settings = settingsQuery.data;
  const pendingCount = useMemo(() => orders.filter((order) => order.status === 'pending').length, [orders]);

  return (
    <WorkspaceSection
      title="Ma boutique"
      description="Votre boutique en ligne : le lien à partager et les commandes de vos clients. Confirmer une commande crée une vente et retire le stock."
    >
      {settingsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Chargement de la boutique…
        </div>
      ) : settingsQuery.isError ? (
        <Alert tone="error">
          {errorMessage(settingsQuery.error, 'La boutique n’a pas pu être chargée.')}
          <Button className="mt-3" size="sm" variant="outline" onClick={() => { void settingsQuery.refetch(); }}>
            Réessayer
          </Button>
        </Alert>
      ) : settings ? (
        <SettingsForm
          key={`${settings.slug}|${settings.display_name}|${settings.whatsapp ?? ''}|${settings.published}|${settings.default_location_id ?? ''}`}
          settings={settings}
          canManage={permissionQuery.data === true}
          locations={locations}
          onSaved={(next) => {
            queryClient.setQueryData(['storefront', 'settings', tenant.id], next);
          }}
        />
      ) : null}

      <div className="mt-5">
        <ShopCatalogueCard products={productsQuery.data ?? []} published={settings?.published ?? false} />
      </div>

      <OrderNotificationsCard canManage={permissionQuery.data === true} />

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Commandes reçues</h2>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin className="size-3.5" aria-hidden="true" />
            {pendingCount > 0 ? `${pendingCount} commande(s) à confirmer` : 'Aucune commande en attente'}
          </p>
        </div>

        {ordersQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Chargement des commandes…
          </div>
        ) : ordersQuery.isError ? (
          <Alert tone="error">{errorMessage(ordersQuery.error, 'Les commandes n’ont pas pu être chargées.')}</Alert>
        ) : orders.length === 0 ? (
          <EmptyWorkspace
            icon={Store}
            title="Aucune commande pour l’instant"
            description="Dès qu’un client envoie une commande depuis votre lien, elle apparaît ici avec son nom, son téléphone et le détail des produits."
          />
        ) : (
          <ul className="grid gap-3">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canManageSales={salesPermissionQuery.data === true}
                defaultLocationId={settings?.default_location_id ?? null}
                locations={locations}
                currency={settings?.currency_code ?? tenant.currency_code}
                timezone={tenant.timezone}
              />
            ))}
          </ul>
        )}
      </div>
    </WorkspaceSection>
  );
}
