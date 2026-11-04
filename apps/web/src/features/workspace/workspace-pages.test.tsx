import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { WorkspaceContext } from './workspace-context';
import { ProductsPage } from './products-page';
import { StockPage } from './stock-page';
import { MovementsPage } from './movements-page';
import { uploadProductImage } from './product-image';
import { createCategory, listCategories, listLocations, listMovements, listProducts, listStock, postStockOperation, reverseStockOperation, saveProduct, setCategoryActive, setProductActive, createLocation } from './workspace-api';

vi.mock('./product-image', () => ({
  deleteProductImage: vi.fn(),
  productImagePath: vi.fn(() => null),
  uploadProductImage: vi.fn(),
  validateProductImage: vi.fn(() => null),
}));

vi.mock('./workspace-api', () => ({
  createCategory: vi.fn(),
  createLocation: vi.fn(),
  listCategories: vi.fn(),
  listLocations: vi.fn(),
  listMovements: vi.fn(),
  listProducts: vi.fn(),
  listStock: vi.fn(),
  postStockOperation: vi.fn(),
  reverseStockOperation: vi.fn(),
  saveProduct: vi.fn(),
  setCategoryActive: vi.fn(),
  setProductActive: vi.fn(),
}));

const tenant = {
  id: '4a4d6d39-38cd-4e1f-b1f0-c8d7ef8edbd0',
  name: 'Boutique test',
  slug: 'boutique-test',
  currency_code: 'XOF',
  timezone: 'Africa/Niamey',
  status: 'active' as const,
  created_at: new Date(0).toISOString(),
};
const product = {
  id: '6c1ee4d1-28f1-4f77-b67e-21ceac76b636',
  tenant_id: tenant.id,
  category_id: null,
  name: 'Eau minérale',
  description: null,
  sale_price: 500,
  cost_price: 300,
  active: true,
  image_url: null,
  category: null,
  variants: [{
    id: '7c1ee4d1-28f1-4f77-b67e-21ceac76b636',
    tenant_id: tenant.id,
    product_id: '6c1ee4d1-28f1-4f77-b67e-21ceac76b636',
    sku: 'EAU-001',
    barcode: null,
    attributes: {},
    active: true,
  }],
};
const locations = [
  { id: '8c1ee4d1-28f1-4f77-b67e-21ceac76b636', tenant_id: tenant.id, name: 'Dépôt principal', code: 'PRINCIPAL', active: true },
  { id: '9c1ee4d1-28f1-4f77-b67e-21ceac76b636', tenant_id: tenant.id, name: 'Boutique', code: 'BOUTIQUE', active: true },
];

