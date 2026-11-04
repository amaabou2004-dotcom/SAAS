import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SalesService } from './sales.service.js';
import type { SupabaseService } from '../auth/supabase.service.js';

type RpcCall = { name: string; args: Record<string, unknown> };

const TENANT_ID = '0969579a-c676-4542-b846-d9df6235f6e6';
const SALE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VARIANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LOCATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const saleRow = {
  id: SALE_ID,
  tenant_id: TENANT_ID,
  number: 'VTE-000001',
  status: 'completed',
  location_id: LOCATION_ID,
  location_name: 'Boutique',
  payment_method: 'cash',
  payment_reference: null,
  customer_name: null,
  note: null,
  subtotal: 2400,
  total: 2400,
  total_cost: 1000,
  margin: 1400,
  item_count: 1,
  created_at: '2026-11-03T10:00:00Z',
  voided_at: null,
};

const itemRow = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  sale_id: SALE_ID,
  variant_id: VARIANT_ID,
  product_name: 'Eau minérale',
  sku: 'EAU-001',
  unit_price: 1200,
  unit_cost: 500,
  quantity: 2,
  line_total: 2400,
};

function buildService(options: {
  rpcResult?: { data: unknown; error: { code?: string; message?: string } | null };
  sale?: unknown;
  items?: unknown[];
} = {}) {
  const rpcCalls: RpcCall[] = [];
  const client = {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve({ data: options.sale ?? saleRow, error: null }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: options.items ?? [itemRow], error: null }).then(resolve),
      };
      return chain;
    },
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(options.rpcResult ?? { data: SALE_ID, error: null });
    },
  };
  const supabase = { createUserClient: () => client } as unknown as SupabaseService;
  return { service: new SalesService(supabase), rpcCalls };
}

const createInput = {
  location_id: LOCATION_ID,
  payment_method: 'mobile_money' as const,
  payment_reference: 'MM-778899',
  customer_name: 'Aïcha',
  items: [{ variant_id: VARIANT_ID, quantity: 2, unit_price: 1200 }],
};

describe('SalesService', () => {
  it('encaisse via post_sale et renvoie le ticket complet', async () => {
    const { service, rpcCalls } = buildService();

    const sale = await service.create('token', TENANT_ID, createInput, 'vente-cle-0001');

    expect(rpcCalls[0]!.name).toBe('post_sale');
    expect(rpcCalls[0]!.args).toMatchObject({
      p_tenant_id: TENANT_ID,
      p_idempotency_key: 'vente-cle-0001',
      p_location_id: LOCATION_ID,
      p_payment_method: 'mobile_money',
      p_payment_reference: 'MM-778899',
      p_customer_name: 'Aïcha',
      p_items: [{ variant_id: VARIANT_ID, quantity: 2, unit_price: 1200 }],
    });
    expect(sale.number).toBe('VTE-000001');
    expect(sale.items).toHaveLength(1);
  });

  it('refuse une clé d’idempotence absente ou trop courte', async () => {
    const { service, rpcCalls } = buildService();

    await expect(service.create('token', TENANT_ID, createInput, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('token', TENANT_ID, createInput, 'court')).rejects.toBeInstanceOf(BadRequestException);
    expect(rpcCalls).toHaveLength(0);
  });

  it('annule via void_sale avec un motif', async () => {
    const { service, rpcCalls } = buildService();

    await service.void('token', TENANT_ID, SALE_ID, { reason: 'Retour client' }, 'annulation-cle-1');

    expect(rpcCalls[0]!.name).toBe('void_sale');
    expect(rpcCalls[0]!.args).toMatchObject({
      p_tenant_id: TENANT_ID,
      p_sale_id: SALE_ID,
      p_reason: 'Retour client',
      p_idempotency_key: 'annulation-cle-1',
    });
  });

  it('traduit les refus de la base en erreurs HTTP lisibles', async () => {
    const stock = buildService({
      rpcResult: { data: null, error: { code: 'P0001', message: 'Insufficient available stock' } },
    });
    await expect(stock.service.create('token', TENANT_ID, createInput, 'vente-cle-0002')).rejects.toBeInstanceOf(
      ConflictException,
    );

    const permission = buildService({
      rpcResult: { data: null, error: { code: '42501', message: 'Inventory management permission required to void a sale' } },
    });
    await expect(
      permission.service.void('token', TENANT_ID, SALE_ID, { reason: 'Retour client' }, 'annulation-cle-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const reference = buildService({
      rpcResult: { data: null, error: { code: '22023', message: 'A payment reference is required for mobile money' } },
    });
    await expect(reference.service.create('token', TENANT_ID, createInput, 'vente-cle-0003')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
