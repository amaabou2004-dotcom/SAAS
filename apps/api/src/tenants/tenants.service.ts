import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service.js';
import type { CreateTenantDto } from './create-tenant.dto.js';
import type { TenantRecord } from './tenant-record.js';

const tenantColumns = 'id, name, slug, currency_code, timezone, status, created_at';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async create(accessToken: string, input: CreateTenantDto): Promise<TenantRecord> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('create_tenant', {
      p_name: input.name,
      p_slug: input.slug,
      p_currency_code: input.currency_code,
      p_timezone: input.timezone,
    });

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('Cet identifiant d’espace est déjà utilisé.');
      }
      if (error.code === '42501') {
        throw new ForbiddenException('Votre session ne permet pas de créer cette entreprise.');
      }
      if (error.code === 'P0001' || error.code === '22023' || error.code === '23514') {
        throw new BadRequestException('Les informations de l’entreprise ne sont pas valides.');
      }
      this.logger.error(`Tenant creation failed with database code ${error.code ?? 'unknown'}`);
      throw new InternalServerErrorException('La création de l’entreprise a échoué.');
    }

    const payload: unknown = data;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return payload as TenantRecord;
  }

  async listMine(accessToken: string): Promise<TenantRecord[]> {
    const { data, error } = await this.supabase
      .createUserClient(accessToken)
      .from('tenants')
      .select(tenantColumns)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Tenant listing failed with database code ${error.code ?? 'unknown'}`);
      throw new InternalServerErrorException('Le chargement des entreprises a échoué.');
    }

    const payload: unknown = data;
    if (!Array.isArray(payload)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return payload as TenantRecord[];
  }
}
