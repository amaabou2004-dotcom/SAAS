import { friendlyError } from '../../lib/friendly-error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, LoaderCircle, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatDate } from '../workspace/workspace-format';
import { useWorkspace } from '../workspace/workspace-context';
import {
  getNotificationSettings,
  listOrderNotifications,
  notificationStatusLabels,
  notificationStatusTones,
  saveNotificationSettings,
  type NotificationSettings,
  type OrderNotification,
} from './storefront-api';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5';
const emailPattern = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

function errorMessage(caught: unknown, fallback: string) {
  return friendlyError(caught, fallback);
}

function NotificationForm({
  settings,
  canManage,
  onSaved,
}: {
  settings: NotificationSettings;
  canManage: boolean;
  onSaved: (next: NotificationSettings) => void;
}) {
  const { tenant, accessToken } = useWorkspace();
  const [email, setEmail] = useState(settings.recipient_email ?? '');
  // Première configuration : on propose l'alerte activée dès qu'une adresse est saisie.
  const [enabled, setEnabled] = useState(settings.enabled || !settings.recipient_email);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (input: { recipient_email: string | null; enabled: boolean }) =>
      saveNotificationSettings(accessToken, tenant.id, input),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const clean = email.trim();
    if (clean && !emailPattern.test(clean)) {
      setError('Cette adresse e-mail ne semble pas valide (exemple : patron@boutique.com).');
      return;
    }
    try {
      const next = await mutation.mutateAsync({ recipient_email: clean || null, enabled: clean ? enabled : false });
      onSaved(next);
    } catch (caught) {
      setError(errorMessage(caught, 'L’adresse d’alerte n’a pas pu être enregistrée.'));
    }
  };

  return (
    <form onSubmit={(event) => { void submit(event); }} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="min-w-0">
        <Label htmlFor="notify-email">Adresse e-mail à prévenir</Label>
        <Input
          id="notify-email"
          className="mt-1"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="patron@boutique.com"
          value={email}
          disabled={!canManage || mutation.isPending}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={enabled && Boolean(email.trim())}
            disabled={!canManage || mutation.isPending || !email.trim()}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Prévenir à chaque nouvelle commande
        </label>
      </div>
      {canManage ? (
        <Button type="submit" variant="mint" loading={mutation.isPending}>
          Enregistrer l’alerte
        </Button>
      ) : null}
      {error ? <Alert tone="error" className="sm:col-span-2">{error}</Alert> : null}
    </form>
  );
}

function NotificationRow({ notification, timezone }: { notification: OrderNotification; timezone: string }) {
  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{notification.subject}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(notification.created_at, timezone)} · {notification.recipient_email}
          </p>
          {notification.status === 'failed' && notification.last_error ? (
            <p className="mt-1 text-xs text-red-600">{notification.last_error}</p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${notificationStatusTones[notification.status]}`}>
          {notificationStatusLabels[notification.status]}
        </span>
      </div>
    </li>
  );
}

export function OrderNotificationsCard({ canManage }: { canManage: boolean }) {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['storefront', 'notifications', tenant.id],
    queryFn: () => getNotificationSettings(accessToken, tenant.id),
    retry: 1,
  });
  const historyQuery = useQuery({
    queryKey: ['storefront', 'notifications', 'history', tenant.id],
    queryFn: () => listOrderNotifications(accessToken, tenant.id),
    retry: 1,
  });

  const settings = settingsQuery.data;
  const history = historyQuery.data ?? [];

  return (
    <section className={`${cardClass} mt-6`}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <BellRing className="size-5 text-mint-dark" aria-hidden="true" />
        Alertes e-mail des commandes
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
        Recevez un e-mail dès qu’un client envoie une commande, pour ne rien laisser passer. L’envoi est gratuit
        (300 e-mails par jour) et ne demande aucune carte bancaire.
      </p>

      {!canManage ? (
        <Alert tone="info" className="mt-4">
          Adresse modifiable uniquement par un administrateur (droit « gérer la boutique »).
        </Alert>
      ) : null}

      {settingsQuery.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Chargement des réglages…
        </div>
      ) : settingsQuery.isError ? (
        canManage ? (
          <Alert tone="error" className="mt-4">
            {errorMessage(settingsQuery.error, 'Les réglages d’alerte n’ont pas pu être chargés.')}
          </Alert>
        ) : null
      ) : settings ? (
        <>
          <NotificationForm
            key={`${settings.recipient_email ?? ''}|${settings.enabled}`}
            settings={settings}
            canManage={canManage}
            onSaved={(next) => {
              queryClient.setQueryData(['storefront', 'notifications', tenant.id], next);
              void queryClient.invalidateQueries({ queryKey: ['storefront', 'notifications', 'history', tenant.id] });
            }}
          />

          {settings.recipient_email && !settings.provider_ready ? (
            <Alert tone="info" className="mt-4">
              L’envoi automatique n’est pas encore activé sur le serveur (clé e-mail manquante). Les alertes sont
              enregistrées et partiront dès l’activation — voir <code>docs/EMAIL-COMMANDES.md</code>.
            </Alert>
          ) : null}

          {settings.recipient_email && settings.provider_ready ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Mail className="size-3.5" aria-hidden="true" />
              Envoi actif : chaque commande part vers {settings.recipient_email}.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-bold text-ink">Dernières alertes</h3>
        {historyQuery.isLoading ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Chargement…
          </div>
        ) : historyQuery.isError ? (
          <p className="mt-2 text-sm text-slate-500">Historique indisponible pour le moment.</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucune alerte pour le moment. Elle se crée automatiquement à la première commande.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {history.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} timezone={tenant.timezone} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
