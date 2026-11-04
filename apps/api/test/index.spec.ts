import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';

describe('Service index', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('répond sur la racine au lieu d’une 404', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.body).toMatchObject({
      service: 'saas-commerce-api',
      status: 'ok',
      documentation: '/api/docs',
    });
    expect(response.body.endpoints.health).toBe('/api/v1/health');
  });

  it('conserve le préfixe global pour les autres routes', async () => {
    await request(app.getHttpServer()).get('/tenants/me').expect(404);
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
});