function renderWithWorkspace(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={{ tenant, accessToken: 'user-token' }}>
        {children}
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listCategories).mockResolvedValue([]);
  vi.mocked(listLocations).mockResolvedValue(locations);
  vi.mocked(listProducts).mockResolvedValue([]);
  vi.mocked(listStock).mockResolvedValue([]);
  vi.mocked(listMovements).mockResolvedValue([]);
  vi.mocked(saveProduct).mockResolvedValue({ sku: 'EAU-001' });
  vi.mocked(setProductActive).mockResolvedValue(undefined);
  vi.mocked(setCategoryActive).mockResolvedValue({} as never);
  vi.mocked(createCategory).mockResolvedValue({} as never);
  vi.mocked(createLocation).mockResolvedValue({} as never);
  vi.mocked(postStockOperation).mockResolvedValue({ id: 'ac1ee4d1-28f1-4f77-b67e-21ceac76b636' });
  vi.mocked(reverseStockOperation).mockResolvedValue({ id: 'bc1ee4d1-28f1-4f77-b67e-21ceac76b636' });
  vi.stubGlobal('crypto', { randomUUID: () => 'cc1ee4d1-28f1-4f77-b67e-21ceac76b636' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Workspace pages', () => {
  it('shows an empty catalogue and creates a real product without demo data', async () => {
    const user = userEvent.setup();
    renderWithWorkspace(<ProductsPage />);
    expect(await screen.findByText('Aucun produit pour le moment')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nom du produit'), 'Eau minérale');
    await user.type(screen.getByLabelText(/Code produit \(SKU\)/), 'eau-001');
    await user.type(screen.getByLabelText(/Prix de vente/), '500');
    await user.type(screen.getByLabelText(/Prix de revient/), '300');
    await user.click(screen.getByRole('button', { name: 'Créer le produit' }));

    await waitFor(() => expect(saveProduct).toHaveBeenCalled());
    expect(vi.mocked(saveProduct).mock.calls[0]?.[0]).toBe('user-token');
    expect(vi.mocked(saveProduct).mock.calls[0]?.[1]).toBe(tenant.id);
    expect(vi.mocked(saveProduct).mock.calls[0]?.[2]).toMatchObject({ name: 'Eau minérale', sku: 'EAU-001', sale_price: '500', cost_price: '300' });
  });

  it('crée un produit avec seulement le nom, le prix et une quantité (SKU automatique)', async () => {
    const user = userEvent.setup();
    vi.mocked(saveProduct).mockClear();
    renderWithWorkspace(<ProductsPage />);
    expect(await screen.findByText('Aucun produit pour le moment')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nom du produit'), 'Savon parfumé');
    await user.type(screen.getByLabelText(/Prix de vente/), '250');
    await user.type(screen.getByLabelText('Quantité en stock'), '12');
    await user.click(screen.getByRole('button', { name: 'Créer le produit' }));

    await waitFor(() => expect(saveProduct).toHaveBeenCalled());
    // Le SKU n'est pas saisi : chaîne vide, la base le fabrique.
    expect(vi.mocked(saveProduct).mock.calls[0]?.[2]).toMatchObject({
      name: 'Savon parfumé',
      sale_price: '250',
      cost_price: '0',
      sku: '',
      initial_quantity: '12',
      location_id: locations[0]!.id,
    });
  });

  it('affiche le stock et la visibilité boutique de chaque produit', async () => {
    vi.mocked(listProducts).mockResolvedValue([product]);
    vi.mocked(listStock).mockResolvedValue([
      {
        tenant_id: tenant.id,
        variant_id: product.variants[0]!.id,
        location_id: locations[0]!.id,
        product_id: product.id,
        product_name: product.name,
        sku: product.variants[0]!.sku,
        location_name: locations[0]!.name,
        location_code: locations[0]!.code,
        on_hand: 7,
        reserved: 0,
        available: 7,
        updated_at: new Date(0).toISOString(),
      },
    ]);
    renderWithWorkspace(<ProductsPage />);

    expect(await screen.findByText('7 en stock')).toBeInTheDocument();
    expect(screen.getByText('visible dans la boutique')).toBeInTheDocument();
  });

  it('envoie la photo choisie dans la galerie avec la fiche produit', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadProductImage).mockClear();
    vi.mocked(saveProduct).mockClear();
    vi.mocked(uploadProductImage).mockResolvedValue({ path: `${tenant.id}/photo.jpg`, url: 'https://exemple.test/photo.jpg' });
    renderWithWorkspace(<ProductsPage />);

    await user.type(await screen.findByLabelText('Nom du produit'), 'Eau minérale');
    await user.type(screen.getByLabelText(/Code produit \(SKU\)/), 'EAU-001');
    await user.type(screen.getByLabelText(/Prix de vente/), '500');
    await user.type(screen.getByLabelText(/Prix de revient/), '300');
    const photo = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/Photo du produit/), photo);
    await user.click(screen.getByRole('button', { name: 'Créer le produit' }));

    await waitFor(() => expect(saveProduct).toHaveBeenCalled());
    expect(uploadProductImage).toHaveBeenCalledWith(tenant.id, photo, expect.any(Function));
    expect(vi.mocked(saveProduct).mock.calls[0]?.[2]).toMatchObject({
      name: 'Eau minérale',
      sku: 'EAU-001',
      image_url: 'https://exemple.test/photo.jpg',
    });
  });

  it('retire la photo d’un produit existant quand on la supprime', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadProductImage).mockClear();
    vi.mocked(saveProduct).mockClear();
    vi.mocked(listProducts).mockResolvedValue([
      { ...product, image_url: 'https://exemple.test/storage/v1/object/public/product-images/photo.jpg' },
    ]);
    renderWithWorkspace(<ProductsPage />);

    await user.click(await screen.findByRole('button', { name: 'Modifier Eau minérale' }));
    await user.click(screen.getByRole('button', { name: 'Retirer' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    await waitFor(() => expect(saveProduct).toHaveBeenCalled());
    expect(uploadProductImage).not.toHaveBeenCalled();
    expect(vi.mocked(saveProduct).mock.calls[0]?.[2]).toMatchObject({ image_url: null });
  });

  it('posts a balanced transfer with a stable idempotency key', async () => {
    const user = userEvent.setup();
    vi.mocked(listProducts).mockResolvedValue([product]);
    renderWithWorkspace(<StockPage />);
    expect(await screen.findByText('Aucun stock enregistré')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Type d’opération'), 'transfer');
    await user.selectOptions(screen.getByLabelText('Produit / variante'), product.variants[0]!.id);
    await user.selectOptions(screen.getByLabelText('Source'), locations[0]!.id);
    await user.selectOptions(screen.getByLabelText('Destination'), locations[1]!.id);
    await user.type(screen.getByLabelText('Quantité (positive)'), '2');
    await user.type(screen.getByLabelText('Motif'), 'Réassort boutique');
    await user.click(screen.getByRole('button', { name: 'Enregistrer l’opération' }));

    await waitFor(() => expect(postStockOperation).toHaveBeenCalled());
    const call = vi.mocked(postStockOperation).mock.calls[0];
    expect(call?.[0]).toBe('user-token');
    expect(call?.[1]).toBe(tenant.id);
    expect(call?.[3]).toBe('cc1ee4d1-28f1-4f77-b67e-21ceac76b636');
    expect(call?.[2]).toMatchObject({
      operation_type: 'transfer',
      lines: [
        { location_id: locations[0]!.id, quantity_delta: '-2' },
        { location_id: locations[1]!.id, quantity_delta: '2' },
      ],
    });
  });

  it('creates a reversal while retaining the original movement in the history', async () => {
    const user = userEvent.setup();
    vi.mocked(listMovements).mockResolvedValue([{
      id: 'dc1ee4d1-28f1-4f77-b67e-21ceac76b636',
      tenant_id: tenant.id,
      operation_id: 'ec1ee4d1-28f1-4f77-b67e-21ceac76b636',
      operation_type: 'receipt',
      operation_status: 'posted',
      actor_user_id: 'fc1ee4d1-28f1-4f77-b67e-21ceac76b636',
      reason: 'Réception fournisseur',
      reference: 'REC-001',
      reverses_operation_id: null,
      variant_id: product.variants[0]!.id,
      location_id: locations[0]!.id,
      product_id: product.id,
      product_name: product.name,
      sku: product.variants[0]!.sku,
      location_name: locations[0]!.name,
      location_code: locations[0]!.code,
      quantity_delta: 2,
      on_hand_after: 2,
      reserved_after: 0,
      created_at: new Date(0).toISOString(),
    }]);
    renderWithWorkspace(<MovementsPage />);
    expect(await screen.findByText(/Réception fournisseur/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Motif de la contre-passation'), 'Erreur de saisie');
    await user.click(screen.getByRole('button', { name: 'Contre-passer' }));

    await waitFor(() => expect(reverseStockOperation).toHaveBeenCalled());
    expect(vi.mocked(reverseStockOperation).mock.calls[0]?.slice(1, 4)).toEqual([
      tenant.id,
      'ec1ee4d1-28f1-4f77-b67e-21ceac76b636',
      'Erreur de saisie',
    ]);
    expect(screen.getByText(/Réception fournisseur/)).toBeInTheDocument();
  });
});
