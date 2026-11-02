/**
 * Dépôt de données : une seule interface, deux implémentations.
 *
 *  - `supabase` : production (REST PostgREST + RPC, RLS côté base)
 *  - `demo`     : snapshot réel du 2026-11-02, en mémoire, mutations acceptées
 *
 * Le choix se fait par variable d'environnement, jamais au runtime côté client.
 */

import {
  BALANCES,
  CATEGORIES,
  FLOWS_60D,
  LOCATION,
  MEMBERS,
  PRODUCTS,
  RECENT_OPERATIONS,
  ROLES,
  SUPPLIERS,
  TENANT,
  WEEKLY,
} from "./snapshot";
import { buildRow, sortByUrgency } from "./logic";
import type {
  Category,
  Member,
  OperationType,
  Product,
  Role,
  StockOperation,
  StockRow,
  Supplier,
  Tenant,
  WeeklyFlow,
} from "./types";

export interface NewOperationInput {
  operation_type: OperationType;
  reference?: string;
  reason?: string;
  lines: Array<{ variant_id: string; quantity_delta: number }>;
}

export interface OperationResult {
  ok: boolean;
  error?: string;
  operation?: StockOperation;
}

/** Contexte d'authentification fourni par la couche serveur. */
export interface SessionContext {
  accessToken: string;
  tenantId?: string | null;
}

export interface DataSource {
  readonly kind: "demo" | "supabase";
  getTenant(): Promise<Tenant>;
  getRows(): Promise<StockRow[]>;
  getOperations(limit?: number): Promise<StockOperation[]>;
  getWeekly(): Promise<WeeklyFlow[]>;
  getCategories(): Promise<Category[]>;
  getSuppliers(): Promise<Supplier[]>;
  getRoles(): Promise<Role[]>;
  getMembers(): Promise<Member[]>;
  postOperation(input: NewOperationInput): Promise<OperationResult>;
}

/* ------------------------------------------------------------------ */
/* Implémentation démo (snapshot en mémoire)                           */
/* ------------------------------------------------------------------ */

type DemoState = {
  ops: StockOperation[];
  balances: Record<string, number>;
  counter: number;
};

const globalDemo = globalThis as unknown as { __demoStock?: DemoState };

function demoState(): DemoState {
  if (globalDemo.__demoStock) return globalDemo.__demoStock;

  const balances: Record<string, number> = {};
  for (const [variantId, balance] of Object.entries(BALANCES)) {
    balances[variantId] = balance.on_hand;
  }

  // Reconstruit le journal à partir des 12 opérations réelles + soldes de départ.
  const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));
  const ops: StockOperation[] = RECENT_OPERATIONS.map((op, index) => ({
    id: `op-${index + 1}`,
    operation_type: op.type,
    status: "posted" as const,
    reference: op.reference,
    reason: op.reason,
    actor: "Aboubakar Amadou",
    created_at: `${op.date}T${String(18 - index).padStart(2, "0")}:12:00.000Z`,
    lines: op.lines.map(([sku, qty]) => {
      const product = bySku.get(sku)!;
      return {
        variant_id: product.variant_id,
        sku,
        product_name: product.name,
        quantity_delta: qty,
        on_hand_after: balances[product.variant_id] ?? 0,
      };
    }),
  }));

  globalDemo.__demoStock = { ops, balances, counter: ops.length };
  return globalDemo.__demoStock;
}

function productByVariant(variantId: string): Product | undefined {
  return PRODUCTS.find((p) => p.variant_id === variantId);
}

class DemoSource implements DataSource {
  readonly kind = "demo" as const;

  async getTenant() {
    return TENANT;
  }

  async getRows(): Promise<StockRow[]> {
    const state = demoState();
    const categoryName = new Map(CATEGORIES.map((c) => [c.id, c.name]));
    const supplierName = new Map(SUPPLIERS.map((s) => [s.id, s.name]));

    const rows = PRODUCTS.map((product) =>
      buildRow({
        product,
        on_hand: state.balances[product.variant_id] ?? 0,
        reserved: BALANCES[product.variant_id]?.reserved ?? 0,
        issues_60d: FLOWS_60D[product.variant_id]?.issues ?? 0,
        receipts_60d: FLOWS_60D[product.variant_id]?.receipts ?? 0,
        category_name: categoryName.get(product.category_id ?? "") ?? "—",
        supplier_name: supplierName.get(product.supplier_id ?? "") ?? null,
        location_name: LOCATION.name,
      }),
    );
    return sortByUrgency(rows);
  }

