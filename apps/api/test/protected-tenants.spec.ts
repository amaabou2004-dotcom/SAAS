import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { SupabaseService } from '../src/auth/supabase.service.js';

describe('Protected tenant endpoint', () => {
  let app: INestApplication;
  const verifyAccessToken = vi.fn().mockResolvedValue({
    id: 'user-id',
    email_confirmed_at: '2026-11-01T12:00:00Z',
  });
  const order = vi.fn().mockResolvedValue({ data: [], error: null });
  const select = vi.fn().mockReturnValue({ order });
  const from = vi.fn().mockReturnValue({ select });
  const createUserClient = vi.fn().mockReturnValue({ from });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({ verifyAccessToken, createUserClient })
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessToken.mockResolvedValue({
      id: 'user-id',
      email_confirmed_at: '2026-11-01T12:00:00Z',
    });
    order.mockResolvedValue({ data: [], error: null });
    select.mockReturnValue({ order });
    from.mockReturnValue({ select });
    createUserClient.mockReturnValue({ from });
  });

  it('injects the auth guard and lists the authenticated user tenants', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/tenants/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body).toEqual([]);
    expect(verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(createUserClient).toHaveBeenCalledWith('valid-token');
  });
});
