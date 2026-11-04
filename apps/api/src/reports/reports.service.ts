import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service.js';
import { toDatabaseHttpException, type DatabaseError } from '../database/database-error.js';

export interface ReportTotals {
  sales: number;
  revenue: number;
  cost: number;
  margin: number;
  items: number;
  average_basket: number;
}

export interface ReportDay {
  day: string;
  sales: number;
  revenue: number;
  margin: number;
}

export interface ProductPerformance {
  variant_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  revenue: number;
  margin: number;
}

export interface CategoryPerformance {
  category_id: string | null;
  category_name: string;
  quantity: number;
  revenue: number;
  margin: number;
}

export interface DormantProduct {
  variant_id: string;
  product_name: string;
  sku: string;
  on_hand: number;
  stock_value: number;
  last_sold_at: string | null;
}

export interface ReportSummary {
  from: string;
  to: string;
  timezone: string;
  totals: ReportTotals;
  today: { sales: number; revenue: number; margin: number };
  daily: ReportDay[];
  top_products: ProductPerformance[];
  top_categories: CategoryPerformance[];
  dormant: DormantProduct[];
  stock_value: number;
  product_count: number;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  private fail(error: DatabaseError, fallback: string): never {
    const exception = toDatabaseHttpException(error, fallback);
    if (exception.getStatus() >= 500) {
      this.logger.error(`Report failed with database code ${error.code ?? 'unknown'}`);
    }
    throw exception;
  }

  async summary(accessToken: string, tenantId: string, from: string, to: string): Promise<ReportSummary> {
    const { data, error } = await this.supabase.createUserClient(accessToken).rpc('report_summary', {
      p_tenant_id: tenantId,
      p_from: from,
      p_to: to,
    });
    if (error) this.fail(error, 'Le calcul du rapport a échoué.');
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new InternalServerErrorException('La base a retourné une réponse inattendue.');
    }
    return data as ReportSummary;
  }
}
