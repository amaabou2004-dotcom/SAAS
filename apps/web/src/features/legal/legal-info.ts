/**
 * Informations officielles de l'éditeur, réunies en un seul endroit.
 *
 * Elles alimentent les mentions légales, la politique de confidentialité, les
 * conditions générales et le pied de page : une seule modification ici met
 * tout le site à jour, sans risque d'oubli.
 */
export const legalInfo = {
  brand: 'Stokari',
  /** Personne qui édite le service et signe les documents officiels. */
  publisher: 'Amadou Aboubakar',
  publisherRole: 'Éditeur du service et responsable de la publication',
  country: 'Niger',
  /**
   * Pas de ville dans les informations publiques : la signature reste sobre
   * (« Édité par Amadou Aboubakar, Niger »).
   */
  /** Contact public : WhatsApp d'abord, c'est le canal utilisé par les commerçants. */
  phone: '+227 99 57 35 80',
  whatsappUrl: 'https://wa.me/22799573580',
  /** Renseignez cette adresse pour afficher aussi un contact e-mail. */
  email: '',
  /** Date de dernière mise à jour des documents légaux. */
  updatedAt: '5 novembre 2026',
  tagline: 'Gestion de stock, ventes et boutique en ligne pour les commerçants.',
  /**
   * Adresse publique canonique du service.
   *
   * Elle vient de `VITE_APP_URL` (déjà renseignée dans `netlify.toml` et dans
   * les variables Netlify/Vercel) afin qu'un changement de domaine ne demande
   * aucune modification de code. Le repli correspond au domaine officiel :
   * `https://stokari.com`.
   */
  siteUrl: publicSiteUrl(),
} as const;

/**
 * Adresse publique du site, sans barre oblique finale.
 *
 * `VITE_APP_URL` a la priorité ; à défaut on retombe sur le domaine officiel.
 * En développement, la variable vaut `http://localhost:5173`.
 */
export function publicSiteUrl(): string {
  const configured = (import.meta.env.VITE_APP_URL ?? '').trim().replace(/\/+$/, '');
  return configured || 'https://stokari.com';
}

export const legalLinks = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/conditions', label: 'Conditions générales' },
] as const;
