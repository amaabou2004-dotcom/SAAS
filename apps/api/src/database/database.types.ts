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

type SaleRow = {
  id: string;
  tenant_id: string;
  seq: number;
  status: string;
  location_id: string;
  operation_id: string | null;
  reversal_operation_id: string | null;
  payment_method: string;
  payment_reference: string | null;
  customer_name: string | null;
  note: string | null;
  subtotal: number;
  total: number;
  total_cost: number;
  item_count: number;
  idempotency_key: string;
  request_fingerprint: string;
  actor_user_id: string;
  created_at: string;
  voided_at: string | null;
}

type SaleItemRow = {
  id: string;
  tenant_id: string;
  sale_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  unit_cost: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

type StorefrontSettingsRow = {
  tenant_id: string;
  slug: string;
  display_name: string | null;
  whatsapp: string | null;
  published: boolean;
  default_location_id: string | null;
  created_at: string;
  updated_at: string;
}

type StorefrontOrderRow = {
  id: string;
  tenant_id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  note: string | null;
  subtotal: number;
  total: number;
  item_count: number;
  idempotency_key: string;
  sale_id: string | null;
  cancel_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

type StorefrontOrderItemRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

type StorefrontCatalogRow = {
  product_id: string;
  variant_id: string;
  name: string;
  description: string | null;
  sku: string;
  category_name: string | null;
  unit_price: number;
  available: number;
  currency_code: string;
}

type SaleOverviewRow = SaleRow & {
  number: string;
  location_name: string;
  margin: number;
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
      sales: Table<SaleRow>;
      sale_items: Table<SaleItemRow>;
      storefront_settings: Table<StorefrontSettingsRow>;
      storefront_orders: Table<StorefrontOrderRow>;
      storefront_order_items: Table<StorefrontOrderItemRow>;
    };
    Views: {
      stock_overview: View<StockOverviewRow>;
      stock_movement_history: View<StockMovementHistoryRow>;
      sales_overview: View<SaleOverviewRow>;
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
      storefront_info: {
        Args: { p_slug: string };
        Returns: Record<string, unknown> | null;
      };
      storefront_catalog: {
        Args: { p_slug: string };
        Returns: StorefrontCatalogRow[];
      };
      place_storefront_order: {
        Args: {
          p_slug: string;
          p_idempotency_key: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_note: string | null;
          p_items: Array<{ variant_id: string; quantity: number }>;
        };
        Returns: Record<string, unknown>;
      };
      storefront_settings_get: {
        Args: { p_tenant_id: string };
        Returns: Record<string, unknown>;
      };
      storefront_settings_save: {
        Args: {
          p_tenant_id: string;
          p_slug: string;
          p_display_name: string | null;
          p_whatsapp: string | null;
          p_published: boolean;
          p_default_location_id: string | null;
        };
        Returns: Record<string, unknown>;
      };
      storefront_orders_list: {
        Args: { p_tenant_id: string };
        Returns: Array<Record<string, unknown>>;
      };
      storefront_confirm_order: {
        Args: { p_tenant_id: string; p_order_id: string; p_location_id: string | null };
        Returns: Record<string, unknown>;
      };
      storefront_cancel_order: {
        Args: { p_tenant_id: string; p_order_id: string; p_reason: string };
        Returns: void;
      };
      storefront_mark_delivered: {
        Args: { p_tenant_id: string; p_order_id: string };
        Returns: void;
      };
      post_sale: {
        Args: {
          p_tenant_id: string;
          p_idempotency_key: string;
          p_location_id: string;
          p_payment_method: string;
          p_payment_reference: string | null;
          p_customer_name: string | null;
          p_note: string | null;
          p_items: Array<{
            variant_id: string;
            quantity: number;
            unit_price?: number;
          }>;
        };
        Returns: string;
      };
      list_tenant_members: {
        Args: { p_tenant_id: string };
        Returns: Array<{
          membership_id: string;
          user_id: string;
          full_name: string;
          email: string;
          role_id: string;
          role_name: string;
          status: string;
          created_at: string;
        }>;
      };
      list_tenant_roles: {
        Args: { p_tenant_id: string };
        Returns: Array<{
          id: string;
          name: string;
          description: string;
          is_system: boolean;
          permissions: string[];
          member_count: number;
        }>;
      };
      list_tenant_invitations: {
        Args: { p_tenant_id: string };
        Returns: Array<{
          id: string;
          email: string;
          full_name: string;
          role_id: string;
          role_name: string;
          status: string;
          created_at: string;
          expires_at: string;
          token: string;
        }>;
      };
      invite_member: {
        Args: {
          p_tenant_id: string;
          p_email: string;
          p_role_id: string;
          p_full_name?: string | null;
        };
        Returns: {
          status: string;
          user_id?: string;
          membership_id?: string;
          invitation_id?: string;
        };
      };
      revoke_invitation: {
        Args: { p_tenant_id: string; p_invitation_id: string };
        Returns: undefined;
      };
      update_member_role: {
        Args: { p_tenant_id: string; p_membership_id: string; p_role_id: string };
        Returns: undefined;
      };
      remove_member: {
        Args: { p_tenant_id: string; p_membership_id: string };
        Returns: undefined;
      };
      has_tenant_permission: {
        Args: { target_tenant_id: string; target_permission: string };
        Returns: boolean;
      };
      report_summary: {
        Args: { p_tenant_id: string; p_from: string; p_to: string };
        Returns: unknown;
      };
      accept_my_invitations: {
        Args: Record<string, never>;
        Returns: { accepted?: number };
      };
      void_sale: {
        Args: {
          p_tenant_id: string;
          p_sale_id: string;
          p_reason: string;
          p_idempotency_key: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