  async getOperations(limit = 25): Promise<StockOperation[]> {
    return demoState().ops.slice(0, limit);
  }

  async getWeekly(): Promise<WeeklyFlow[]> {
    return WEEKLY;
  }

  async getCategories() {
    return CATEGORIES;
  }

  async getSuppliers() {
    return SUPPLIERS;
  }

  async getRoles() {
    return ROLES;
  }

  async getMembers() {
    return MEMBERS;
  }

  /**
   * Même contrat que `post_stock_operation` : motifs obligatoires pour les
   * ajustements, stock insuffisant refusé, soldes mis à jour atomiquement.
   */
  async postOperation(input: NewOperationInput): Promise<OperationResult> {
    const state = demoState();
    const { operation_type, lines } = input;

    if (lines.length === 0) return { ok: false, error: "Au moins une ligne est requise." };
    if (["adjustment", "inventory", "reversal"].includes(operation_type)) {
      if (!input.reason || input.reason.trim().length < 2) {
        return { ok: false, error: "Un motif est obligatoire pour ce type d’opération." };
      }
    }
    if (operation_type === "receipt" && lines.some((l) => l.quantity_delta <= 0)) {
      return { ok: false, error: "Les quantités reçues doivent être positives." };
    }
    if (operation_type === "issue" && lines.some((l) => l.quantity_delta >= 0)) {
      return { ok: false, error: "Les quantités sorties doivent être négatives." };
    }

    // Vérification préalable de disponibilité (le RPC le fait sous verrou).
    for (const line of lines) {
      const product = productByVariant(line.variant_id);
      if (!product) return { ok: false, error: "Référence inconnue." };
      const current = state.balances[line.variant_id] ?? 0;
      if (current + line.quantity_delta < 0) {
        return {
          ok: false,
          error: `Stock insuffisant pour ${product.name} : ${current} ${product.unit} disponible(s).`,
        };
      }
    }

    state.counter += 1;
    const created: StockOperation = {
      id: `op-${state.counter}`,
      operation_type,
      status: "posted",
      reference: input.reference?.trim() || null,
      reason: input.reason?.trim() || null,
      actor: "Aboubakar Amadou",
      created_at: new Date().toISOString(),
      lines: lines.map((line) => {
        const product = productByVariant(line.variant_id)!;
        const next = (state.balances[line.variant_id] ?? 0) + line.quantity_delta;
        state.balances[line.variant_id] = next;
        return {
          variant_id: line.variant_id,
          sku: product.sku,
          product_name: product.name,
          quantity_delta: line.quantity_delta,
          on_hand_after: next,
        };
      }),
    };
    state.ops.unshift(created);
    return { ok: true, operation: created };
  }
}

/* ------------------------------------------------------------------ */
/* Implémentation Supabase (PostgREST + RPC)                           */
/* ------------------------------------------------------------------ */

class SupabaseSource implements DataSource {
  readonly kind = "supabase" as const;
  private tenantId: string;
  private tenant: Tenant | null = null;

  constructor(
    private url: string,
    private key: string,
    private jwt: string,
    tenantId: string,
  ) {
    this.tenantId = tenantId;
  }

  private headers(): HeadersInit {
    return {
      apikey: this.key,
      authorization: `Bearer ${this.jwt}`,
      "content-type": "application/json",
      accept: "application/json",
    };
  }

