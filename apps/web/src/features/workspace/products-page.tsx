import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ImagePlus, LoaderCircle, PackagePlus, Pencil, RotateCcw, Store, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { EmptyWorkspace, WorkspaceSection } from './workspace-layout';
import { useWorkspace } from './workspace-context';
import { formatMoney } from './workspace-format';
import { deleteProductImage, productImagePath, uploadProductImage, validateProductImage } from './product-image';
import {
  listCategories,
  listLocations,
  listProducts,
  listStock,
  saveProduct,
  setProductActive,
  type Product,
  type ProductInput,
} from './workspace-api';

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-ink outline-none focus:border-mint focus:ring-4 focus:ring-teal-100';
const moneyPattern = /^\d+(\.\d{1,4})?$/;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

function stockBadge(total: number) {
  if (total <= 0) return { label: 'Rupture de stock', tone: 'bg-amber-50 text-amber-700' };
  return { label: `${total} en stock`, tone: 'bg-emerald-50 text-emerald-700' };
}

export function ProductsPage() {
  const { tenant, accessToken } = useWorkspace();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['catalog', 'products', tenant.id],
    queryFn: () => listProducts(accessToken, tenant.id),
  });
  const categoriesQuery = useQuery({
    queryKey: ['catalog', 'categories', tenant.id],
    queryFn: () => listCategories(accessToken, tenant.id),
  });
  const locationsQuery = useQuery({
    queryKey: ['inventory', 'locations', tenant.id],
    queryFn: () => listLocations(accessToken, tenant.id),
  });
  const stockQuery = useQuery({
    queryKey: ['inventory', 'stock', tenant.id],
    queryFn: () => listStock(accessToken, tenant.id),
  });

  const saveMutation = useMutation({
    mutationFn: ({ input, existing }: { input: ProductInput; existing: Product | null }) =>
      saveProduct(accessToken, tenant.id, input, existing ?? undefined),
  });
  const activeMutation = useMutation({
    mutationFn: ({ product, active }: { product: Product; active: boolean }) => setProductActive(accessToken, tenant.id, product, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'products', tenant.id] }),
  });

  const activeLocations = (locationsQuery.data ?? []).filter((location) => location.active);
  const defaultLocationId = activeLocations[0]?.id ?? '';
  const chosenLocationId = locationId || defaultLocationId;

  /** Stock disponible par variante, tous emplacements confondus. */
  const stockByVariant = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of stockQuery.data ?? []) {
      totals.set(row.variant_id, (totals.get(row.variant_id) ?? 0) + row.available);
    }
    return totals;
  }, [stockQuery.data]);

  const stockForProduct = (product: Product) =>
    product.variants.reduce((total, variant) => total + (stockByVariant.get(variant.id) ?? 0), 0);

  const resetForm = () => {
    setEditing(null);
    setName(''); setSku(''); setSalePrice(''); setCostPrice(''); setInitialQuantity('');
    setCategoryId(''); setDescription(''); setBarcode('');
    setFormError(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setPhotoError(null);
    setPhotoStatus(null);
  };

  const choosePhoto = (file: File | null) => {
    setPhotoError(null);
    if (!file) return;
    const invalid = validateProductImage(file);
    if (invalid) {
      setPhotoError(invalid);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const clearPhoto = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    setPhotoError(null);
    setPhotoStatus(null);
  };

  const startEdit = (product: Product) => {
    const variant = product.variants[0];
    setEditing(product);
    setNotice(null);
    setName(product.name);
    setSku(variant?.sku ?? '');
    setSalePrice(String(product.sale_price));
    setCostPrice(String(product.cost_price));
    setInitialQuantity('');
    setCategoryId(product.category_id ?? '');
    setDescription(product.description ?? '');
    setBarcode(variant?.barcode ?? '');
    setFormError(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setPhotoError(null);
    setPhotoStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    // Seuls le nom et le prix de vente sont obligatoires : tout le reste a une
    // valeur par défaut raisonnable (SKU fabriqué, prix de revient à 0).
    if (name.trim().length < 2) {
      setFormError('Indiquez le nom du produit (2 caractères minimum).');
      return;
    }
    if (!moneyPattern.test(salePrice.trim())) {
      setFormError('Le prix de vente doit être un nombre positif (exemple : 500).');
      return;
    }
    const cost = costPrice.trim();
    if (cost && !moneyPattern.test(cost)) {
      setFormError('Le prix de revient doit être un nombre positif (ou rester vide).');
      return;
    }
    const quantity = initialQuantity.trim();
    if (quantity && !moneyPattern.test(quantity)) {
      setFormError('La quantité doit être un nombre entier (exemple : 12).');
      return;
    }
    const typedSku = sku.trim().toUpperCase();
    if (typedSku && !/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(typedSku)) {
      setFormError('Le code produit (SKU) accepte lettres, chiffres, point, tiret et souligné. Laissez-le vide pour le générer.');
      return;
    }

    const input: ProductInput = {
      category_id: categoryId || null,
      name: name.trim(),
      description: description.trim() || null,
      sale_price: salePrice.trim(),
      cost_price: cost || '0',
      sku: typedSku,
      barcode: barcode.trim() || null,
      attributes: editing?.variants[0]?.attributes ?? {},
      // Sans nouvelle photo, on garde celle de la fiche (sauf si on l’a retirée).
      image_url: removeImage ? null : (editing?.image_url ?? null),
      // Quantité de départ : à la création seulement.
      initial_quantity: editing ? null : (quantity || null),
      location_id: editing ? null : (chosenLocationId || null),
    };
    let uploadedPath: string | null = null;
    setPhotoStatus(null);
    try {
      if (imageFile) {
        const uploaded = await uploadProductImage(tenant.id, imageFile, setPhotoStatus);
        uploadedPath = uploaded.path;
        input.image_url = uploaded.url;
      }
      const saved = await saveMutation.mutateAsync({ input, existing: editing });
      // L’ancienne photo n’est effacée qu’une fois la fiche bien enregistrée.
      const previousPath = productImagePath(editing?.image_url);
      if (previousPath && (uploadedPath || removeImage)) void deleteProductImage(previousPath);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['catalog', 'products', tenant.id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', tenant.id] }),
      ]);
      const generatedSku = saved?.sku ?? typedSku;
      setNotice(
        editing
          ? 'Produit modifié. Les changements sont déjà visibles dans la boutique.'
          : `Produit ajouté${generatedSku ? ` (code ${generatedSku})` : ''} : il est déjà dans votre boutique.`,
      );
      resetForm();
    } catch (error) {
      // Photo envoyée mais fiche refusée : on ne laisse pas de fichier perdu.
      if (uploadedPath) void deleteProductImage(uploadedPath);
      setFormError(errorMessage(error));
    } finally {
      setPhotoStatus(null);
    }
  };

  const displayedImage = imagePreview ?? (removeImage ? null : (editing?.image_url ?? null));
  const products = productsQuery.data ?? [];
  const categories = (categoriesQuery.data ?? []).filter((category) => category.active || category.id === categoryId);

  return (
    <WorkspaceSection
      title="Produits"
      description={`Ajoutez un produit, sa photo et sa quantité : il apparaît aussitôt dans votre boutique en ligne. Un produit désactivé est masqué, sans rien supprimer de l’historique.`}
      action={editing ? <Button type="button" variant="outline" onClick={resetForm}>Nouveau produit</Button> : null}
    >
      <div className="grid gap-7 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <PackagePlus className="size-5 text-mint-dark" aria-hidden="true" />
            <h2 className="font-bold text-ink">{editing ? 'Modifier le produit' : 'Nouveau produit'}</h2>
          </div>
          {formError ? <Alert tone="error" className="mb-5">{formError}</Alert> : null}
          {notice ? <Alert tone="success" className="mb-5">{notice}</Alert> : null}
          <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-semibold text-ink">Photo du produit <span className="font-normal text-slate-400">(facultative)</span></p>
              <div className="flex items-center gap-3">
                {displayedImage ? (
                  <img src={displayedImage} alt="Aperçu de la photo du produit" className="size-20 shrink-0 rounded-lg border border-slate-200 bg-white object-cover" />
                ) : (
                  <span className="grid size-20 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-300">
                    <ImagePlus className="size-7" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs leading-5 text-slate-500">
                    Prenez la photo maintenant ou choisissez-la dans la galerie de votre téléphone. JPEG, PNG ou WebP, 8 Mo maximum.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label
                      htmlFor="product-photo"
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
                    >
                      <ImagePlus className="size-4" aria-hidden="true" />
                      {displayedImage ? 'Changer la photo' : 'Choisir une photo'}
                    </label>
                    {displayedImage ? (
                      <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                        <Trash2 className="size-4" aria-hidden="true" />Retirer
                      </Button>
                    ) : null}
                  </div>
                  <input
                    id="product-photo"
                    type="file"
                    accept="image/*"
                    aria-label="Photo du produit"
                    className="sr-only"
                    onChange={(event) => {
                      choosePhoto(event.target.files?.[0] ?? null);
                      event.target.value = '';
                    }}
                  />
                  {imageFile ? <p className="truncate text-xs text-slate-500">Photo choisie : {imageFile.name}</p> : null}
                  {photoStatus ? <p className="text-xs font-semibold text-mint-dark" role="status">{photoStatus}</p> : null}
                  {photoError ? <p className="text-xs font-semibold text-red-600" role="alert">{photoError}</p> : null}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="product-name" className="mb-2 block">Nom du produit</Label>
              <input id="product-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} placeholder="Eau minérale 1,5 L" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="sale-price" className="mb-2 block">Prix de vente ({tenant.currency_code})</Label>
                <input id="sale-price" type="number" min="0" step="0.01" inputMode="decimal" className={inputClass} value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required placeholder="500" />
              </div>
              <div>
                <Label htmlFor="cost-price" className="mb-2 block">
                  Prix de revient <span className="font-normal text-slate-400">(facultatif)</span>
                </Label>
                <input id="cost-price" type="number" min="0" step="0.01" inputMode="decimal" className={inputClass} value={costPrice} onChange={(event) => setCostPrice(event.target.value)} placeholder="0" />
              </div>
            </div>

            {!editing ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="initial-quantity" className="mb-2 block">Quantité en stock</Label>
                    <input
                      id="initial-quantity"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      className={inputClass}
                      value={initialQuantity}
                      onChange={(event) => setInitialQuantity(event.target.value)}
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="initial-location" className="mb-2 block">Emplacement</Label>
                    <select
                      id="initial-location"
                      className={inputClass}
                      value={chosenLocationId}
                      onChange={(event) => setLocationId(event.target.value)}
                      disabled={activeLocations.length === 0}
                    >
                      {activeLocations.length === 0 ? <option value="">Aucun emplacement</option> : null}
                      {activeLocations.map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Facultatif : la quantité est enregistrée comme stock d’ouverture et apparaît tout de suite dans la boutique.
                  Vous pourrez l’ajuster dans « Stock ».
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="product-sku" className="mb-2 block">
                  Code produit (SKU) <span className="font-normal text-slate-400">(facultatif)</span>
                </Label>
                <input id="product-sku" className={inputClass} value={sku} onChange={(event) => setSku(event.target.value)} maxLength={80} autoCapitalize="characters" placeholder="Automatique" />
                <p className="mt-1 text-xs text-slate-500">Laissez vide : le code est créé automatiquement.</p>
              </div>
              <div>
                <Label htmlFor="product-barcode" className="mb-2 block">Code-barres <span className="font-normal text-slate-400">(facultatif)</span></Label>
                <input id="product-barcode" className={inputClass} value={barcode} onChange={(event) => setBarcode(event.target.value)} maxLength={80} />
              </div>
            </div>

            <div>
              <Label htmlFor="product-category" className="mb-2 block">Catégorie <span className="font-normal text-slate-400">(facultative)</span></Label>
              <select id="product-category" className={inputClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Sans catégorie</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="product-description" className="mb-2 block">Description <span className="font-normal text-slate-400">(facultative)</span></Label>
              <textarea id="product-description" className={`${inputClass} min-h-24 py-3`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Ce que le client doit savoir : taille, couleur, poids…" />
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
            <EmptyWorkspace title="Aucun produit pour le moment" description="Remplissez le formulaire : nom, prix de vente, quantité. Le produit rejoint votre stock et votre boutique immédiatement." />
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const total = stockForProduct(product);
                const stock = stockBadge(total);
                return (
                  <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} loading="lazy" className="size-14 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-cover" />
                        ) : (
                          <span className="grid size-14 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
                            <ImagePlus className="size-5" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-bold text-ink">{product.name}</h2>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${product.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{product.active ? 'Actif' : 'Désactivé'}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{product.category?.name ?? 'Sans catégorie'}</p>
                        </div>
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
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                      <span className="text-slate-600">Vente : <strong className="text-ink">{formatMoney(product.sale_price, tenant.currency_code)}</strong></span>
                      <span className="text-slate-600">Revient : <strong className="text-ink">{formatMoney(product.cost_price, tenant.currency_code)}</strong></span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${stock.tone}`}>{stock.label}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {product.variants.map((variant) => <span key={variant.id} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{variant.sku}{variant.barcode ? ` · ${variant.barcode}` : ''}</span>)}
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Store className="size-3.5" aria-hidden="true" />
                        {product.active
                          ? (total > 0 ? 'visible dans la boutique' : 'affiché en rupture de stock dans la boutique')
                          : 'masqué de la boutique (produit désactivé)'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {activeMutation.isError ? <Alert tone="error" className="mt-4">{errorMessage(activeMutation.error)}</Alert> : null}
        </div>
      </div>
    </WorkspaceSection>
  );
}
