import { slugify, tenantFormSchema } from './tenant-form-schema';

describe('tenant form', () => {
  it.each([
    ['Boutique Aminata', 'boutique-aminata'],
    ['  Chez Dédi & Frères  ', 'chez-dedi-freres'],
    ['Supermarché Niamey 2', 'supermarche-niamey-2'],
  ])('creates a safe slug from %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('accepts the default Niger configuration', () => {
    expect(
      tenantFormSchema.safeParse({
        name: 'Boutique Aminata',
        slug: 'boutique-aminata',
        currency_code: 'XOF',
        timezone: 'Africa/Niamey',
      }).success,
    ).toBe(true);
  });

  it('rejects an invalid tenant slug', () => {
    expect(
      tenantFormSchema.safeParse({
        name: 'Boutique',
        slug: 'boutique invalide',
        currency_code: 'XOF',
        timezone: 'Africa/Niamey',
      }).success,
    ).toBe(false);
  });
});
