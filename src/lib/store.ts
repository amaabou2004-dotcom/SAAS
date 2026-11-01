import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ImportSummary, Movement, MovementType, Product, Settings, Supplier } from './types'
import { buildSeedMovements, seedProducts, seedSettings, seedSuppliers } from './seed'
import { uid } from './format'

export type ProductDraft = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

type MovementInput = {
  productId: string
  type: MovementType
  quantity: number
  reason: string
  note?: string
  unitCost?: number
}

type ActionResult = { ok: boolean; error?: string; movement?: Movement }

type DataState = {
  products: Product[]
  suppliers: Supplier[]
  movements: Movement[]
  settings: Settings
  addProduct: (draft: ProductDraft) => Product
  updateProduct: (id: string, patch: Partial<Product>) => void
  deleteProduct: (id: string) => void
  importProducts: (drafts: Partial<ProductDraft>[]) => ImportSummary
  addMovement: (input: MovementInput) => ActionResult
  undoMovement: (id: string) => ActionResult
  addSupplier: (draft: Omit<Supplier, 'id' | 'createdAt'>) => Supplier
  updateSupplier: (id: string, patch: Partial<Supplier>) => void
  deleteSupplier: (id: string) => { ok: boolean; error?: string }
  updateSettings: (patch: Partial<Settings>) => void
  resetDemo: () => void
  restoreBackup: (payload: unknown) => { ok: boolean; error?: string }
}

function freshDemo() {
  const products = seedProducts.map((p) => ({ ...p }))
  return {
    products,
    suppliers: seedSuppliers.map((s) => ({ ...s })),
    movements: buildSeedMovements(products),
    settings: { ...seedSettings },
  }
}

