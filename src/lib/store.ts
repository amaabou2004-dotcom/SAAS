import { create } from 'zustand'
import { supabase, frenchError } from './supabase'
import { uid } from './format'
import type { ImportSummary, Movement, MovementType, Product, Settings, Supplier } from './types'

export type ProductDraft = Omit<
  Product,
  'id' | 'variantId' | 'categoryId' | 'createdAt' | 'updatedAt' | 'stock' | 'category'
> & { category?: string; stock?: number }

type ActionResult = { ok: boolean; error?: string; operationId?: string }

type Viewer = {
  tenantId: string
  userId: string
  userName: string
  roleName: string
  company: string
  currency: string
  timezone: string
  phone: string
  address: string
}

type Category = { id: string; name: string }
type Location = { id: string; name: string; code: string }

type DataState = {
  ready: boolean
  loading: boolean
  error: string | null
  viewer: Viewer | null
  categories: Category[]
  locations: Location[]
  products: Product[]
  suppliers: Supplier[]
  movements: Movement[]
  settings: Settings
  configure: (viewer: Viewer) => Promise<void>
  reload: () => Promise<void>
  clear: () => void
  addProduct: (draft: ProductDraft) => Promise<Product>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<{ ok: boolean; error?: string; archived?: boolean }>
  importProducts: (drafts: Partial<ProductDraft>[]) => Promise<ImportSummary>
  addMovement: (input: {
    productId: string
    type: MovementType
    quantity: number
    reason: string
    note?: string
    unitCost?: number
  }) => Promise<ActionResult>
  undoMovement: (operationId: string) => Promise<ActionResult>
  addSupplier: (draft: Omit<Supplier, 'id' | 'createdAt'>) => Promise<Supplier>
  updateSupplier: (id: string, patch: Partial<Supplier>) => Promise<void>
  deleteSupplier: (id: string) => Promise<{ ok: boolean; error?: string }>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  seedDemo: () => Promise<{ products: number; movements: number }>
}

const EMPTY_SETTINGS: Settings = {
  company: '',
  userName: '',
  currency: 'XOF',
  role: '',
  phone: '',
  address: '',
}

const DEFAULT_LOCATION_NAME = 'Dépôt principal'

function referencePrefix(type: MovementType): string {
  return type === 'in' ? 'ENT' : type === 'out' ? 'SOR' : 'INV'
}

function newKey(prefix = 'kanti'): string {
  return `${prefix}-${uid('').replace(/-/g, '').slice(0, 24)}`
}

