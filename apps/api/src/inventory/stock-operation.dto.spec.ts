import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PostStockOperationDto } from './stock-operation.dto.js';

describe('PostStockOperationDto', () => {
  it('validates nested stock lines and decimal quantities', async () => {
    const dto = plainToInstance(PostStockOperationDto, {
      operation_type: 'receipt',
      reason: 'Réception fournisseur',
      lines: [{
        variant_id: '6c1ee4d1-28f1-4f77-b67e-21ceac76b636',
        location_id: '7c1ee4d1-28f1-4f77-b67e-21ceac76b636',
        quantity_delta: 2.5,
      }],
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.lines[0]?.quantity_delta).toBe('2.5');
  });

  it('rejects unknown operation types, invalid UUIDs and excessive precision', async () => {
    const dto = plainToInstance(PostStockOperationDto, {
      operation_type: 'sale',
      lines: [{
        variant_id: 'not-a-uuid',
        location_id: '7c1ee4d1-28f1-4f77-b67e-21ceac76b636',
        quantity_delta: '1.12345',
      }],
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['operation_type', 'lines']),
    );
  });
});
