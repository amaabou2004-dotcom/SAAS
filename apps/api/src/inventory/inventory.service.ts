import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service.js';
import { toDatabaseHttpException, type DatabaseError } from '../database/database-error.js';
import type { CreateLocationDto, UpdateLocationDto } from './location.dto.js';
import type { PostStockOperationDto } from './stock-operation.dto.js';

export interface LocationRecord {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockOverviewRecord {
  tenant_id: string;
  variant_id: string;
  location_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  location_name: string;
  location_code: string;
  on_hand: number;
  reserved: number;
  available: number;
  updated_at: string;
}

export interface StockMovementRecord {
  id: string;
  tenant_id: string;
  operation_id: string;
  operation_type: string;
  operation_status: string;
  actor_user_id: string;
  reason: string | null;
  reference: string | null;
  reverses_operation_id: string | null;
  variant_id: string;
  location_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  location_name: string;
  location_code: string;
  quantity_delta: number;
  on_hand_after: number;
  reserved_after: number;
  created_at: string;
}

const locationColumns = 'id, tenant_id, name, code, active, created_at, updated_at';
const stockColumns = 'tenant_id, variant_id, location_id, product_id, product_name, sku, location_name, location_code, on_hand, reserved, available, updated_at';
const movementColumns = 'id, tenant_id, operation_id, operation_type, operation_status, actor_user_id, reason, reference, reverses_operation_id, variant_id, location_id, product_id, product_name, sku, location_name, location_code, quantity_delta, on_hand_after, reserved_after, created_at';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private fail(error: DatabaseError, fallback: string): never {
    const exception = toDatabaseHttpException(error, fallback);
    if (exception.getStatus() >= 500) {
      this.logger.error(`Inventory operation failed with database code ${error.code ?? 'unknown'}`);
    }
    throw exception;
  }

  private idempotencyKey(value: string | undefined) {
    if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/.test(value)) {
      throw new BadRequestException('Un en-tête Idempotency-Key valide de 8 à 100 caractères est requis.');
    }
    return value;
  }

  async listLocations(accessToken: string, tenantId: string): Promise<LocationRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken)
      .from('stock_locations')
      .select(locationColumns)
      .eq('tenant_id', tenantId)
      .order('name');
    if (error) this.fail(error, 'Le chargement des emplacements a échoué.');
    const payload: unknown = data;
    if (!Array.isArray(payload)) throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    return payload as LocationRecord[];
  }

  async createLocation(accessToken: string, tenantId: string, input: CreateLocationDto) {
    return this.saveLocation(accessToken, tenantId, null, input, true);
  }

  async updateLocation(accessToken: string, tenantId: string, locationId: string, input: UpdateLocationDto) {
    return this.saveLocation(accessToken, tenantId, locationId, input, input.active);
  }

  private async saveLocation(
    accessToken: string,
    tenantId: string,
    locationId: string | null,
    input: CreateLocationDto,
    active: boolean,
  ): Promise<LocationRecord> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('upsert_stock_location', {
      p_tenant_id: tenantId,
      p_location_id: locationId,
      p_name: input.name,
      p_code: input.code,
      p_active: active,
    });
    if (error) this.fail(error, 'L’enregistrement de l’emplacement a échoué.');
    const payload: unknown = data;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return payload as LocationRecord;
  }

  async listStock(accessToken: string, tenantId: string): Promise<StockOverviewRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken)
      .from('stock_overview')
      .select(stockColumns)
      .eq('tenant_id', tenantId)
      .order('product_name')
      .order('location_code');
    if (error) this.fail(error, 'Le chargement du stock a échoué.');
    const payload: unknown = data;
    if (!Array.isArray(payload)) throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    return payload as StockOverviewRecord[];
  }

  async listMovements(accessToken: string, tenantId: string): Promise<StockMovementRecord[]> {
    const { data, error } = await this.supabase.createUserClient(accessToken)
      .from('stock_movement_history')
      .select(movementColumns)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) this.fail(error, 'Le chargement des mouvements a échoué.');
    const payload: unknown = data;
    if (!Array.isArray(payload)) throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    return payload as StockMovementRecord[];
  }

  async postOperation(
    accessToken: string,
    tenantId: string,
    input: PostStockOperationDto,
    idempotencyKey: string | undefined,
  ) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('post_stock_operation', {
      p_tenant_id: tenantId,
      p_operation_type: input.operation_type,
      p_idempotency_key: this.idempotencyKey(idempotencyKey),
      p_reason: input.reason ?? null,
      p_reference: input.reference ?? null,
      p_lines: input.lines,
      p_reverses_operation_id: null,
    });
    if (error) this.fail(error, 'L’enregistrement du mouvement de stock a échoué.');
    return this.operationId(data);
  }

  async reverseOperation(
    accessToken: string,
    tenantId: string,
    operationId: string,
    reason: string,
    idempotencyKey: string | undefined,
  ) {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('post_stock_operation', {
      p_tenant_id: tenantId,
      p_operation_type: 'reversal',
      p_idempotency_key: this.idempotencyKey(idempotencyKey),
      p_reason: reason,
      p_reference: null,
      p_lines: [],
      p_reverses_operation_id: operationId,
    });
    if (error) this.fail(error, 'La contre-passation du mouvement a échoué.');
    return this.operationId(data);
  }

  private operationId(data: unknown) {
    if (typeof data !== 'string') {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return { id: data };
  }
}
