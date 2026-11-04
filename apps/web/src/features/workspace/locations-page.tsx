import { friendlyError } from '../../lib/friendly-error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, MapPin, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { EmptyWorkspace, WorkspaceSection } from './workspace-layout';
import { useWorkspace } from './workspace-context';
import { createLocation, listLocations } from './workspace-api';

function errorMessage(error: unknown) {
  return friendlyError(error);
}

export function LocationsPage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const locationsQuery = useQuery({
    queryKey: ['inventory', 'locations', tenant.id],
    queryFn: () => listLocations(accessToken, tenant.id),
  });
  const createMutation = useMutation({
    mutationFn: (input: { name: string; code: string }) => createLocation(accessToken, tenant.id, input),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !code.trim()) return;
    try {
      await createMutation.mutateAsync({ name: name.trim(), code: code.trim().toUpperCase() });
      setName(''); setCode('');
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'locations', tenant.id] });
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  };

  const locations = locationsQuery.data ?? [];
  return (
    <WorkspaceSection title="Dépôts" description="Vos lieux de stockage : boutique, réserve, magasin. Un dépôt principal est créé avec l’entreprise ; ajoutez les autres ici.">
      <div className="grid gap-7 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 font-bold text-ink"><Plus className="size-5 text-mint-dark" aria-hidden="true" />Nouvel emplacement</h2>
          {error ? <Alert tone="error" className="mb-4">{error}</Alert> : null}
          <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
            <div>
              <Label htmlFor="location-name" className="mb-2 block">Nom</Label>
              <input id="location-name" className="min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:border-mint focus:ring-4 focus:ring-teal-100" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="location-code" className="mb-2 block">Code unique</Label>
              <input id="location-code" className="min-h-11 w-full rounded-xl border border-slate-300 px-3.5 font-mono text-sm uppercase outline-none focus:border-mint focus:ring-4 focus:ring-teal-100" value={code} onChange={(event) => setCode(event.target.value)} required maxLength={40} />
              <p className="mt-2 text-xs text-slate-500">Lettres, chiffres, tirets et underscores.</p>
            </div>
            <Button type="submit" variant="mint" className="w-full" loading={createMutation.isPending}>Créer l’emplacement</Button>
          </form>
        </div>
        <div>
          {locationsQuery.isLoading ? <div className="grid min-h-56 place-items-center" role="status"><LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement des emplacements" /></div>
            : locationsQuery.isError ? <Alert tone="error">{errorMessage(locationsQuery.error)} <Button type="button" variant="link" onClick={() => { void locationsQuery.refetch(); }}>Réessayer</Button></Alert>
              : locations.length === 0 ? <EmptyWorkspace icon={MapPin} title="Aucun emplacement" description="Aucun emplacement n’est encore disponible pour cette entreprise." />
                : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {locations.map((location) => (
                      <article key={location.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <MapPin className="size-5 text-mint-dark" aria-hidden="true" />
                        <h2 className="mt-4 font-bold text-ink">{location.name}</h2>
                        <p className="mt-1 font-mono text-sm text-slate-500">{location.code}</p>
                        <span className={`mt-4 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${location.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{location.active ? 'Actif' : 'Désactivé'}</span>
                      </article>
                    ))}
                  </div>
                )}
        </div>
      </div>
    </WorkspaceSection>
  );
}