function makeSku(name: string, existing: Product[]): string {
  const base = name
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

function referenceFor(type: MovementType, existingCount: number): string {
  const prefix = type === 'in' ? 'ENT' : type === 'out' ? 'SOR' : 'INV'
  return `${prefix}-${String(1200 + existingCount).padStart(5, '0')}`
}

const initial = freshDemo()

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      ...initial,

      addProduct: (draft) => {
        const now = new Date().toISOString()
        const product: Product = {
          ...draft,
          id: uid('p-'),
          sku: draft.sku?.trim() || makeSku(draft.name, get().products),
          barcode: draft.barcode?.trim() || '',
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ products: [product, ...state.products] }))
        return product
      },

      updateProduct: (id, patch) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...patch, id: p.id, updatedAt: new Date().toISOString() } : p,
          ),
        })),

      deleteProduct: (id) =>
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
          movements: state.movements.filter((m) => m.productId !== id),
        })),

      importProducts: (drafts) => {
        const summary: ImportSummary = { added: 0, updated: 0, skipped: 0, errors: [] }
        const products = [...get().products]
        const now = new Date().toISOString()

        drafts.forEach((draft, index) => {
          const name = draft.name?.trim()
          if (!name) {
            summary.skipped += 1
            summary.errors.push(`Ligne ${index + 2} : nom manquant`)
            return
          }
          const sku = draft.sku?.trim().toUpperCase()
          const existing = sku ? products.find((p) => p.sku.toUpperCase() === sku) : undefined
          if (existing) {
            const updated: Product = {
              ...existing,
              name,
              category: draft.category || existing.category,
              unit: draft.unit || existing.unit,
              cost: Number.isFinite(draft.cost) ? Number(draft.cost) : existing.cost,
              price: Number.isFinite(draft.price) ? Number(draft.price) : existing.price,
              stock: Number.isFinite(draft.stock) ? Number(draft.stock) : existing.stock,
              reorderPoint: Number.isFinite(draft.reorderPoint) ? Number(draft.reorderPoint) : existing.reorderPoint,
              reorderQty: Number.isFinite(draft.reorderQty) ? Number(draft.reorderQty) : existing.reorderQty,
              location: draft.location || existing.location,
              barcode: draft.barcode || existing.barcode,
              updatedAt: now,
            }
            const idx = products.findIndex((p) => p.id === existing.id)
            products[idx] = updated
            summary.updated += 1
          } else {
            products.push({
              id: uid('p-'),
              name,
              sku: sku || makeSku(name, products),
              barcode: draft.barcode || '',
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
              createdAt: now,
              updatedAt: now,
            })
            summary.added += 1
          }
        })

        set({ products })
        return summary
      },

      addMovement: ({ productId, type, quantity, reason, note, unitCost }) => {
        const product = get().products.find((p) => p.id === productId)
        if (!product) return { ok: false, error: 'Produit introuvable.' }
        if (!Number.isFinite(quantity)) return { ok: false, error: 'Quantité invalide.' }
        if (type !== 'adjust' && quantity <= 0) return { ok: false, error: 'La quantité doit être supérieure à zéro.' }

        let stockAfter = product.stock
        if (type === 'in') stockAfter = product.stock + quantity
        if (type === 'out') {
          if (quantity > product.stock) {
            return {
              ok: false,
              error: `Stock insuffisant : ${product.stock} ${product.unit} disponible(s).`,
            }
          }
          stockAfter = product.stock - quantity
        }
        if (type === 'adjust') {
          if (quantity === product.stock) return { ok: false, error: 'Le stock compté est identique au stock actuel.' }
          stockAfter = quantity
        }

        const movement: Movement = {
          id: uid('m-'),
          productId,
          type,
          quantity: type === 'adjust' ? Math.abs(quantity - product.stock) : quantity,
          stockBefore: product.stock,
          stockAfter,
          unitCost: type === 'in' && unitCost && unitCost > 0 ? unitCost : product.cost,
          reason,
          note: note?.trim() || undefined,
          reference: referenceFor(type, get().movements.length),
          user: get().settings.userName || 'Utilisateur',
          at: new Date().toISOString(),
        }

        set((state) => ({
          movements: [movement, ...state.movements],
          products: state.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  stock: stockAfter,
                  cost: type === 'in' && unitCost && unitCost > 0 ? unitCost : p.cost,
                  updatedAt: movement.at,
                }
              : p,
          ),
        }))
        return { ok: true, movement }
      },

      undoMovement: (id) => {
        const movement = get().movements.find((m) => m.id === id)
        if (!movement) return { ok: false, error: 'Mouvement introuvable.' }
        const product = get().products.find((p) => p.id === movement.productId)
        if (!product) return { ok: false, error: 'Produit introuvable.' }
        const restored = Math.max(0, product.stock + (movement.stockBefore - movement.stockAfter))
        set((state) => ({
          movements: state.movements.filter((m) => m.id !== id),
          products: state.products.map((p) =>
            p.id === product.id ? { ...p, stock: restored, updatedAt: new Date().toISOString() } : p,
          ),
        }))
        return { ok: true }
      },

      addSupplier: (draft) => {
        const supplier: Supplier = { ...draft, id: uid('s-'), createdAt: new Date().toISOString() }
        set((state) => ({ suppliers: [supplier, ...state.suppliers] }))
        return supplier
      },

      updateSupplier: (id, patch) =>
        set((state) => ({
          suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)),
        })),

      deleteSupplier: (id) => {
        if (get().products.some((p) => p.supplierId === id)) {
          return { ok: false, error: 'Ce fournisseur est lié à des produits. Réaffectez-les avant de le supprimer.' }
        }
        set((state) => ({ suppliers: state.suppliers.filter((s) => s.id !== id) }))
        return { ok: true }
      },

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      resetDemo: () => set(freshDemo()),

      restoreBackup: (payload) => {
        if (!payload || typeof payload !== 'object') return { ok: false, error: 'Fichier de sauvegarde invalide.' }
        const data = payload as { products?: unknown; suppliers?: unknown; movements?: unknown; settings?: unknown }
        if (!Array.isArray(data.products) || !Array.isArray(data.movements) || !Array.isArray(data.suppliers)) {
          return { ok: false, error: 'La sauvegarde doit contenir les produits, fournisseurs et mouvements.' }
        }
        set({
          products: data.products as Product[],
          suppliers: data.suppliers as Supplier[],
          movements: data.movements as Movement[],
          settings: { ...get().settings, ...((data.settings as Partial<Settings>) || {}) },
        })
        return { ok: true }
      },
    }),
    {
      name: 'kanti-stock-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        products: state.products,
        suppliers: state.suppliers,
        movements: state.movements,
        settings: state.settings,
      }),
    },
  ),
)

export function getSupplierName(suppliers: Supplier[], id: string | null | undefined): string {
  if (!id) return '—'
  return suppliers.find((s) => s.id === id)?.name ?? '—'
}

export function productMovements(movements: Movement[], productId: string): Movement[] {
  return movements.filter((m) => m.productId === productId)
}
