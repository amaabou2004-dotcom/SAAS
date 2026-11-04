import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, LoaderCircle, PackageCheck, Search, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SiteFooter } from '../../components/site-footer';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { formatMoney } from '../workspace/workspace-format';
import { isValidSlug, trackShopOrder, type ShopOrderTracking } from './storefront-api';

const steps = [
  { status: 'pending', label: 'Commande envoyée', Icon: Clock },
  { status: 'confirmed', label: 'Confirmée par la boutique', Icon: CheckCircle2 },
  { status: 'delivered', label: 'Livrée', Icon: Truck },
] as const;

function statusMessage(order: ShopOrderTracking) {
  switch (order.status) {
    case 'pending':
      return 'La boutique a bien reçu votre commande. Elle vous appelle pour confirmer.';
    case 'confirmed':
      return 'Votre commande est confirmée : la boutique prépare la livraison.';
    case 'delivered':
      return 'Votre commande a été livrée. Merci de votre confiance !';
    case 'cancelled':
      return order.cancel_reason
        ? `Cette commande a été annulée : ${order.cancel_reason}`
        : 'Cette commande a été annulée. Contactez la boutique pour en savoir plus.';
  }
}

function TrackingCard({ order }: { order: ShopOrderTracking }) {
  const cancelled = order.status === 'cancelled';

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-bold text-ink">{order.number}</p>
          <p className="mt-1 text-sm text-slate-600">
            {order.item_count} article(s) · {formatMoney(order.total, order.currency_code)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            cancelled
              ? 'bg-red-50 text-red-700'
              : order.status === 'delivered'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          {cancelled ? 'Annulée' : order.status === 'delivered' ? 'Livrée' : order.status === 'confirmed' ? 'Confirmée' : 'En attente'}
        </span>
      </div>

      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{statusMessage(order)}</p>

      {!cancelled ? (
        <ol className="mt-5 space-y-3">
          {steps.map(({ status, label, Icon }) => {
            const order_index = steps.findIndex((step) => step.status === order.status);
            const current = steps.findIndex((step) => step.status === status);
            const done = current <= order_index;
            return (
              <li key={status} className="flex items-center gap-3">
                {done ? (
                  <Icon className="size-5 shrink-0 text-mint-dark" aria-hidden="true" />
                ) : (
                  <span className="size-5 shrink-0 rounded-full border-2 border-slate-200" aria-hidden="true" />
                )}
                <span className={done ? 'text-sm font-semibold text-ink' : 'text-sm text-slate-500'}>{label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-red-700">
          <XCircle className="size-4" aria-hidden="true" />
          Commande annulée
        </p>
      )}
    </section>
  );
}

/** Suivi public : le client retrouve sa commande avec le numéro reçu. */
export function OrderTrackingPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const [number, setNumber] = useState(params.get('numero') ?? '');
  const [submitted, setSubmitted] = useState((params.get('numero') ?? '').trim());
  const validSlug = isValidSlug(slug);

  const query = useQuery({
    queryKey: ['shop', slug, 'track', submitted],
    queryFn: () => trackShopOrder(slug, submitted),
    enabled: validSlug && submitted.length > 0,
    retry: 0,
  });

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <Link to={`/b/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-mint-dark">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour à la boutique
          </Link>
          <PackageCheck className="size-5 text-mint-dark" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Suivre ma commande</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Saisissez le numéro reçu à la commande (par exemple <strong>CMD-000123</strong>).
        </p>

        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(number.trim().toUpperCase());
          }}
        >
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              className="pl-9"
              aria-label="Numéro de commande"
              placeholder="CMD-000123"
              value={number}
              onChange={(event) => setNumber(event.target.value.toUpperCase())}
            />
          </div>
          <Button type="submit" variant="mint" disabled={!validSlug || number.trim().length === 0}>
            Voir ma commande
          </Button>
        </form>

        {!validSlug ? (
          <Alert tone="error" className="mt-5">
            Cette boutique n’existe pas ou son adresse a changé.
          </Alert>
        ) : query.isFetching ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-slate-500" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Recherche de votre commande…
          </p>
        ) : query.isError ? (
          <Alert tone="error" className="mt-5">
            Le suivi est momentanément indisponible. Réessayez dans un instant.
          </Alert>
        ) : submitted && query.data === null ? (
          <Alert tone="info" className="mt-5">
            Aucune commande ne porte ce numéro dans cette boutique. Vérifiez le numéro reçu, ou contactez la boutique.
          </Alert>
        ) : query.data ? (
          <TrackingCard order={query.data} />
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
