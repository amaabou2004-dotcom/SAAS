import { ConflictException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import type { SupabaseService } from '../auth/supabase.service.js';

const input = {
  category_id: null,
  name: 'Eau minérale',
  description: null,
  sale_price: '500',
  cost_price: '300',
  sku: 'EAU-001',
  barcode: null,
  attributes: {},
};

describe('CatalogService', () => {
  it('creates a product and its variant in the authenticated user context', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { product: { id: 'product' }, variant: { id: 'variant' } }, error: null });
    const createUserClient = vi.fn().mockReturnValue({ rpc });
    const service = new CatalogService({ createUserClient } as unknown as SupabaseService);

    await expect(service.createProduct('user-token', 'tenant-id', input)).resolves.toBeDefined();
    expect(createUserClient).toHaveBeenCalledWith('user-token');
    expect(rpc).toHaveBeenCalledWith('upsert_product', {
      p_tenant_id: 'tenant-id',
      p_product_id: null,
      p_variant_id: null,
      p_category_id: null,
      p_name: 'Eau minérale',
      p_description: null,
      p_sale_price: '500',
      p_cost_price: '300',
      p_sku: 'EAU-001',
      p_barcode: null,
      p_attributes: {},
      p_active: true,
    });
  });

  it('combines products with their own variants', async () => {
    const productQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'product-1', tenant_id: 'tenant-id', name: 'Eau', variants: undefined }],
        error: null,
      }),
    };
    const variantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'variant-1', product_id: 'product-1', sku: 'EAU-001' },
          { id: 'variant-2', product_id: 'product-2', sku: 'AUTRE-001' },
        ],
        error: null,
      }),
    };
    const client = {
      from: vi.fn((table: string) => table === 'products' ? productQuery : variantQuery),
    };
    const service = new CatalogService({
      createUserClient: () => client,
    } as unknown as SupabaseService);

    const products = await service.listProducts('user-token', 'tenant-id');
    expect(products[0]?.variants.map((variant) => variant.id)).toEqual(['variant-1']);
  });

  it('maps duplicate SKU errors to a conflict without exposing database details', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key internal detail' } });
    const service = new CatalogService({
      createUserClient: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(service.createProduct('user-token', 'tenant-id', input)).rejects.toBeInstanceOf(ConflictException);
  });
});
