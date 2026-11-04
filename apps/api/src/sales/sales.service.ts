import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service.js';
import { toDatabaseHttpException, type DatabaseError } from '../database/database-error.js';
import type { CreateSaleDto, VoidSaleDto } from './sales.dto.js';

export interface SaleRecord {
  id: string;
  tenant_id: string;
  number: string;
  status: 'completed' | 'voided';
  location_id: string;
  location_name: string;
  payment_method: string;
  payment_reference: string | null;
  customer_name: string | null;
  note: string | null;
  subtotal: number;
  total: number;
  total_cost: number;
  margin: number;
  item_count: number;
  created_at: string;
  voided_at: string | null;
}

export interface SaleItemRecord {
  id: string;
  sale_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  line_total: number;
}

export type SaleDetailRecord = SaleRecord & { items: SaleItemRecord[] };

const saleColumns =
  'id, tenant_id, number, status, location_id, location_name, payment_method, payment_reference, customer_name, note, subtotal, total, total_cost, margin, item_count, created_at, voided_at';
const itemColumns = 'id, sale_id, variant_id, product_name, sku, unit_price, unit_cost, quantity, line_total';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private fail(error: DatabaseError, fallback: string): never {
    const exception = toDatabaseHttpException(error, fallback);
    if (exception.getStatus() >= 500) {
      this.logger.error(`Sale operation failed with database code ${error.code ?? 'unknown'}`);
    }
    throw exception;
  }

  private idempotencyKey(value: string | undefined) {
    if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/.test(value)) {
      throw new BadRequestException('Un en-tête Idempotency-Key valide de 8 à 100 caractères est requis.');
    }
    return value;
  }

  async list(accessToken: string, tenantId: string): Promise<SaleRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken)
      .from('sales_overview')
      .select(saleColumns)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) this.fail(error, 'Le chargement des ventes a échoué.');
    const payload: unknown = data;
    if (!Array.isArray(payload)) throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    return payload as SaleRecord[];
  }

  async get(accessToken: string, tenantId: string, saleId: string): Promise<SaleDetailRecord> {
    return this.readDetail(accessToken, tenantId, saleId);
  }

  async create(
    accessToken: string,
    tenantId: string,
    input: CreateSaleDto,
    idempotencyKey: string | undefined,
  ): Promise<SaleDetailRecord> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('post_sale', {
      p_tenant_id: tenantId,
      p_idempotency_key: this.idempotencyKey(idempotencyKey),
      p_location_id: input.location_id,
      p_payment_method: input.payment_method,
      p_payment_reference: input.payment_reference ?? null,
      p_customer_name: input.customer_name ?? null,
      p_note: input.note ?? null,
      p_items: input.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        ...(item.unit_price === undefined ? {} : { unit_price: item.unit_price }),
      })),
    });
    if (error) this.fail(error, 'L’enregistrement de la vente a échoué.');
    return this.readDetail(accessToken, tenantId, this.saleId(data));
  }

  async void(
    accessToken: string,
    tenantId: string,
    saleId: string,
    input: VoidSaleDto,
    idempotencyKey: string | undefined,
  ): Promise<SaleDetailRecord> {
    const { error } = await this.supabase.createUserClient(accessToken).rpc('void_sale', {
      p_tenant_id: tenantId,
      p_sale_id: saleId,
      p_reason: input.reason,
      p_idempotency_key: this.idempotencyKey(idempotencyKey),
    });
    if (error) this.fail(error, 'L’annulation de la vente a échoué.');
    return this.readDetail(accessToken, tenantId, saleId);
  }

  private async readDetail(accessToken: string, tenantId: string, saleId: string): Promise<SaleDetailRecord> {
    const client = this.supabase.createUserClient(accessToken);
    const [saleRes, itemsRes] = await Promise.all([
      client.from('sales_overview').select(saleColumns).eq('tenant_id', tenantId).eq('id', saleId).maybeSingle(),
      client.from('sale_items').select(itemColumns).eq('tenant_id', tenantId).eq('sale_id', saleId).order('created_at'),
    ]);
    const error = saleRes.error ?? itemsRes.error;
    if (error) this.fail(error, 'Le chargement du ticket a échoué.');
    const sale: unknown = saleRes.data;
    if (!sale || typeof sale !== 'object' || Array.isArray(sale)) {
      throw new InternalServerErrorException('La vente est introuvable après enregistrement.');
    }
    const items: unknown = itemsRes.data;
    return {
      ...(sale as SaleRecord),
      items: Array.isArray(items) ? (items as SaleItemRecord[]) : [],
    };
  }

  private saleId(data: unknown) {
    if (typeof data !== 'string') {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return data;
  }
}
