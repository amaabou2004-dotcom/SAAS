import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, LoaderCircle, PackagePlus, Pencil, RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { EmptyWorkspace, WorkspaceSection } from './workspace-layout';
import { useWorkspace } from './workspace-context';
import { formatMoney } from './workspace-format';
import { listCategories, listProducts, saveProduct, setProductActive, type Product, type ProductInput } from './workspace-api';

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

export function ProductsPage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const productsQuery = useQuery({
    queryKey: ['catalog', 'products', tenant.id],
    queryFn: () => listProducts(accessToken, tenant.id),
  });
  const categoriesQuery = useQuery({
    queryKey: ['catalog', 'categories', tenant.id],
    queryFn: () => listCategories(accessToken, tenant.id),
  });
  const saveMutation = useMutation({
    mutationFn: ({ input, existing }: { input: ProductInput; existing: Product | null }) =>
      saveProduct(accessToken, tenant.id, input, existing ?? undefined),
  });
  const activeMutation = useMutation({
    mutationFn: ({ product, active }: { product: Product; active: boolean }) =>
      setProductActive(accessToken, tenant.id, product, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'products', tenant.id] }),
  });

  const resetForm = () => {
    setEditing(null);
    setName(''); setSku(''); setSalePrice(''); setCostPrice(''); setCategoryId(''); setDescription(''); setBarcode('');
    setFormError(null);
  };

  const startEdit = (product: Product) => {
    const variant = product.variants[0];
    setEditing(product);
    setName(product.name);
    setSku(variant?.sku ?? '');
    setSalePrice(String(product.sale_price));
    setCostPrice(String(product.cost_price));
    setCategoryId(product.category_id ?? '');
    setDescription(product.description ?? '');
    setBarcode(variant?.barcode ?? '');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!name.trim() || !sku.trim() || !salePrice || !costPrice) {
      setFormError('Le nom, le SKU, le prix de vente et le prix de revient sont obligatoires.');
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(salePrice) || !/^\d+(\.\d{1,2})?$/.test(costPrice)) {
      setFormError('Les prix doivent être des nombres positifs avec au maximum deux décimales.');
      return;
    }
    const input: ProductInput = {
      category_id: categoryId || null,
      name: name.trim(),
      description: description.trim() || null,
      sale_price: salePrice,
      cost_price: costPrice,
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim() || null,
      attributes: editing?.variants[0]?.attributes ?? {},
    };
    try {
      await saveMutation.mutateAsync({ input, existing: editing });
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'products', tenant.id] });
      resetForm();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const products = productsQuery.data ?? [];
  const categories = (categoriesQuery.data ?? []).filter((category) => category.active || category.id === categoryId);

  return (
    <WorkspaceSection
      title="Catalogue produits"
      description={`Créez vos produits et leurs variantes dans ${tenant.name}. Les produits utilisés par l’historique se désactivent, sans suppression des mouvements.`}
      action={editing ? <Button type="button" variant="outline" onClick={resetForm}>Nouveau produit</Button> : null}
    >
      <div className="grid gap-7 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <PackagePlus className="size-5 text-mint-dark" aria-hidden="true" />
            <h2 className="font-bold text-ink">{editing ? 'Modifier le produit' : 'Nouveau produit'}</h2>
          </div>
          {formError ? <Alert tone="error" className="mb-5">{formError}</Alert> : null}
          <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
            <div>
              <Label htmlFor="product-name" className="mb-2 block">Nom du produit</Label>
              <input id="product-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="product-sku" className="mb-2 block">SKU de la variante</Label>
                <input id="product-sku" className={inputClass} value={sku} onChange={(event) => setSku(event.target.value)} required maxLength={80} autoCapitalize="characters" />
              </div>
              <div>
                <Label htmlFor="product-barcode" className="mb-2 block">Code-barres <span className="font-normal text-slate-400">(optionnel)</span></Label>
                <input id="product-barcode" className={inputClass} value={barcode} onChange={(event) => setBarcode(event.target.value)} maxLength={80} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="sale-price" className="mb-2 block">Prix de vente ({tenant.currency_code})</Label>
                <input id="sale-price" type="number" min="0" step="0.01" className={inputClass} value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required />
              </div>
              <div>
                <Label htmlFor="cost-price" className="mb-2 block">Prix de revient ({tenant.currency_code})</Label>
                <input id="cost-price" type="number" min="0" step="0.01" className={inputClass} value={costPrice} onChange={(event) => setCostPrice(event.target.value)} required />
              </div>
            </div>
            <div>
              <Label htmlFor="product-category" className="mb-2 block">Catégorie <span className="font-normal text-slate-400">(optionnelle)</span></Label>
              <select id="product-category" className={inputClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Sans catégorie</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="product-description" className="mb-2 block">Description <span className="font-normal text-slate-400">(optionnelle)</span></Label>
              <textarea id="product-description" className={`${inputClass} min-h-24 py-3`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
            </div>
            <Button type="submit" variant="mint" className="w-full" loading={saveMutation.isPending}>
              {editing ? 'Enregistrer les modifications' : 'Créer le produit'}
            </Button>
          </form>
        </div>

        <div className="min-w-0">
          {productsQuery.isLoading ? (
            <div className="grid min-h-64 place-items-center" role="status"><LoaderCircle className="size-7 animate-spin text-mint" aria-label="Chargement des produits" /></div>
          ) : productsQuery.isError ? (
            <Alert tone="error">{errorMessage(productsQuery.error)} <Button type="button" variant="link" onClick={() => { void productsQuery.refetch(); }}>Réessayer</Button></Alert>
          ) : products.length === 0 ? (
            <EmptyWorkspace title="Aucun produit pour le moment" description="Votre catalogue est vide. Utilisez le formulaire pour enregistrer un produit réel ; aucun article de démonstration n’est ajouté." />
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-ink">{product.name}</h2>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${product.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{product.active ? 'Actif' : 'Désactivé'}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{product.category?.name ?? 'Sans catégorie'}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(product)} aria-label={`Modifier ${product.name}`}><Pencil className="size-4" aria-hidden="true" /></Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={activeMutation.isPending && activeMutation.variables?.product.id === product.id}
                        onClick={() => activeMutation.mutate({ product, active: !product.active })}
                        aria-label={product.active ? `Désactiver ${product.name}` : `Réactiver ${product.name}`}
                      >
                        {product.active ? <Archive className="size-4" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span className="text-slate-600">Vente : <strong className="text-ink">{formatMoney(product.sale_price, tenant.currency_code)}</strong></span>
                    <span className="text-slate-600">Revient : <strong className="text-ink">{formatMoney(product.cost_price, tenant.currency_code)}</strong></span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.variants.map((variant) => <span key={variant.id} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{variant.sku}{variant.barcode ? ` · ${variant.barcode}` : ''}</span>)}
                  </div>
                </article>
              ))}
            </div>
          )}
          {activeMutation.isError ? <Alert tone="error" className="mt-4">{errorMessage(activeMutation.error)}</Alert> : null}
        </div>
      </div>
    </WorkspaceSection>
  );
}
