import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';

describe('Health endpoint', () => {
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

  it('reports that the API is running', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'saas-commerce-api',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });
});
