/** Types du domaine stock — alignés sur le schéma Supabase (public.*). */

export type PermissionCode =
  | "audit.read"
  | "catalog.manage"
  | "catalog.read"
  | "inventory.manage"
  | "inventory.read"
  | "members.manage"
  | "members.read"
  | "reports.manage"
  | "reports.read"
  | "sales.manage"
  | "sales.read"
  | "stores.manage"
  | "stores.read"
  | "tenant.manage"
  | "tenant.read";

export type OperationType =
  | "opening"
  | "receipt"
  | "issue"
  | "adjustment"
  | "inventory"
  | "transfer"
  | "reversal";

export type OperationStatus = "posted" | "reversed";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency_code: string;
  timezone: string;
  status: string;
  address: string | null;
  phone: string | null;
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  lead_time_days: number;
  notes: string | null;
  active: boolean;
}

export interface StockLocation {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface Product {
  id: string;
  variant_id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  category_id: string | null;
  supplier_id: string | null;
  sale_price: number;
  cost_price: number;
  reorder_point: number;
  reorder_qty: number;
  storage_label: string | null;
  active: boolean;
}

export interface StockLine {
  variant_id: string;
  sku: string;
  product_name: string;
  quantity_delta: number;
  on_hand_after: number;
}

export interface StockOperation {
  id: string;
  operation_type: OperationType;
  status: OperationStatus;
  reference: string | null;
  reason: string | null;
  actor: string;
  created_at: string;
  lines: StockLine[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: PermissionCode[];
}

export interface Member {
  id: string;
  full_name: string;
  email: string;
  role_id: string;
  role_name: string;
  status: string;
  joined_at: string;
}

export interface WeeklyFlow {
  week: string; // lundi ISO
  issues: number;
  receipts: number;
  operations: number;
}

/** Ligne enrichie pour l'écran « Stock ». */
export interface StockRow extends Product {
  on_hand: number;
  reserved: number;
  available: number;
  issues_60d: number;
  receipts_60d: number;
  category_name: string;
  supplier_name: string | null;
  location_name: string;
  status: "out" | "low" | "ok";
  stock_value_cost: number;
  stock_value_sale: number;
  cover_days: number | null;
}
