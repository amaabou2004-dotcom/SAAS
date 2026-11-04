import { ConflictException } from '@nestjs/common';
import { TenantsService } from './tenants.service.js';
import type { SupabaseService } from '../auth/supabase.service.js';

const tenant = {
  id: '6c1ee4d1-28f1-4f77-b67e-21ceac76b636',
  name: 'Boutique Aminata',
  slug: 'boutique-aminata',
  currency_code: 'XOF',
  timezone: 'Africa/Niamey',
  status: 'active' as const,
  created_at: '2026-11-01T12:00:00.000Z',
};

const input = {
  name: 'Boutique Aminata',
  slug: 'boutique-aminata',
  currency_code: 'XOF' as const,
  timezone: 'Africa/Niamey' as const,
};

describe('TenantsService', () => {
  it('creates a tenant in the authenticated user context', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: tenant, error: null });
    const createUserClient = vi.fn().mockReturnValue({ rpc });
    const service = new TenantsService({ createUserClient } as unknown as SupabaseService);

    await expect(service.create('user-token', input)).resolves.toEqual(tenant);
    expect(createUserClient).toHaveBeenCalledWith('user-token');
    expect(rpc).toHaveBeenCalledWith('create_tenant', {
      p_name: input.name,
      p_slug: input.slug,
      p_currency_code: input.currency_code,
      p_timezone: input.timezone,
    });
  });

  it('maps a duplicate slug to a conflict', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
    const service = new TenantsService({
      createUserClient: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(service.create('user-token', input)).rejects.toBeInstanceOf(ConflictException);
  });
});
