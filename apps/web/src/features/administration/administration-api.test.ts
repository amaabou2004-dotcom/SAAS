import { readPlatformOverview } from './administration-api';

describe('lecture de la vue d’ensemble', () => {
  it('convertit une réponse complète', () => {
    const result = readPlatformOverview({
      totals: { users: 12, confirmed: 9, tenants: 3, admins: 1, sales: 24 },
      users: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'amaabou2004@gmail.com',
          full_name: 'Amadou Aboubakar',
          created_at: '2026-11-01T09:00:00.000Z',
          email_confirmed_at: '2026-11-01T09:05:00.000Z',
          last_sign_in_at: null,
          is_admin: true,
          companies: [{ name: 'Boutique Aïcha', role: 'Propriétaire', status: 'active' }],
        },
      ],
      tenants: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Boutique Aïcha',
          slug: 'boutique-aicha',
          status: 'active',
          currency_code: 'XOF',
          created_at: '2026-11-01T10:00:00.000Z',
          members: 2,
          products: 15,
          sales: 24,
          revenue: '145000.0000',
          first_member_email: 'amaabou2004@gmail.com',
        },
      ],
    });

    expect(result.totals).toEqual({ users: 12, confirmed: 9, tenants: 3, admins: 1, sales: 24 });
    expect(result.users[0]!.isAdmin).toBe(true);
    expect(result.users[0]!.fullName).toBe('Amadou Aboubakar');
    expect(result.users[0]!.companies[0]!.name).toBe('Boutique Aïcha');
    expect(result.tenants[0]!.revenue).toBe(145000);
    expect(result.tenants[0]!.currencyCode).toBe('XOF');
  });

  it('ne casse pas sur une réponse vide ou inattendue', () => {
    const result = readPlatformOverview(null);

    expect(result.totals).toEqual({ users: 0, confirmed: 0, tenants: 0, admins: 0, sales: 0 });
    expect(result.users).toEqual([]);
    expect(result.tenants).toEqual([]);
  });

  it('ignore les valeurs négatives et remplace les libellés manquants', () => {
    const result = readPlatformOverview({
      totals: { users: -4, confirmed: 'n/a', tenants: '2', admins: 0, sales: 1.7 },
      users: [{ email: null, is_admin: 'oui', companies: 'aucune' }],
      tenants: [{ name: null, members: -3, revenue: -10 }],
    });

    expect(result.totals.users).toBe(0);
    expect(result.totals.confirmed).toBe(0);
    expect(result.totals.tenants).toBe(2);
    expect(result.users[0]!.email).toBe('');
    expect(result.users[0]!.isAdmin).toBe(false);
    expect(result.users[0]!.companies).toEqual([]);
    expect(result.tenants[0]!.name).toBe('Entreprise');
    expect(result.tenants[0]!.members).toBe(0);
    expect(result.tenants[0]!.revenue).toBe(0);
    expect(result.tenants[0]!.currencyCode).toBe('XOF');
  });
});
