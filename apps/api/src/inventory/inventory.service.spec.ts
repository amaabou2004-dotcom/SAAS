import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import type { SupabaseService } from '../auth/supabase.service.js';

const input = {
  operation_type: 'receipt' as const,
  reason: 'Réception fournisseur',
  reference: 'REC-001',
  lines: [{
    variant_id: '6c1ee4d1-28f1-4f77-b67e-21ceac76b636',
    location_id: '7c1ee4d1-28f1-4f77-b67e-21ceac76b636',
    quantity_delta: '2.5',
  }],
};

describe('InventoryService', () => {
  it('posts an operation with its idempotency key and authenticated context', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'operation-id', error: null });
    const createUserClient = vi.fn().mockReturnValue({ rpc });
    const service = new InventoryService({ createUserClient } as unknown as SupabaseService);

    await expect(service.postOperation('user-token', 'tenant-id', input, 'receipt-key-0001'))
      .resolves.toEqual({ id: 'operation-id' });
    expect(createUserClient).toHaveBeenCalledWith('user-token');
    expect(rpc).toHaveBeenCalledWith('post_stock_operation', {
      p_tenant_id: 'tenant-id',
      p_operation_type: 'receipt',
      p_idempotency_key: 'receipt-key-0001',
      p_reason: 'Réception fournisseur',
      p_reference: 'REC-001',
      p_lines: input.lines,
      p_reverses_operation_id: null,
    });
  });

  it('rejects a missing idempotency key before calling the RPC', async () => {
    const rpc = vi.fn();
    const service = new InventoryService({
      createUserClient: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(service.postOperation('user-token', 'tenant-id', input, undefined))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps insufficient stock to a conflict', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Insufficient available stock' },
    });
    const service = new InventoryService({
      createUserClient: () => ({ rpc }),
    } as unknown as SupabaseService);

    await expect(service.postOperation('user-token', 'tenant-id', input, 'receipt-key-0001'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a reversal linked to the original operation', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'reversal-id', error: null });
    const service = new InventoryService({
      createUserClient: () => ({ rpc }),
    } as unknown as SupabaseService);

    await service.reverseOperation('user-token', 'tenant-id', 'operation-id', 'Annulation du transfert', 'reversal-key-0001');
    expect(rpc).toHaveBeenCalledWith('post_stock_operation', {
      p_tenant_id: 'tenant-id',
      p_operation_type: 'reversal',
      p_idempotency_key: 'reversal-key-0001',
      p_reason: 'Annulation du transfert',
      p_reference: null,
      p_lines: [],
      p_reverses_operation_id: 'operation-id',
    });
  });
});
