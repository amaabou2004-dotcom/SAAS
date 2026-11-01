import { Alert } from '../../components/ui/alert';
import { isSupabaseConfigured } from '../../lib/supabase';

export function ConfigurationNotice() {
  if (isSupabaseConfigured) return null;

  return (
    <Alert tone="warning" className="mb-6">
      <strong className="mb-1 block font-semibold">Connexion au service à configurer</strong>
      L’interface est prête. Ajoutez les clés publiques Supabase dans <code>apps/web/.env.local</code> pour activer l’authentification.
    </Alert>
  );
}
