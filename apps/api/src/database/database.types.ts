interface Table<Row> {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
}

interface View<Row> {
  Row: Row;
  Relationships: [];
}

type CategoryRow = {
  id: string;
  tenant_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type ProductRow = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sale_price: number;
  cost_price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type VariantRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type LocationRow = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type StockBalanceRow = {
  tenant_id: string;
  variant_id: string;
  location_id: string;
  on_hand: number;
  reserved: number;
  updated_at: string;
}

type StockOperationRow = {
  id: string;
  tenant_id: string;
  operation_type: string;
  status: string;
  idempotency_key: string;
  request_fingerprint: string;
  actor_user_id: string;
  reason: string | null;
  reference: string | null;
  reverses_operation_id: string | null;
  created_at: string;
}

type StockMovementRow = {
  id: string;
  tenant_id: string;
  operation_id: string;
  variant_id: string;
  location_id: string;
  quantity_delta: number;
  on_hand_after: number;
  reserved_after: number;
  created_at: string;
}

type StockOverviewRow = StockBalanceRow & {
  product_id: string;
  product_name: string;
  sku: string;
  location_name: string;
  location_code: string;
  available: number;
}

type StockMovementHistoryRow = StockMovementRow & {
  operation_type: string;
  operation_status: string;
  actor_user_id: string;
  reason: string | null;
  reference: string | null;
  reverses_operation_id: string | null;
  product_id: string;
  product_name: string;
  sku: string;
  location_name: string;
  location_code: string;
}

export interface Database {
  public: {
    Tables: {
      tenants: Table<{
        id: string;
        name: string;
        slug: string;
        currency_code: string;
        timezone: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      categories: Table<CategoryRow>;
      products: Table<ProductRow>;
      product_variants: Table<VariantRow>;
      stock_locations: Table<LocationRow>;
      stock_balances: Table<StockBalanceRow>;
      stock_operations: Table<StockOperationRow>;
      stock_movements: Table<StockMovementRow>;
    };
    Views: {
      stock_overview: View<StockOverviewRow>;
      stock_movement_history: View<StockMovementHistoryRow>;
    };
    Functions: {
      create_tenant: {
        Args: {
          p_name: string;
          p_slug: string;
          p_currency_code: string;
          p_timezone: string;
        };
        Returns: Database['public']['Tables']['tenants']['Row'];
      };
      upsert_category: {
        Args: {
          p_tenant_id: string;
          p_category_id: string | null;
          p_name: string;
          p_active: boolean;
        };
        Returns: CategoryRow;
      };
      upsert_product: {
        Args: {
          p_tenant_id: string;
          p_product_id: string | null;
          p_variant_id: string | null;
          p_category_id: string | null;
          p_name: string;
          p_description: string | null;
          p_sale_price: number | string;
          p_cost_price: number | string;
          p_sku: string;
          p_barcode: string | null;
          p_attributes: Record<string, unknown>;
          p_active: boolean;
        };
        Returns: unknown;
      };
      upsert_stock_location: {
        Args: {
          p_tenant_id: string;
          p_location_id: string | null;
          p_name: string;
          p_code: string;
          p_active: boolean;
        };
        Returns: LocationRow;
      };
      post_stock_operation: {
        Args: {
          p_tenant_id: string;
          p_operation_type: string;
          p_idempotency_key: string;
          p_reason: string | null;
          p_reference: string | null;
          p_lines: Array<{
            variant_id: string;
            location_id: string;
            quantity_delta: number | string;
          }>;
          p_reverses_operation_id: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
