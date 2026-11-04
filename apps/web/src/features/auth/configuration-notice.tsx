import { Alert } from '../../components/ui/alert';
import { isSupabaseConfigured } from '../../lib/supabase';

/**
 * Rappel réservé à l'environnement de développement : en production, aucun
 * détail technique n'est affiché au visiteur.
 */
export function ConfigurationNotice() {
  if (isSupabaseConfigured || !import.meta.env.DEV) return null;

  return (
    <Alert tone="warning" className="mb-6">
      <strong className="mb-1 block font-semibold">Mode développement</strong>
      Les services en ligne ne sont pas encore joignables. Cette mention n’apparaît jamais sur le site public.
    </Alert>
  );
}