type ProductRow = {
  id: string
  name: string
  sale_price: number
  cost_price: number
  category_id: string | null
  supplier_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

type VariantRow = {
  id: string
  product_id: string
  sku: string
  barcode: string | null
  unit: string
  reorder_point: number
  reorder_qty: number
  storage_label: string | null
  active: boolean
}

type BalanceRow = { variant_id: string; location_id: string; on_hand: number }

type MovementRow = {
  id: string
  operation_id: string
  operation_type: string
  operation_status: string
  product_id: string
  quantity_delta: number
  on_hand_after: number
  reason: string | null
  reference: string | null
  actor_user_id: string
  created_at: string
}

function movementType(operationType: string, delta: number): MovementType {
  if (operationType === 'receipt' || operationType === 'opening') return 'in'
  if (operationType === 'issue') return 'out'
  if (operationType === 'adjustment') return delta >= 0 ? 'in' : 'out'
  return 'adjust'
}

export const useData = create<DataState>()((set, get) => ({
  ready: false,
  loading: false,
  error: null,
  viewer: null,
  categories: [],
  locations: [],
  products: [],
  suppliers: [],
  movements: [],
  settings: EMPTY_SETTINGS,

  configure: async (viewer) => {
    const current = get().viewer
    set({
      viewer,
      settings: {
        company: viewer.company,
        userName: viewer.userName,
        currency: viewer.currency,
        role: viewer.roleName,
        phone: viewer.phone,
        address: viewer.address,
      },
    })
    if (
      !current ||
      current.tenantId !== viewer.tenantId ||
      current.userName !== viewer.userName ||
      current.company !== viewer.company ||
      current.currency !== viewer.currency
    ) {
      await get().reload()
    }
  },

  reload: async () => {
    const viewer = get().viewer
    if (!viewer) return
    set({ loading: true, error: null })
    try {
      const tenantId = viewer.tenantId
      const [productsRes, variantsRes, categoriesRes, suppliersRes, balancesRes, locationsRes, movementsRes] =
        await Promise.all([
          supabase
            .from('products')
            .select('id, name, sale_price, cost_price, category_id, supplier_id, active, created_at, updated_at')
            .eq('tenant_id', tenantId)
            .order('name'),
          supabase
            .from('product_variants')
            .select('id, product_id, sku, barcode, unit, reorder_point, reorder_qty, storage_label, active')
            .eq('tenant_id', tenantId),
          supabase.from('categories').select('id, name').eq('tenant_id', tenantId).order('name'),
          supabase
            .from('suppliers')
            .select('id, name, contact, phone, email, city, lead_time_days, notes, created_at')
            .eq('tenant_id', tenantId)
            .order('name'),
          supabase.from('stock_balances').select('variant_id, location_id, on_hand').eq('tenant_id', tenantId),
          supabase.from('stock_locations').select('id, name, code').eq('tenant_id', tenantId).order('created_at'),
          supabase
            .from('stock_movement_history')
            .select(
              'id, operation_id, operation_type, operation_status, product_id, quantity_delta, on_hand_after, reason, reference, actor_user_id, created_at',
            )
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1500),
        ])

      const firstError =
        productsRes.error ?? variantsRes.error ?? categoriesRes.error ?? suppliersRes.error ?? balancesRes.error ?? locationsRes.error ?? movementsRes.error
      if (firstError) throw firstError

      const variants = (variantsRes.data ?? []) as VariantRow[]
      const categories = (categoriesRes.data ?? []) as { id: string; name: string }[]
      const balances = (balancesRes.data ?? []) as BalanceRow[]
      const categoryById = new Map(categories.map((c) => [c.id, c.name]))
      const stockByVariant = new Map<string, number>()
      balances.forEach((b) => {
        stockByVariant.set(b.variant_id, (stockByVariant.get(b.variant_id) ?? 0) + Number(b.on_hand))
      })

      const products: Product[] = ((productsRes.data ?? []) as ProductRow[]).map((row) => {
        const variant = variants.find((v) => v.product_id === row.id)
        return {
          id: row.id,
          variantId: variant?.id ?? '',
          categoryId: row.category_id,
          sku: variant?.sku ?? '',
          barcode: variant?.barcode ?? '',
          name: row.name,
          category: row.category_id ? (categoryById.get(row.category_id) ?? 'Divers') : 'Divers',
          unit: variant?.unit ?? 'pièce',
          cost: Number(row.cost_price),
          price: Number(row.sale_price),
          stock: variant ? (stockByVariant.get(variant.id) ?? 0) : 0,
          reorderPoint: Number(variant?.reorder_point ?? 0),
          reorderQty: Number(variant?.reorder_qty ?? 1),
          supplierId: row.supplier_id,
          location: variant?.storage_label ?? '',
          active: row.active && (variant?.active ?? true),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      })

      const suppliers: Supplier[] = (suppliersRes.data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        contact: (row.contact as string | null) ?? '',
        phone: (row.phone as string | null) ?? '',
        email: (row.email as string | null) ?? '',
        city: (row.city as string | null) ?? '',
        leadTimeDays: Number(row.lead_time_days ?? 7),
        notes: (row.notes as string | null) ?? '',
        createdAt: row.created_at as string,
      }))

      const productsById = new Map(products.map((p) => [p.id, p]))
      const movements: Movement[] = ((movementsRes.data ?? []) as MovementRow[]).map((row) => {
        const delta = Number(row.quantity_delta)
        const product = productsById.get(row.product_id)
        return {
          id: row.id,
          operationId: row.operation_id,
          productId: row.product_id,
          type: movementType(row.operation_type, delta),
          quantity: Math.abs(delta),
          stockBefore: Number(row.on_hand_after) - delta,
          stockAfter: Number(row.on_hand_after),
          unitCost: product?.cost ?? 0,
          reason: row.reason ?? '',
          reference: row.reference ?? undefined,
          user: row.actor_user_id === viewer.userId ? viewer.userName : row.actor_user_id === '00000000-0000-0000-0000-000000000000' ? 'Système' : 'Équipe',
          at: row.created_at,
        }
      })

      set({
        products,
        suppliers,
        movements,
        categories,
        locations: (locationsRes.data ?? []) as Location[],
        ready: true,
      })
    } catch (err) {
      set({ error: frenchError((err as { message?: string }).message) })
    } finally {
      set({ loading: false })
    }
  },

  clear: () =>
    set({
      ready: false,
      viewer: null,
      products: [],
      suppliers: [],
      movements: [],
      categories: [],
      locations: [],
      settings: EMPTY_SETTINGS,
      error: null,
    }),

  addProduct: async (draft) => {
    const viewer = get().viewer
    if (!viewer) throw new Error('Espace de travail non chargé.')

    const categoryId = await ensureCategory(viewer.tenantId, draft.category ?? 'Divers', get().categories)
    const sku = (draft.sku?.trim() || buildSku(draft.name, get().products)).toUpperCase()

    const { data, error } = await supabase.rpc('upsert_product', {
      p_tenant_id: viewer.tenantId,
      p_product_id: null,
      p_variant_id: null,
      p_category_id: categoryId,
      p_name: draft.name.trim(),
      p_description: '',
      p_sale_price: draft.price,
      p_cost_price: draft.cost,
      p_sku: sku,
      p_barcode: draft.barcode.trim() || null,
      p_attributes: {},
      p_active: draft.active,
      p_supplier_id: draft.supplierId,
      p_unit: draft.unit,
      p_reorder_point: draft.reorderPoint,
      p_reorder_qty: draft.reorderQty,
      p_storage_label: draft.location || null,
    })
    if (error) throw new Error(frenchError(error.message))

    const created = data as { product: { id: string; created_at: string; updated_at: string }; variant: { id: string } }

    const initialStock = Math.max(0, Number(draft.stock ?? 0))
    if (initialStock > 0) {
      const locationId = await ensureLocation(viewer.tenantId, get().locations)
      const { error: movementError } = await supabase.rpc('post_stock_operation', {
        p_tenant_id: viewer.tenantId,
        p_operation_type: 'opening',
        p_idempotency_key: newKey('opening'),
        p_reason: 'Stock initial',
        p_reference: null,
        p_lines: [
          { variant_id: created.variant.id, location_id: locationId, quantity_delta: initialStock },
        ],
        p_reverses_operation_id: null,
      })
      if (movementError) throw new Error(frenchError(movementError.message))
    }

    await get().reload()
    const product = get().products.find((p) => p.id === created.product.id)
    if (!product) throw new Error('Produit créé mais introuvable au rechargement.')
    return product
  },

  updateProduct: async (id, patch) => {
    const viewer = get().viewer
    const product = get().products.find((p) => p.id === id)
    if (!viewer || !product) throw new Error('Produit introuvable.')

    const next = { ...product, ...patch }
    const categoryId = await ensureCategory(viewer.tenantId, next.category, get().categories)

    const { error } = await supabase.rpc('upsert_product', {
      p_tenant_id: viewer.tenantId,
      p_product_id: product.id,
      p_variant_id: product.variantId,
      p_category_id: categoryId,
      p_name: next.name.trim(),
      p_description: '',
      p_sale_price: next.price,
      p_cost_price: next.cost,
      p_sku: next.sku.trim().toUpperCase(),
      p_barcode: next.barcode.trim() || null,
      p_attributes: {},
      p_active: next.active,
      p_supplier_id: next.supplierId,
      p_unit: next.unit,
      p_reorder_point: next.reorderPoint,
      p_reorder_qty: next.reorderQty,
      p_storage_label: next.location || null,
    })
    if (error) throw new Error(frenchError(error.message))
    await get().reload()
  },

  deleteProduct: async (id) => {
    const viewer = get().viewer
    if (!viewer) return { ok: false, error: 'Espace de travail non chargé.' }
    const { data, error } = await supabase.rpc('delete_product', {
      p_tenant_id: viewer.tenantId,
      p_product_id: id,
    })
    if (error) return { ok: false, error: frenchError(error.message) }
    await get().reload()
    return { ok: true, archived: data === 'archived' }
  },

  importProducts: async (drafts) => {
    const summary: ImportSummary = { added: 0, updated: 0, skipped: 0, errors: [] }
    for (const [index, draft] of drafts.entries()) {
      const name = draft.name?.trim()
      if (!name) {
        summary.skipped += 1
        summary.errors.push(`Ligne ${index + 2} : nom manquant`)
        continue
      }
      const existing = draft.sku
        ? get().products.find((p) => p.sku.toUpperCase() === draft.sku!.trim().toUpperCase())
        : undefined
      try {
        if (existing) {
          await get().updateProduct(existing.id, {
            name,
            category: draft.category || existing.category,
            unit: draft.unit || existing.unit,
            cost: Number.isFinite(draft.cost) ? Number(draft.cost) : existing.cost,
            price: Number.isFinite(draft.price) ? Number(draft.price) : existing.price,
            reorderPoint: Number.isFinite(draft.reorderPoint) ? Number(draft.reorderPoint) : existing.reorderPoint,
            reorderQty: Number.isFinite(draft.reorderQty) ? Number(draft.reorderQty) : existing.reorderQty,
            location: draft.location || existing.location,
            barcode: draft.barcode || existing.barcode,
            supplierId: draft.supplierId ?? existing.supplierId,
          })
          summary.updated += 1
        } else {
          await get().addProduct({
            name,
            sku: draft.sku ?? '',
            barcode: draft.barcode ?? '',
            category: draft.category || 'Divers',
            unit: draft.unit || 'pièce',
            cost: Number(draft.cost) || 0,
            price: Number(draft.price) || 0,
            stock: Number(draft.stock) || 0,
            reorderPoint: Number(draft.reorderPoint) || 0,
            reorderQty: Number(draft.reorderQty) || 10,
            supplierId: draft.supplierId ?? null,
            location: draft.location || '',
            active: true,
          })
          summary.added += 1
        }
      } catch (err) {
        summary.skipped += 1
        summary.errors.push(`Ligne ${index + 2} (${name}) : ${(err as Error).message}`)
      }
    }
    await get().reload()
    return summary
  },

  addMovement: async ({ productId, type, quantity, reason, note, unitCost }) => {
    const viewer = get().viewer
    const product = get().products.find((p) => p.id === productId)
    if (!viewer || !product) return { ok: false, error: 'Produit introuvable.' }
    if (!Number.isFinite(quantity)) return { ok: false, error: 'Quantité invalide.' }

    let delta = 0
    let operationType: 'receipt' | 'issue' | 'inventory' = 'receipt'
    if (type === 'in') {
      if (quantity <= 0) return { ok: false, error: 'La quantité doit être supérieure à zéro.' }
      operationType = 'receipt'
      delta = quantity
    } else if (type === 'out') {
      if (quantity <= 0) return { ok: false, error: 'La quantité doit être supérieure à zéro.' }
      if (quantity > product.stock) {
        return { ok: false, error: `Stock insuffisant : ${product.stock} ${product.unit} disponible(s).` }
      }
      operationType = 'issue'
      delta = -quantity
    } else {
      if (quantity === product.stock) return { ok: false, error: 'Le stock compté est identique au stock actuel.' }
      if (quantity < 0) return { ok: false, error: 'La quantité comptée ne peut pas être négative.' }
      operationType = 'inventory'
      delta = quantity - product.stock
    }

    const locationId = await ensureLocation(viewer.tenantId, get().locations)
    const reference = `${referencePrefix(type)}-${String(Date.now()).slice(-6)}`

    const { data, error } = await supabase.rpc('post_stock_operation', {
      p_tenant_id: viewer.tenantId,
      p_operation_type: operationType,
      p_idempotency_key: newKey(operationType),
      p_reason: [reason, note?.trim()].filter(Boolean).join(' · ').slice(0, 480) || null,
      p_reference: reference,
      p_lines: [{ variant_id: product.variantId, location_id: locationId, quantity_delta: delta }],
      p_reverses_operation_id: null,
    })
    if (error) return { ok: false, error: frenchError(error.message) }

    if (type === 'in' && unitCost && unitCost > 0 && unitCost !== product.cost) {
      // Mise à jour du coût d'achat après réception.
      await supabase
        .rpc('upsert_product', {
          p_tenant_id: viewer.tenantId,
          p_product_id: product.id,
          p_variant_id: product.variantId,
          p_category_id: product.categoryId,
          p_name: product.name,
          p_description: '',
          p_sale_price: product.price,
          p_cost_price: unitCost,
          p_sku: product.sku,
          p_barcode: product.barcode || null,
          p_attributes: {},
          p_active: product.active,
          p_supplier_id: product.supplierId,
          p_unit: product.unit,
          p_reorder_point: product.reorderPoint,
          p_reorder_qty: product.reorderQty,
          p_storage_label: product.location || null,
        })
        .then(({ error: costError }) => {
          if (costError) console.warn('coût non mis à jour', costError.message)
        })
    }

    await get().reload()
    return { ok: true, operationId: data as string }
  },

  undoMovement: async (operationId) => {
    const viewer = get().viewer
    if (!viewer) return { ok: false, error: 'Espace de travail non chargé.' }
    const { error } = await supabase.rpc('post_stock_operation', {
      p_tenant_id: viewer.tenantId,
      p_operation_type: 'reversal',
      p_idempotency_key: newKey('reversal'),
      p_reason: 'Annulation du mouvement',
      p_reference: null,
      p_lines: [],
      p_reverses_operation_id: operationId,
    })
    if (error) return { ok: false, error: frenchError(error.message) }
    await get().reload()
    return { ok: true }
  },

  addSupplier: async (draft) => {
    const viewer = get().viewer
    if (!viewer) throw new Error('Espace de travail non chargé.')
    const { data, error } = await supabase.rpc('save_supplier', {
      p_tenant_id: viewer.tenantId,
      p_supplier_id: null,
      p_name: draft.name.trim(),
      p_contact: draft.contact,
      p_phone: draft.phone,
      p_email: draft.email || null,
      p_city: draft.city,
      p_lead_time_days: draft.leadTimeDays,
      p_notes: draft.notes ?? '',
      p_active: true,
    })
    if (error) throw new Error(frenchError(error.message))
    await get().reload()
    const row = data as { id: string }
    return get().suppliers.find((s) => s.id === row.id) as Supplier
  },

  updateSupplier: async (id, patch) => {
    const viewer = get().viewer
    const supplier = get().suppliers.find((s) => s.id === id)
    if (!viewer || !supplier) throw new Error('Fournisseur introuvable.')
    const next = { ...supplier, ...patch }
    const { error } = await supabase.rpc('save_supplier', {
      p_tenant_id: viewer.tenantId,
      p_supplier_id: id,
      p_name: next.name.trim(),
      p_contact: next.contact,
      p_phone: next.phone,
      p_email: next.email || null,
      p_city: next.city,
      p_lead_time_days: next.leadTimeDays,
      p_notes: next.notes ?? '',
      p_active: true,
    })
    if (error) throw new Error(frenchError(error.message))
    await get().reload()
  },

  deleteSupplier: async (id) => {
    const viewer = get().viewer
    if (!viewer) return { ok: false, error: 'Espace de travail non chargé.' }
    const { error } = await supabase.rpc('delete_supplier', { p_tenant_id: viewer.tenantId, p_supplier_id: id })
    if (error) return { ok: false, error: frenchError(error.message) }
    await get().reload()
    return { ok: true }
  },

  updateSettings: async (patch) => {
    const viewer = get().viewer
    if (!viewer) throw new Error('Espace de travail non chargé.')
    const next = { ...get().settings, ...patch }

    if (patch.userName && patch.userName !== viewer.userName) {
      const { error } = await supabase.from('profiles').update({ full_name: patch.userName.trim() }).eq('id', viewer.userId)
      if (error) throw new Error(frenchError(error.message))
    }

    if (patch.company || patch.currency || patch.phone || patch.address) {
      const { error } = await supabase.rpc('update_tenant_settings', {
        p_tenant_id: viewer.tenantId,
        p_name: next.company.trim(),
        p_currency_code: next.currency,
        p_timezone: viewer.timezone,
        p_address: next.address,
        p_phone: next.phone,
      })
      if (error) throw new Error(frenchError(error.message))
    }

    set({
      settings: next,
      viewer: { ...viewer, userName: next.userName, company: next.company, currency: next.currency, phone: next.phone, address: next.address },
    })
  },

  seedDemo: async () => {
    const viewer = get().viewer
    if (!viewer) throw new Error('Espace de travail non chargé.')
    const { data, error } = await supabase.rpc('seed_demo_data', { p_tenant_id: viewer.tenantId })
    if (error) throw new Error(frenchError(error.message))
    const { data: historyCount, error: historyError } = await supabase.rpc('seed_demo_history', {
      p_tenant_id: viewer.tenantId,
      p_days: 30,
    })
    if (historyError) console.warn('historique démo', historyError.message)
    await get().reload()
    const counts = data as { products: number; suppliers: number }
    return { products: counts.products, movements: Number(historyCount ?? 0) }
  },
}))

