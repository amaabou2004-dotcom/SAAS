import { useEffect } from 'react';
import { isSupabaseConfigured } from '../../lib/supabase';
import { trackPageView } from './audience-api';

/** Pages publiques mesurées : accueil, boutiques partagées et documents légaux. */
const legalPaths = ['/mentions-legales', '/confidentialite', '/conditions'];

export function isTrackablePath(path: string): boolean {
  return path === '/' || path.startsWith('/b/') || legalPaths.includes(path);
}

/** Nom d'hôte d'où vient le visiteur (jamais l'adresse complète, jamais nos propres pages). */
function referrerHost(): string | null {
  if (typeof document === 'undefined' || !document.referrer) return null;
  try {
    const host = new URL(document.referrer).hostname;
    if (!host || host === window.location.hostname) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/**
 * Compte une visite de page publique.
 *
 * Volontairement discret : aucune erreur n'est remontée à l'écran, aucun cookie
 * n'est posé, et la base déduplique elle-même (une vue par personne, par page
 * et par jour).
 */
export function usePageViewTracking(path?: string) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const route = path ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
    if (!isTrackablePath(route)) return;

    void trackPageView(route, referrerHost()).catch(() => {
      // Une mesure qui échoue ne doit jamais gêner la visite.
    });
  }, [path]);
}
