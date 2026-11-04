import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service.js';
import { toDatabaseHttpException, type DatabaseError } from '../database/database-error.js';
import {
  SLUG_PATTERN,
  type CancelOrderDto,
  type ConfirmOrderDto,
  type PlaceOrderDto,
  type StorefrontSettingsDto,
} from './storefront.dto.js';

/**
 * Boutique publique.
 *
 * Les routes `/shop/...` n'exigent aucun compte : elles s'appuient sur des
 * fonctions `security definer` qui ne renvoient que des données publiques.
 * Les routes commerçant passent le jeton de l'utilisateur, la base vérifiant
 * ses droits (`stores.manage`, `sales.read`, `sales.manage`).
 */
@Injectable()
export class StorefrontService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private fail(error: DatabaseError, fallback: string): never {
    throw toDatabaseHttpException(error, fallback);
  }

  private slug(value: string) {
    const slug = value.trim();
    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('Adresse de boutique invalide.');
    }
    return slug;
  }

  private idempotencyKey(value: string | undefined) {
    if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/.test(value)) {
      throw new BadRequestException('Un en-tête Idempotency-Key valide de 8 à 100 caractères est requis.');
    }
    return value;
  }

  async info(slug: string) {
    const { data, error } = await this.supabase.createUserClient().rpc('storefront_info', {
      p_slug: this.slug(slug),
    });
    if (error) this.fail(error, 'La boutique n’a pas pu être chargée.');
    return data ?? null;
  }

  async catalog(slug: string) {
    const { data, error } = await this.supabase.createUserClient().rpc('storefront_catalog', {
      p_slug: this.slug(slug),
    });
    if (error) this.fail(error, 'Le catalogue de la boutique n’a pas pu être chargé.');
    const payload: unknown = data;
    if (!Array.isArray(payload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    const rows: unknown[] = payload;
    return rows;
  }

  async placeOrder(slug: string, input: PlaceOrderDto, idempotencyKey: string | undefined) {
    const { data, error } = await this.supabase.createUserClient().rpc('place_storefront_order', {
      p_slug: this.slug(slug),
      p_idempotency_key: this.idempotencyKey(idempotencyKey),
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_note: input.note ?? null,
      p_items: input.items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
    });
    if (error) this.fail(error, 'La commande n’a pas pu être envoyée.');
    return data;
  }

  async settings(accessToken: string, tenantId: string) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('storefront_settings_get', {
      p_tenant_id: tenantId,
    });
    if (error) this.fail(error, 'La boutique n’a pas pu être chargée.');
    return data ?? null;
  }

  async saveSettings(accessToken: string, tenantId: string, input: StorefrontSettingsDto) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('storefront_settings_save', {
      p_tenant_id: tenantId,
      p_slug: input.slug,
      p_display_name: input.display_name ?? null,
      p_whatsapp: input.whatsapp ?? null,
      p_published: input.published,
      p_default_location_id: input.default_location_id ?? null,
    });
    if (error) this.fail(error, 'La boutique n’a pas pu être enregistrée.');
    return data ?? null;
  }

  async orders(accessToken: string, tenantId: string) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('storefront_orders_list', {
      p_tenant_id: tenantId,
    });
    if (error) this.fail(error, 'Les commandes n’ont pas pu être chargées.');
    const payload: unknown = data;
    if (!Array.isArray(payload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    const rows: unknown[] = payload;
    return rows;
  }

  async confirm(accessToken: string, tenantId: string, orderId: string, input: ConfirmOrderDto) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('storefront_confirm_order', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_location_id: input.location_id ?? null,
    });
    if (error) this.fail(error, 'La commande n’a pas pu être confirmée.');
    return data ?? null;
  }

  async cancel(accessToken: string, tenantId: string, orderId: string, input: CancelOrderDto) {
    const { error } = await this.supabase.createUserClient(accessToken).rpc('storefront_cancel_order', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
      p_reason: input.reason,
    });
    if (error) this.fail(error, 'La commande n’a pas pu être annulée.');
    return { ok: true };
  }

  async markDelivered(accessToken: string, tenantId: string, orderId: string) {
    const { error } = await this.supabase.createUserClient(accessToken).rpc('storefront_mark_delivered', {
      p_tenant_id: tenantId,
      p_order_id: orderId,
    });
    if (error) this.fail(error, 'La livraison n’a pas pu être enregistrée.');
    return { ok: true };
  }
}
