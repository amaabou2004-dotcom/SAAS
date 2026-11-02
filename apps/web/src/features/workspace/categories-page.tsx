import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, LoaderCircle, Plus, RotateCcw, Tags } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { EmptyWorkspace, WorkspaceSection } from './workspace-layout';
import { useWorkspace } from './workspace-context';
import { createCategory, listCategories, setCategoryActive, type Category } from './workspace-api';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

export function CategoriesPage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const categoriesQuery = useQuery({
    queryKey: ['catalog', 'categories', tenant.id],
    queryFn: () => listCategories(accessToken, tenant.id),
  });
  const createMutation = useMutation({
    mutationFn: (value: string) => createCategory(accessToken, tenant.id, value),
  });
  const activeMutation = useMutation({
    mutationFn: ({ category, active }: { category: Category; active: boolean }) => setCategoryActive(accessToken, tenant.id, category, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'categories', tenant.id] }),
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return;
    try {
      await createMutation.mutateAsync(name.trim());
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'categories', tenant.id] });
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    }
  };

  const categories = categoriesQuery.data ?? [];
  return (
    <WorkspaceSection title="Catégories" description="Organisez le catalogue sans jamais mélanger les catégories de deux entreprises. Une catégorie peut être désactivée sans effacer son historique.">
      <div className="grid gap-7 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 font-bold text-ink"><Plus className="size-5 text-mint-dark" aria-hidden="true" />Nouvelle catégorie</h2>
          {error ? <Alert tone="error" className="mb-4">{error}</Alert> : null}
          <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
            <div>
              <Label htmlFor="category-name" className="mb-2 block">Nom</Label>
              <input id="category-name" className="min-h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:border-mint focus:ring-4 focus:ring-teal-100" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
            </div>
            <Button type="submit" variant="mint" className="w-full" loading={createMutation.isPending}>Créer la catégorie</Button>
          </form>
        </div>
        <div>
          {categoriesQuery.isLoading ? <div className="grid min-h-56 place-items-center" role="status"><LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement des catégories" /></div>
            : categoriesQuery.isError ? <Alert tone="error">{errorMessage(categoriesQuery.error)} <Button type="button" variant="link" onClick={() => { void categoriesQuery.refetch(); }}>Réessayer</Button></Alert>
              : categories.length === 0 ? <EmptyWorkspace icon={Tags} title="Aucune catégorie" description="Créez une catégorie pour classer vos produits. Cette liste ne contient aucune donnée de démonstration." />
                : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-0 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Tags className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                          <span className={`truncate font-semibold ${category.active ? 'text-ink' : 'text-slate-400 line-through'}`}>{category.name}</span>
                          {!category.active ? <span className="shrink-0 text-xs text-slate-400">Désactivée</span> : null}
                        </div>
                        <Button type="button" variant="ghost" size="sm" loading={activeMutation.isPending && activeMutation.variables?.category.id === category.id} onClick={() => activeMutation.mutate({ category, active: !category.active })}>
                          {category.active ? <Archive className="size-4" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
                          {category.active ? 'Désactiver' : 'Réactiver'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
          {activeMutation.isError ? <Alert tone="error" className="mt-4">{errorMessage(activeMutation.error)}</Alert> : null}
        </div>
      </div>
    </WorkspaceSection>
  );
}
