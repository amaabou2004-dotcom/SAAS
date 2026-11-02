/**
 * Mode d'accès aux données.
 *
 * - `api`    (par défaut) : le front parle à l'API NestJS (`/api/v1`), qui porte
 *   l'autorisation et les règles métier. C'est le mode de production.
 * - `direct` : le front parle directement à Supabase (PostgREST + RPC), avec la
 *   session de l'utilisateur ; la RLS et les fonctions `security definer`
 *   garantissent les mêmes règles. Utile en aperçu / démonstration quand l'API
 *   n'est pas joignable depuis l'hébergement.
 */
export type DataMode = 'api' | 'direct';

export const dataMode: DataMode =
  import.meta.env.VITE_DATA_MODE === 'direct' && import.meta.env.MODE !== 'test' ? 'direct' : 'api';

export const isDirectDataMode = dataMode === 'direct';
