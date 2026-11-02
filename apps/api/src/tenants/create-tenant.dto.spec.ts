import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto.js';

describe('CreateTenantDto', () => {
  it('normalizes the name and slug', async () => {
    const dto = plainToInstance(CreateTenantDto, {
      name: '  Boutique Aminata  ',
      slug: '  BOUTIQUE-AMINATA ',
      currency_code: 'XOF',
      timezone: 'Africa/Niamey',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.name).toBe('Boutique Aminata');
    expect(dto.slug).toBe('boutique-aminata');
  });

  it('rejects invalid slugs and unsupported currencies', async () => {
    const dto = plainToInstance(CreateTenantDto, {
      name: 'Boutique',
      slug: 'slug invalide!',
      currency_code: 'BTC',
      timezone: 'Africa/Niamey',
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['slug', 'currency_code']),
    );
  });
});
