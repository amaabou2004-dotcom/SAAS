import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

/**
 * Compteur de visites maison.
 *
 * Aucun outil tiers, aucun cookie : chaque vue d'une page publique enregistre
 * une ligne anonyme (empreinte qui change chaque jour). La lecture des chiffres
 * est réservée aux administrateurs de la plateforme, côté base.
 */

export interface AudienceCounts {
  views: number;
  visitors: number;
}

export interface AudienceDay extends AudienceCounts {
  /** Jour au format `AAAA-MM-JJ`. */
  day: string;
}

export interface AudiencePath {
  path: string;
  views: number;
}

export interface AudienceSummary {
  days: number;
  firstDay: string | null;
  totals: AudienceCounts;
  today: AudienceCounts;
  yesterday: AudienceCounts;
  daily: AudienceDay[];
  paths: AudiencePath[];
}

function toCount(value: unknown): number {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readCounts(value: unknown): AudienceCounts {
  const record = (value ?? {}) as Record<string, unknown>;
  return { views: toCount(record.views), visitors: toCount(record.visitors) };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Transforme la réponse brute de la base en objet sûr pour l'affichage :
 * aucune valeur manquante ne doit casser l'écran.
 */
export function readAudienceSummary(raw: unknown): AudienceSummary {
  const record = readRecord(raw);

  const daily = Array.isArray(record.daily)
    ? record.daily.map((item) => {
        const day = readRecord(item);
        return { day: toText(day.day), ...readCounts(day) };
      })
    : [];

  const paths = Array.isArray(record.paths)
    ? record.paths.map((item) => {
        const page = readRecord(item);
        return { path: toText(page.path) || '/', views: toCount(page.views) };
      })
    : [];

  const firstDay = typeof record.first_day === 'string' ? record.first_day : null;

  return {
    days: toCount(record.days) || daily.length || 30,
    firstDay,
    totals: readCounts(record.totals),
    today: readCounts(record.today),
    yesterday: readCounts(record.yesterday),
    daily,
    paths,
  };
}

/** Lit les chiffres d'audience. Échoue si l'utilisateur n'est pas administrateur. */
export async function fetchAudienceSummary(days = 30): Promise<AudienceSummary> {
  const response = await getSupabaseClient().rpc('audience_summary', { p_days: days });
  if (response.error) {
    throw new Error('Les chiffres de fréquentation n’ont pas pu être chargés.');
  }
  return readAudienceSummary(response.data as unknown);
}

/** Indique si la personne connectée peut consulter les chiffres de la plateforme. */
export async function checkPlatformAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const response = await getSupabaseClient().rpc('is_platform_admin');
  if (response.error) return false;
  return (response.data as unknown) === true;
}

/** Enregistre une vue. Silencieux : une mesure ne doit jamais gêner la visite. */
export async function trackPageView(path: string, referrerHost?: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const response = await getSupabaseClient().rpc('track_page_view', {
    p_path: path,
    p_referrer: referrerHost ?? null,
  });
  if (response.error) throw new Error('La vue n’a pas pu être enregistrée.');
}