async function ensureCategory(tenantId: string, name: string, existing: Category[]): Promise<string | null> {
  const clean = (name || 'Divers').trim() || 'Divers'
  const found = existing.find((c) => c.name.toLowerCase() === clean.toLowerCase())
  if (found) return found.id
  const { data, error } = await supabase.rpc('upsert_category', {
    p_tenant_id: tenantId,
    p_category_id: null,
    p_name: clean,
    p_active: true,
  })
  if (error) throw new Error(frenchError(error.message))
  const row = data as { id: string; name: string }
  useData.setState((state) => ({
    categories: [...state.categories.filter((c) => c.id !== row.id), { id: row.id, name: row.name }],
  }))
  return row.id
}

async function ensureLocation(tenantId: string, locations: Location[]): Promise<string> {
  if (locations.length > 0) {
    const preferred = locations.find((l) => l.name === DEFAULT_LOCATION_NAME) ?? locations[0]
    return preferred.id
  }
  const { data, error } = await supabase.rpc('upsert_stock_location', {
    p_tenant_id: tenantId,
    p_location_id: null,
    p_name: DEFAULT_LOCATION_NAME,
    p_code: 'PRINCIPAL',
    p_active: true,
  })
  if (error) throw new Error(frenchError(error.message))
  const row = data as { id: string; name: string; code: string }
  useData.setState((state) => ({ locations: [...state.locations, { id: row.id, name: row.name, code: row.code }] }))
  return row.id
}

function buildSku(name: string, existing: Product[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 10) || 'ART'
  let candidate = base
  let n = 1
  while (existing.some((p) => p.sku === candidate)) {
    n += 1
    candidate = `${base}-${n}`
  }
  return candidate
}

export function getSupplierName(suppliers: Supplier[], id: string | null | undefined): string {
  if (!id) return '—'
  return suppliers.find((s) => s.id === id)?.name ?? '—'
}

export function productMovements(movements: Movement[], productId: string): Movement[] {
  return movements.filter((m) => m.productId === productId)
}
