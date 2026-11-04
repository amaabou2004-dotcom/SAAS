import { describe, expect, it } from 'vitest';
import { receiptWhatsAppText, receiptWhatsAppUrl } from './sales-receipt';
import type { SaleDetail } from './sales-api';

const sale: SaleDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  number: 'V-000007',
  status: 'completed',
  location_id: '33333333-3333-4333-8333-333333333333',
  location_name: 'Boutique',
  payment_method: 'cash',
  payment_reference: null,
  customer_name: 'Fatou',
  note: null,
  subtotal: 4500,
  total: 4500,
  total_cost: 2000,
  margin: 2500,
  item_count: 2,
  created_at: '2026-11-04T10:30:00Z',
  voided_at: null,
  items: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      sale_id: '11111111-1111-4111-8111-111111111111',
      variant_id: '55555555-5555-4555-8555-555555555555',
      product_name: 'Bague argent',
      sku: 'BAG-001',
      unit_price: 2000,
      unit_cost: 1000,
      quantity: 1,
      line_total: 2000,
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      sale_id: '11111111-1111-4111-8111-111111111111',
      variant_id: '77777777-7777-4777-8777-777777777777',
      product_name: 'Collier perles',
      sku: 'COL-001',
      unit_price: 2500,
      unit_cost: 1000,
      quantity: 1,
      line_total: 2500,
    },
  ],
};

describe('reçu WhatsApp', () => {
  it('rédige un reçu lisible avec les articles et le total', () => {
    const text = receiptWhatsAppText(sale, {
      shopName: 'ABCHDD',
      currency: 'XOF',
      timezone: 'Africa/Niamey',
    });

    expect(text).toContain('Reçu V-000007');
    expect(text).toContain('ABCHDD');
    expect(text).toContain('Bague argent');
    expect(text).toContain('Collier perles');
    expect(text).toContain('Total :');
    expect(text).toContain('Paiement : Espèces');
    expect(text).toContain('Merci pour votre confiance !');
    // Aucune donnée interne du serveur ne doit sortir dans le message.
    expect(text).not.toContain('55000');
  });

  it('ouvre WhatsApp sur le numéro du client quand il est connu', () => {
    const url = receiptWhatsAppUrl('Bonjour', '+227 90 00 00 01');
    expect(url.startsWith('https://wa.me/22790000001?text=')).toBe(true);
  });

  it('laisse choisir le contact quand le numéro est absent', () => {
    const url = receiptWhatsAppUrl('Bonjour', null);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
  });
});
