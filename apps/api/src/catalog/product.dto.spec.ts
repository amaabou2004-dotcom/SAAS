import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './product.dto.js';

describe('CreateProductDto', () => {
  it('normalizes SKU and preserves monetary values as decimal strings', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '  Eau minérale  ',
      sale_price: 500.25,
      cost_price: '300.10',
      sku: '  eau-001 ',
      barcode: '  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Eau minérale');
    expect(dto.sale_price).toBe('500.25');
    expect(dto.cost_price).toBe('300.10');
    expect(dto.sku).toBe('EAU-001');
    expect(dto.barcode).toBeNull();
  });

  it('rejects negative prices and excessive decimal precision', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Produit',
      sale_price: '-1',
      cost_price: '10.12345',
      sku: 'SKU-001',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['sale_price', 'cost_price']),
    );
  });

  it('accepte l’adresse d’une photo et refuse une adresse dangereuse', async () => {
    const base = { name: 'Produit', sale_price: '500', cost_price: '300', sku: 'SKU-001' };

    const withPhoto = plainToInstance(CreateProductDto, {
      ...base,
      image_url: 'https://projet.supabase.co/storage/v1/object/public/product-images/p.jpg',
    });
    expect(await validate(withPhoto)).toHaveLength(0);

    const cleared = plainToInstance(CreateProductDto, { ...base, image_url: '   ' });
    expect(await validate(cleared)).toHaveLength(0);
    expect(cleared.image_url).toBeNull();

    const dangerous = plainToInstance(CreateProductDto, { ...base, image_url: 'javascript:alert(1)' });
    expect((await validate(dangerous)).map((error) => error.property)).toContain('image_url');
  });
});
