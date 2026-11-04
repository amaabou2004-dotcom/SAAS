import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CancelOrderDto, NotificationSettingsDto, PlaceOrderDto, StorefrontSettingsDto } from './storefront.dto.js';

const VARIANT_ID = '33333333-3333-4333-8333-333333333333';
const LOCATION_ID = '44444444-4444-4444-8444-444444444444';

type ValidationError = ReturnType<typeof validateSync>[number];

function messages<T extends object>(type: new () => T, payload: Record<string, unknown>) {
  const errors = validateSync(plainToInstance(type, payload), { whitelist: true });
  const flatten = (list: ValidationError[]): string[] =>
    list.flatMap((error) => [...Object.values(error.constraints ?? {}), ...flatten(error.children ?? [])]);
  return flatten(errors);
}

const validOrder = {
  customer_name: 'Aïcha',
  customer_phone: '+22790000001',
  items: [{ variant_id: VARIANT_ID, quantity: 2 }],
};

describe('PlaceOrderDto', () => {
  it('accepte une commande minimale et convertit la quantité texte', () => {
    const dto = plainToInstance(PlaceOrderDto, {
      ...validOrder,
      customer_name: '  Aïcha  ',
      items: [{ variant_id: VARIANT_ID, quantity: '2' }],
    });

    expect(validateSync(dto, { whitelist: true })).toHaveLength(0);
    expect(dto.customer_name).toBe('Aïcha');
    expect(dto.items[0]?.quantity).toBe(2);
  });

  it('refuse un panier vide, une quantité nulle et un téléphone invalide', () => {
    expect(messages(PlaceOrderDto, { ...validOrder, items: [] }).join(' ')).toMatch(/items/);
    expect(
      messages(PlaceOrderDto, { ...validOrder, items: [{ variant_id: VARIANT_ID, quantity: 0 }] }).join(' '),
    ).toMatch(/quantity/);
    expect(messages(PlaceOrderDto, { ...validOrder, customer_phone: 'abc' }).join(' ')).toMatch(
      /numéro de téléphone valide/,
    );
  });
});

describe('StorefrontSettingsDto', () => {
  it('accepte une adresse valide et un numéro WhatsApp vide', () => {
    expect(
      validateSync(
        plainToInstance(StorefrontSettingsDto, {
          slug: 'boutique-test',
          display_name: 'Chez Aïcha',
          published: true,
          default_location_id: LOCATION_ID,
        }),
        { whitelist: true },
      ),
    ).toHaveLength(0);
  });

  it('refuse une adresse avec majuscules ou un emplacement non UUID', () => {
    expect(messages(StorefrontSettingsDto, { slug: 'Boutique', published: true }).join(' ')).toMatch(
      /Adresse de boutique invalide/,
    );
    expect(
      messages(StorefrontSettingsDto, { slug: 'boutique-test', published: true, default_location_id: 'x' }).join(' '),
    ).toMatch(/default_location_id/);
  });
});

describe('CancelOrderDto', () => {
  it('exige un motif de 2 caractères minimum', () => {
    expect(messages(CancelOrderDto, { reason: 'a' }).join(' ')).toMatch(/reason/);
    expect(validateSync(plainToInstance(CancelOrderDto, { reason: 'Client injoignable' }))).toHaveLength(0);
  });
});

describe('NotificationSettingsDto', () => {
  it('accepte une adresse valide et normalise les espaces', () => {
    const dto = plainToInstance(NotificationSettingsDto, { recipient_email: '  Patron@Boutique.com  ', enabled: true });
    expect(validateSync(dto, { whitelist: true })).toHaveLength(0);
    expect(dto.recipient_email).toBe('Patron@Boutique.com');
  });

  it('accepte l’effacement (null) et refuse une adresse invalide', () => {
    expect(validateSync(plainToInstance(NotificationSettingsDto, { recipient_email: null, enabled: false }))).toHaveLength(0);
    expect(messages(NotificationSettingsDto, { recipient_email: 'pas-une-adresse', enabled: true })).toContain(
      'Adresse e-mail invalide.',
    );
  });

  it('exige l’interrupteur d’activation', () => {
    expect(messages(NotificationSettingsDto, { recipient_email: 'patron@boutique.com' })).toContain(
      'enabled must be a boolean value',
    );
  });
});
