import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../auth/supabase.service.js';
import { toDatabaseHttpException } from '../database/database-error.js';
import { StorefrontService } from './storefront.service.js';

type RpcCall = { name: string; args: Record<string, unknown> };

const TENANT_ID = '0969579a-c676-4542-b846-d9df6235f6e6';
const ORDER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const VARIANT_ID = '33333333-3333-4333-8333-333333333333';
const LOCATION_ID = '44444444-4444-4444-8444-444444444444';

function makeService(results: Array<{ data?: unknown; error?: { code?: string; message?: string } | null }> = []) {
  const calls: RpcCall[] = [];
  const queue = [...results];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const next = queue.shift() ?? { data: null, error: null };
      return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
    },
  };
  const supabase = { createUserClient: () => client } as unknown as SupabaseService;
  return { service: new StorefrontService(supabase), calls };
}

describe('StorefrontService — vitrine publique', () => {
  it('lit les informations de la boutique par son adresse', async () => {
    const { service, calls } = makeService([{ data: { display_name: 'Chez Aïcha' } }]);

    const info = await service.info(' boutique-test ');

    expect(calls[0]).toEqual({ name: 'storefront_info', args: { p_slug: 'boutique-test' } });
    expect(info).toEqual({ display_name: 'Chez Aïcha' });
  });

  it('refuse une adresse invalide avant d’appeler la base', async () => {
    const { service, calls } = makeService();
    await expect(service.info('AB')).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });

  it('transmet la commande sans prix et avec la clé d’idempotence', async () => {
    const { service, calls } = makeService([{ data: { id: ORDER_ID, number: 'CMD-000001' } }]);

    await service.placeOrder(
      'boutique-test',
      {
        customer_name: 'Aïcha',
        customer_phone: '+22790000001',
        note: null,
        items: [{ variant_id: VARIANT_ID, quantity: 2 }],
      },
      'cle-commande-0001',
    );

    expect(calls[0]).toEqual({
      name: 'place_storefront_order',
      args: {
        p_slug: 'boutique-test',
        p_idempotency_key: 'cle-commande-0001',
        p_customer_name: 'Aïcha',
        p_customer_phone: '+22790000001',
        p_note: null,
        p_items: [{ variant_id: VARIANT_ID, quantity: 2 }],
      },
    });
  });

  it('exige une clé d’idempotence valide', async () => {
    const { service, calls } = makeService();
    await expect(
      service.placeOrder(
        'boutique-test',
        { customer_name: 'Aïcha', customer_phone: '+22790000001', items: [{ variant_id: VARIANT_ID, quantity: 1 }] },
        'court',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });
});

describe('StorefrontService — côté commerçant', () => {
  it('enregistre les réglages', async () => {
    const { service, calls } = makeService([{ data: { slug: 'boutique-test', published: true } }]);

    await service.saveSettings('token', TENANT_ID, {
      slug: 'boutique-test',
      display_name: 'Chez Aïcha',
      whatsapp: null,
      published: true,
      default_location_id: LOCATION_ID,
    });

    expect(calls[0]).toEqual({
      name: 'storefront_settings_save',
      args: {
        p_tenant_id: TENANT_ID,
        p_slug: 'boutique-test',
        p_display_name: 'Chez Aïcha',
        p_whatsapp: null,
        p_published: true,
        p_default_location_id: LOCATION_ID,
      },
    });
  });

  it('confirme une commande avec l’emplacement fourni', async () => {
    const { service, calls } = makeService([{ data: { status: 'confirmed', sale_number: 'VTE-000011' } }]);

    await service.confirm('token', TENANT_ID, ORDER_ID, { location_id: LOCATION_ID });

    expect(calls[0]).toEqual({
      name: 'storefront_confirm_order',
      args: { p_tenant_id: TENANT_ID, p_order_id: ORDER_ID, p_location_id: LOCATION_ID },
    });
  });

  it('refuse une liste de commandes qui n’est pas un tableau', async () => {
    const { service } = makeService([{ data: { pas: 'un tableau' } }]);
    await expect(service.orders('token', TENANT_ID)).rejects.toThrow(/réponse inattendue/);
  });

  it('gère l’adresse d’alerte e-mail et son historique', async () => {
    const { service, calls } = makeService([
      { data: { recipient_email: 'patron@boutique.com', enabled: true, provider_ready: true } },
      { data: { recipient_email: 'patron@boutique.com', enabled: false, provider_ready: true } },
      { data: [{ id: 'n1', subject: 'Nouvelle commande CMD-000001', status: 'sent' }] },
    ]);

    await service.notificationSettings('token', TENANT_ID);
    expect(calls[0]).toEqual({ name: 'notification_settings_get', args: { p_tenant_id: TENANT_ID } });

    await service.saveNotificationSettings('token', TENANT_ID, { recipient_email: 'patron@boutique.com', enabled: false });
    expect(calls[1]).toEqual({
      name: 'notification_settings_save',
      args: { p_tenant_id: TENANT_ID, p_recipient_email: 'patron@boutique.com', p_enabled: false },
    });

    const history = await service.notificationHistory('token', TENANT_ID);
    expect(calls[2]).toEqual({ name: 'notifications_list', args: { p_tenant_id: TENANT_ID, p_limit: 10 } });
    expect(history).toHaveLength(1);
  });

  it('refuse un historique qui n’est pas une liste', async () => {
    const { service } = makeService([{ data: { pas: 'une liste' } }]);
    await expect(service.notificationHistory('token', TENANT_ID)).rejects.toThrow(/réponse inattendue/);
  });

  it('traduit les erreurs de la base en réponses HTTP françaises', () => {
    const cases: Array<[string, string, unknown]> = [
      ['P0002', 'Boutique introuvable ou fermée.', NotFoundException],
      ['22023', 'Adresse de boutique invalide : 3 à 40 caractères.', BadRequestException],
      ['23505', 'Cette adresse de boutique est déjà prise.', ConflictException],
      ['P0001', 'Stock insuffisant pour un des produits choisis.', ConflictException],
      ['42501', 'Seul un administrateur peut modifier la boutique.', ForbiddenException],
    ];

    for (const [code, message, type] of cases) {
      const exception = toDatabaseHttpException({ code, message }, 'échec');
      expect(exception).toBeInstanceOf(type);
      expect(exception.message).toBe(message);
    }
  });
});
