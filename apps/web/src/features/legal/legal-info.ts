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
  city: 'Niamey',
  country: 'Niger',
  /** Contact public : WhatsApp d'abord, c'est le canal utilisé par les commerçants. */
  phone: '+227 99 57 35 80',
  whatsappUrl: 'https://wa.me/22799573580',
  /** Renseignez cette adresse pour afficher aussi un contact e-mail. */
  email: '',
  /** Date de dernière mise à jour des documents légaux. */
  updatedAt: '4 novembre 2026',
  tagline: 'Gestion de stock, ventes et boutique en ligne pour les commerçants.',
  siteUrl: 'https://euphonious-platypus-d21181.netlify.app',
} as const;

export const legalLinks = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/conditions', label: 'Conditions générales' },
] as const;
