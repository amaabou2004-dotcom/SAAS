import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getShopCatalog, getShopInfo, placeShopOrder, type ShopInfo, type ShopItem } from './storefront-api';
import { PublicShopPage } from './public-shop-page';

vi.mock('./storefront-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storefront-api')>();
  return { ...actual, getShopInfo: vi.fn(), getShopCatalog: vi.fn(), placeShopOrder: vi.fn() };
});

const variantId = '33333333-3333-4333-8333-333333333333';
const productId = '22222222-2222-4222-8222-222222222222';

const shop: ShopInfo = {
  slug: 'boutique-test',
  display_name: 'Chez Aïcha',
  whatsapp: '+22790000001',
  logo_url: null,
  currency_code: 'XOF',
  timezone: 'Africa/Niamey',
  tenant_name: 'Aïcha SARL',
};

const items: ShopItem[] = [
  {
    product_id: productId,
    variant_id: variantId,
    name: 'Eau minérale 1,5 L',
    description: 'Pack de 6 bouteilles',
    sku: 'EAU-001',
    category_name: 'Boissons',
    unit_price: 400,
    available: 12,
    currency_code: 'XOF',
    image_url: 'https://exemple.test/photo-eau.jpg',
  },
  {
    product_id: '77777777-7777-4777-8777-777777777777',
    variant_id: '88888888-8888-4888-8888-888888888888',
    name: 'Savon parfumé',
    description: null,
    sku: 'SAV-001',
    category_name: 'Hygiène',
    unit_price: 250,
    available: 4,
    currency_code: 'XOF',
    image_url: null,
  },
];

function renderShop() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/b/boutique-test']}>
        <Routes>
          <Route path="/b/:slug" element={<PublicShopPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getShopInfo).mockResolvedValue(shop);
  vi.mocked(getShopCatalog).mockResolvedValue(items);
  vi.mocked(placeShopOrder).mockReset();
});

describe('boutique publique', () => {
  it('affiche le logo de la boutique quand il existe', async () => {
    vi.mocked(getShopInfo).mockResolvedValue({
      ...shop,
      logo_url: 'https://exemple.test/storage/v1/object/public/shop-logos/tenant/logo.jpg',
    });

    renderShop();

    const logo = await screen.findByAltText('Logo de Chez Aïcha');
    expect(logo).toHaveAttribute('src', 'https://exemple.test/storage/v1/object/public/shop-logos/tenant/logo.jpg');
  });

  it('affiche un produit en rupture sans permettre de le commander', async () => {
    vi.mocked(getShopCatalog).mockResolvedValue([
      {
        product_id: '99999999-9999-4999-8999-999999999999',
        variant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Riz parfumé 5 kg',
        description: null,
        sku: 'RIZ-001',
        category_name: 'Céréales',
        unit_price: 6000,
        available: 0,
        currency_code: 'XOF',
        image_url: null,
      },
    ]);
    renderShop();

    expect(await screen.findByText('Riz parfumé 5 kg')).toBeInTheDocument();
    expect(screen.getByText('rupture de stock')).toBeInTheDocument();
    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commander' })).not.toBeInTheDocument();
  });


  it('affiche le catalogue et remplit le panier sans compte', async () => {
    renderShop();

    expect(await screen.findByText('Chez Aïcha')).toBeInTheDocument();
    expect(await screen.findByText('Eau minérale 1,5 L')).toBeInTheDocument();
    expect(screen.getByText('Savon parfumé')).toBeInTheDocument();

    // « Commander » ajoute l'article ET ouvre le formulaire : deux gestes suffisent.
    await userEvent.click(screen.getAllByRole('button', { name: 'Commander' })[0]!);
    expect(await screen.findByText('Vos coordonnées')).toBeInTheDocument();
    expect(await screen.findByText('1 article(s)')).toBeInTheDocument();
  });

  it('refuse un téléphone invalide sans envoyer la commande', async () => {
    renderShop();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Commander' }))[0]!);

    await userEvent.type(screen.getByLabelText('Votre nom'), 'Aïcha Diallo');
    await userEvent.type(screen.getByLabelText('Téléphone (WhatsApp)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer la commande/ }));

    expect(await screen.findByText('Indiquez un numéro de téléphone valide (au moins 6 chiffres).')).toBeInTheDocument();
    expect(placeShopOrder).not.toHaveBeenCalled();
  });

  it('envoie la commande avec une clé stable et affiche le numéro', async () => {
    vi.mocked(placeShopOrder).mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      number: 'CMD-000001',
      total: 800,
      item_count: 2,
      status: 'pending',
    });

    renderShop();
    await userEvent.click((await screen.findAllByRole('button', { name: 'Commander' }))[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un Eau minérale 1,5 L' }));

    await userEvent.type(screen.getByLabelText('Votre nom'), 'Aïcha Diallo');
    await userEvent.type(screen.getByLabelText('Téléphone (WhatsApp)'), '+227 90 00 00 01');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer la commande/ }));

    expect(await screen.findByText(/CMD-000001/)).toBeInTheDocument();
    expect(placeShopOrder).toHaveBeenCalledTimes(1);
    const [slug, input, key] = vi.mocked(placeShopOrder).mock.calls[0]!;
    expect(slug).toBe('boutique-test');
    expect(input.items).toStrictEqual([{ variant_id: variantId, quantity: 2 }]);
    expect(input.customer_phone).toBe('+227 90 00 00 01');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('annonce une boutique fermée', async () => {
    vi.mocked(getShopInfo).mockResolvedValue(null);
    renderShop();
    expect(await screen.findByText('Boutique indisponible')).toBeInTheDocument();
  });
});