  private async rest<T>(path: string): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1${path}`, {
      headers: this.headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`PostgREST ${res.status} sur ${path}`);
    return (await res.json()) as T;
  }

  private async rpc<T>(fn: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        (payload as { message?: string; details?: string } | null)?.message ??
        `RPC ${fn} a échoué (${res.status})`;
      throw new Error(message);
    }
    return payload as T;
  }

  async getTenant(): Promise<Tenant> {
    if (this.tenant) return this.tenant;
    if (!this.tenantId) throw new Error("Aucune entreprise active sélectionnée");
    const rows = await this.rest<Tenant[]>(
      `/tenants?id=eq.${this.tenantId}&select=id,name,slug,currency_code,timezone,status,address,phone&limit=1`,
    );
    if (!rows[0]) throw new Error("Entreprise inaccessible pour cet utilisateur");
    this.tenant = rows[0];
    return rows[0];
  }

  async getRows(): Promise<StockRow[]> {
    const tenant = await this.getTenant();
    const location = await this.rest<Array<{ id: string; name: string }>>(
      `/stock_locations?tenant_id=eq.${tenant.id}&select=id,name&limit=1`,
    );
    const query =
      `/stock_overview?tenant_id=eq.${tenant.id}` +
      `&select=variant_id,product_id,product_name,sku,location_name,on_hand,reserved,available` +
      `&order=on_hand.asc`;
    const overview = await this.rest<
      Array<{
        variant_id: string;
        product_id: string;
        product_name: string;
        sku: string;
        location_name: string;
        on_hand: number;
        reserved: number;
        available: number;
      }>
    >(query);

    const [products, categories, suppliers] = await Promise.all([
      this.rest<Array<Record<string, unknown>>>(
        `/products?tenant_id=eq.${tenant.id}&select=id,name,active,category_id,supplier_id,sale_price,cost_price,` +
          `product_variants(id,sku,unit,barcode,reorder_point,reorder_qty,storage_label)`,
      ),
      this.rest<Category[]>(`/categories?tenant_id=eq.${tenant.id}&select=id,name,active`),
      this.rest<Supplier[]>(`/suppliers?tenant_id=eq.${tenant.id}&select=*`),
    ]);

    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
    const byVariant = new Map<string, StockRow>();
    const flow = await this.flowByVariant(tenant.id);

    for (const item of overview) {
      const product = products.find((p) => p.id === item.product_id);
      const variants = (product?.product_variants ?? []) as Array<Record<string, unknown>>;
      const variant = variants.find((v) => v.id === item.variant_id);
      if (!product || !variant) continue;
      byVariant.set(item.variant_id, {
        id: String(product.id),
        variant_id: item.variant_id,
        name: String(product.name),
        sku: String(variant.sku),
        barcode: (variant.barcode as string | null) ?? null,
        unit: String(variant.unit ?? "pièce"),
        category_id: (product.category_id as string | null) ?? null,
        supplier_id: (product.supplier_id as string | null) ?? null,
        sale_price: Number(product.sale_price),
        cost_price: Number(product.cost_price),
        reorder_point: Number(variant.reorder_point ?? 0),
        reorder_qty: Number(variant.reorder_qty ?? 1),
        storage_label: (variant.storage_label as string | null) ?? null,
        active: Boolean(product.active),
        on_hand: Number(item.on_hand),
        reserved: Number(item.reserved),
        available: Number(item.available),
        issues_60d: flow.get(item.variant_id)?.issues ?? 0,
        receipts_60d: flow.get(item.variant_id)?.receipts ?? 0,
        category_name: categoryName.get(String(product.category_id)) ?? "—",
        supplier_name: supplierName.get(String(product.supplier_id)) ?? null,
        location_name: item.location_name ?? location[0]?.name ?? "—",
        status: "ok",
        stock_value_cost: 0,
        stock_value_sale: 0,
        cover_days: null,
      });
    }

    // Recalcule statuts et valorisations avec la même logique que la démo.
    const productsByIdVariant = new Map(PRODUCTS.map((p) => [p.variant_id, p]));
    return sortByUrgency(
      [...byVariant.values()].map((row) => {
        const model = productsByIdVariant.get(row.variant_id);
        return {
          ...row,
          status:
            row.available <= 0 ? "out" : row.available <= row.reorder_point ? "low" : "ok",
          stock_value_cost: Math.round(row.on_hand * row.cost_price),
          stock_value_sale: Math.round(row.on_hand * row.sale_price),
          cover_days:
            model && model.variant_id in FLOWS_60D
              ? null
              : row.issues_60d > 0
                ? Math.round(row.available / (row.issues_60d / 60))
                : null,
        } as StockRow;
      }),
    );
  }

  private async flowByVariant(
    tenantId: string,
  ): Promise<Map<string, { issues: number; receipts: number }>> {
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const movements = await this.rest<
      Array<{ variant_id: string; quantity_delta: number }>
    >(
      `/stock_movements?tenant_id=eq.${tenantId}&created_at=gte.${since}` +
        `&select=variant_id,quantity_delta&limit=5000`,
    );
    const map = new Map<string, { issues: number; receipts: number }>();
    for (const movement of movements) {
      const entry = map.get(movement.variant_id) ?? { issues: 0, receipts: 0 };
      const qty = Number(movement.quantity_delta);
      if (qty < 0) entry.issues += -qty;
      else entry.receipts += qty;
      map.set(movement.variant_id, entry);
    }
    return map;
  }

  async getOperations(limit = 25): Promise<StockOperation[]> {
    const tenant = await this.getTenant();
    const rows = await this.rest<
      Array<{
        id: string;
        operation_type: OperationType;
        status: "posted" | "reversed";
        reference: string | null;
        reason: string | null;
        actor_user_id: string;
        created_at: string;
        product_name: string;
        sku: string;
        quantity_delta: number;
        on_hand_after: number;
        variant_id: string;
      }>
    >(
      `/stock_movement_history?tenant_id=eq.${tenant.id}` +
        `&select=id,operation_type,status,reference,reason,actor_user_id,created_at,product_name,sku,quantity_delta,on_hand_after,variant_id` +
        `&order=created_at.desc&limit=200`,
    );
    const grouped = new Map<string, StockOperation>();
    for (const row of rows) {
      const existing = grouped.get(row.id);
      const line = {
        variant_id: row.variant_id,
        sku: row.sku,
        product_name: row.product_name,
        quantity_delta: Number(row.quantity_delta),
        on_hand_after: Number(row.on_hand_after),
      };
      if (existing) existing.lines.push(line);
      else
        grouped.set(row.id, {
          id: row.id,
          operation_type: row.operation_type,
          status: row.status,
          reference: row.reference,
          reason: row.reason,
          actor: row.actor_user_id,
          created_at: row.created_at,
          lines: [line],
        });
    }
    return [...grouped.values()].slice(0, limit);
  }

  async getWeekly(): Promise<WeeklyFlow[]> {
    const tenant = await this.getTenant();
    const operations = await this.rest<Array<{ id: string; operation_type: OperationType; created_at: string }>>(
      `/stock_operations?tenant_id=eq.${tenant.id}` +
        `&created_at=gte.${new Date(Date.now() - 56 * 86_400_000).toISOString()}` +
        `&select=id,operation_type,created_at&limit=2000`,
    );
    const byWeek = new Map<string, WeeklyFlow>();
    for (const operation of operations) {
      const monday = isoMonday(operation.created_at);
      const entry = byWeek.get(monday) ?? { week: monday, issues: 0, receipts: 0, operations: 0 };
      entry.operations += 1;
      byWeek.set(monday, entry);
    }
    return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
  }

  async getCategories() {
    const tenant = await this.getTenant();
    return this.rest<Category[]>(`/categories?tenant_id=eq.${tenant.id}&select=id,name,active&order=name`);
  }

  async getSuppliers() {
    const tenant = await this.getTenant();
    return this.rest<Supplier[]>(`/suppliers?tenant_id=eq.${tenant.id}&select=*&order=name`);
  }

  async getRoles() {
    const tenant = await this.getTenant();
    return this.rpc<Role[]>("list_tenant_roles", { p_tenant_id: tenant.id });
  }

  async getMembers() {
    const tenant = await this.getTenant();
    const rows = await this.rpc<Array<Record<string, unknown>>>("list_tenant_members", {
      p_tenant_id: tenant.id,
    });
    return rows.map((row) => ({
      id: String(row.membership_id),
      full_name: String(row.full_name ?? "—"),
      email: String(row.email ?? "—"),
      role_id: String(row.role_id),
      role_name: String(row.role_name),
      status: String(row.status),
      joined_at: String(row.created_at ?? "").slice(0, 10),
    }));
  }

  async postOperation(input: NewOperationInput): Promise<OperationResult> {
    const tenant = await this.getTenant();
    const idempotencyKey = process.env.SAAS_IDEMPOTENCY_KEY ?? crypto.randomUUID();
    try {
      await this.rpc<string>("post_stock_operation", {
        p_tenant_id: tenant.id,
        p_operation_type: input.operation_type,
        p_idempotency_key: idempotencyKey,
        p_reason: input.reason ?? null,
        p_reference: input.reference ?? null,
        p_lines: input.lines,
        p_reverses_operation_id: null,
      });
      const operations = await this.getOperations(1);
      return { ok: true, operation: operations[0] };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" };
    }
  }
}

function isoMonday(iso: string): string {
  const date = new Date(iso);
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */

/**
 * Sans contexte de session (mode démo, tests, pages publiques), on sert le
 * snapshot. Avec une session, on parle à Supabase en tant qu'utilisateur :
 * la RLS décide de ce qui est visible, et `tenantId` borne l'entreprise.
 */
export function getDataSource(context?: SessionContext | null): DataSource {
  if (!context) return new DemoSource();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return new DemoSource();
  if (!context.tenantId) return new DemoSource();

  return new SupabaseSource(
    url.replace(/\/$/, ""),
    anonKey,
    context.accessToken,
    context.tenantId,
  );
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
