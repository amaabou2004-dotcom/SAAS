import { BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReportQueryDto } from './reports.dto.js';
import { ReportsService } from './reports.service.js';
import type { SupabaseService } from '../auth/supabase.service.js';

const TENANT_ID = '0969579a-c676-4542-b846-d9df6235f6e6';

const summary = {
  from: '2026-11-01',
  to: '2026-11-04',
  timezone: 'Africa/Niamey',
  totals: { sales: 2, revenue: 4800, cost: 2000, margin: 2800, items: 3, average_basket: 2400 },
  today: { sales: 1, revenue: 2400, margin: 1400 },
  daily: [{ day: '2026-11-04', sales: 1, revenue: 2400, margin: 1400 }],
  top_products: [],
  top_categories: [],
  dormant: [],
  stock_value: 6000,
  product_count: 33,
};

function buildService(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(result);
    },
  };
  const supabase = { createUserClient: () => client } as unknown as SupabaseService;
  return { service: new ReportsService(supabase), rpcCalls };
}

describe('ReportsService', () => {
  it('appelle report_summary avec la période demandée', async () => {
    const { service, rpcCalls } = buildService({ data: summary, error: null });

    const report = await service.summary('token', TENANT_ID, '2026-11-01', '2026-11-04');

    expect(rpcCalls[0]).toEqual({
      name: 'report_summary',
      args: { p_tenant_id: TENANT_ID, p_from: '2026-11-01', p_to: '2026-11-04' },
    });
    expect(report.totals.revenue).toBe(4800);
  });

  it('traduit un refus de droit en 403', async () => {
    const { service } = buildService({
      data: null,
      error: { code: '42501', message: 'Vous n’avez pas accès aux rapports de cette entreprise.' },
    });

    await expect(service.summary('token', TENANT_ID, '2026-11-01', '2026-11-04')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('explique une période invalide', async () => {
    const { service } = buildService({
      data: null,
      error: { code: '22023', message: 'La date de début doit précéder la date de fin.' },
    });

    await expect(service.summary('token', TENANT_ID, '2026-11-04', '2026-11-01')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse une réponse vide de la base', async () => {
    const { service } = buildService({ data: null, error: null });
    await expect(service.summary('token', TENANT_ID, '2026-11-01', '2026-11-04')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

describe('ReportQueryDto', () => {
  it('exige deux dates AAAA-MM-JJ', () => {
    expect(validateSync(plainToInstance(ReportQueryDto, { from: '01/11/2026', to: '2026-11-04' }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(ReportQueryDto, { from: '2026-11-01' }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(ReportQueryDto, { from: '2026-11-01', to: '2026-11-04' }))).toHaveLength(0);
  });
});
