import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSaleDto, VoidSaleDto } from './sales.dto.js';

const VARIANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LOCATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function errors(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(CreateSaleDto, payload), { whitelist: true });
}

type ValidationError = ReturnType<typeof errors>[number];

function flatten(list: ValidationError[]): string[] {
  return list.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flatten(error.children ?? []),
  ]);
}

function messages(payload: Record<string, unknown>) {
  return flatten(errors(payload));
}

const valid = {
  location_id: LOCATION_ID,
  payment_method: 'cash',
  items: [{ variant_id: VARIANT_ID, quantity: 2, unit_price: 1200 }],
};

describe('CreateSaleDto', () => {
  it('accepte une vente minimale et convertit les quantités texte', () => {
    const dto = plainToInstance(CreateSaleDto, {
      ...valid,
      items: [{ variant_id: VARIANT_ID, quantity: '2.5', unit_price: '1200' }],
    });

    expect(validateSync(dto, { whitelist: true })).toHaveLength(0);
    expect(dto.items[0]?.quantity).toBe(2.5);
    expect(dto.items[0]?.unit_price).toBe(1200);
  });

  it('refuse un panier vide, un moyen de paiement inconnu et une quantité nulle', () => {
    expect(messages({ ...valid, items: [] }).join(' ')).toMatch(/items/);
    expect(messages({ ...valid, payment_method: 'cheque' }).join(' ')).toMatch(/payment_method/);
    expect(messages({ ...valid, items: [{ variant_id: VARIANT_ID, quantity: 0 }] }).join(' ')).toMatch(/quantity/);
    expect(messages({ ...valid, location_id: 'pas-un-uuid' }).join(' ')).toMatch(/location_id/);
  });

  it('nettoie les espaces du nom du client', () => {
    const dto = plainToInstance(CreateSaleDto, { ...valid, customer_name: '  Aïcha  ' });
    expect(dto.customer_name).toBe('Aïcha');
  });
});

describe('VoidSaleDto', () => {
  it('exige un motif entre 2 et 400 caractères', () => {
    expect(validateSync(plainToInstance(VoidSaleDto, { reason: 'x' }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(VoidSaleDto, { reason: 'Erreur de saisie' }))).toHaveLength(0);
  });
});
