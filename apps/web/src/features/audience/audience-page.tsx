import { useQuery } from '@tanstack/react-query';
import { Eye, LoaderCircle, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { friendlyError } from '../../lib/friendly-error';
import { Alert } from '../../components/ui/alert';
import { EmptyWorkspace, WorkspaceSection } from '../workspace/workspace-layout';
import { fetchAudienceSummary, type AudienceSummary } from './audience-api';

const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

const longDayFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

function parseDay(day: string): Date | null {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-mint-dark">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value.toLocaleString('fr-FR')}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function DailyChart({ days }: { days: AudienceSummary['daily'] }) {
  const highest = Math.max(1, ...days.map((day) => day.visitors));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink">Visiteurs par jour</h2>
        <p className="text-xs text-slate-500">Une même personne comptée une fois par jour.</p>
      </div>
      <div className="mt-5 flex h-40 items-end gap-1" role="img" aria-label="Visiteurs par jour">
        {days.map((day) => {
          const date = parseDay(day.day);
          const height = Math.round((day.visitors / highest) * 100);
          return (
            <div
              key={day.day}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${date ? longDayFormat.format(date) : day.day} : ${day.visitors} visiteur(s), ${day.views} page(s) vue(s)`}
            >
              <div
                className={`w-full rounded-t ${day.visitors > 0 ? 'bg-mint' : 'bg-slate-100'}`}
                style={{ height: `${day.visitors > 0 ? Math.max(height, 4) : 2}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>{days[0] && parseDay(days[0].day) ? dayFormat.format(parseDay(days[0].day)!) : ''}</span>
        <span>
          {days.at(-1) && parseDay(days.at(-1)!.day) ? dayFormat.format(parseDay(days.at(-1)!.day)!) : ''}
        </span>
      </div>
    </div>
  );
}

function PathsTable({ paths }: { paths: AudienceSummary['paths'] }) {
  const highest = Math.max(1, ...paths.map((page) => page.views));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-ink">Pages les plus consultées</h2>
      <ul className="mt-4 space-y-3">
        {paths.map((page) => (
          <li key={page.path}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-mono text-[13px] text-slate-700">{page.path}</span>
              <span className="shrink-0 font-semibold text-ink">{page.views.toLocaleString('fr-FR')}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-teal-300"
                style={{ width: `${Math.round((page.views / highest) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Écran « Audience » : réservé aux administrateurs de la plateforme.
 *
 * Les chiffres portent sur toutes les boutiques publiques, pas sur une seule
 * entreprise : c'est la fréquentation du service, pas celle d'un commerçant.
 */
export function AudiencePage() {
  const summaryQuery = useQuery({
    queryKey: ['audience', 30],
    queryFn: () => fetchAudienceSummary(30),
    retry: 0,
  });

  const summary = summaryQuery.data;

  return (
    <WorkspaceSection
      title="Audience"
      description="Combien de personnes visitent les pages publiques de Stokari (accueil, boutiques partagées, pages légales). Comptage anonyme, sans cookie et sans outil tiers."
    >
      {summaryQuery.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white py-16" role="status">
          <LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement des chiffres" />
        </div>
      ) : summaryQuery.isError ? (
        <Alert tone="error">
          {friendlyError(summaryQuery.error, 'Les chiffres de fréquentation n’ont pas pu être chargés.')}
        </Alert>
      ) : summary ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={Users}
              label="Visiteurs aujourd’hui"
              value={summary.today.visitors}
              hint={`Hier : ${summary.yesterday.visitors.toLocaleString('fr-FR')}`}
            />
            <Kpi
              icon={Eye}
              label="Pages vues aujourd’hui"
              value={summary.today.views}
              hint={`Hier : ${summary.yesterday.views.toLocaleString('fr-FR')}`}
            />
            <Kpi
              icon={TrendingUp}
              label={`Visiteurs sur ${summary.days} jours`}
              value={summary.totals.visitors}
              hint="Personnes différentes, jour par jour"
            />
            <Kpi
              icon={Eye}
              label={`Pages vues sur ${summary.days} jours`}
              value={summary.totals.views}
              hint="Accueil, boutiques et pages légales"
            />
          </div>

          {summary.totals.views === 0 ? (
            <EmptyWorkspace
              icon={Eye}
              title="Aucune visite enregistrée pour le moment"
              description="Le comptage démarre à la mise en service du compteur : les visites des pages publiques apparaîtront ici, jour après jour."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <DailyChart days={summary.daily} />
              <PathsTable paths={summary.paths} />
            </div>
          )}

          <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-mint-dark">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1">
              <strong className="text-ink">Ce qui est mesuré.</strong> Les visites des pages
              publiques, une fois par personne, par page et par jour. Aucun cookie n’est posé,
              aucune adresse IP n’est conservée et aucun profil n’est constitué : la base garde
              seulement une empreinte technique qui change chaque jour.
              {summary.firstDay
                ? ` Premier jour enregistré : ${dayFormat.format(parseDay(summary.firstDay) ?? new Date())}.`
                : ''}
            </p>
          </div>
        </div>
      ) : null}
    </WorkspaceSection>
  );
}
