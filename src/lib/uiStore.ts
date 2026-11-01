import { create } from 'zustand'
import type { MovementType, Product } from './types'
import { uid } from './format'

export type Tone = 'success' | 'error' | 'info'
export type Toast = { id: string; message: string; tone: Tone; actionLabel?: string; onAction?: () => void }

type FormState<T> = { open: boolean } & T

type UIState = {
  toasts: Toast[]
  toast: (message: string, tone?: Tone, action?: { label: string; onClick: () => void }) => void
  dismissToast: (id: string) => void

  productForm: FormState<{ productId?: string; defaults?: Partial<Product> }>
  openProductForm: (opts?: { productId?: string; defaults?: Partial<Product> }) => void
  closeProductForm: () => void

  movementForm: FormState<{ productId?: string; type?: MovementType }>
  openMovementForm: (opts?: { productId?: string; type?: MovementType }) => void
  closeMovementForm: () => void

  detailProductId: string | null
  openDetail: (id: string) => void
  closeDetail: () => void

  supplierForm: FormState<{ supplierId?: string }>
  openSupplierForm: (opts?: { supplierId?: string }) => void
  closeSupplierForm: () => void

  orderOpen: boolean
  orderSupplierId: string | null
  openOrder: (supplierId?: string | null) => void
  closeOrder: () => void
}

export const useUI = create<UIState>((set) => ({
  toasts: [],
  toast: (message, tone = 'success', action) => {
    const id = uid('t-')
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone, actionLabel: action?.label, onAction: action?.onClick }],
    }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4200)
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  productForm: { open: false },
  openProductForm: (opts) => set({ productForm: { open: true, productId: opts?.productId, defaults: opts?.defaults } }),
  closeProductForm: () => set({ productForm: { open: false } }),

  movementForm: { open: false },
  openMovementForm: (opts) => set({ movementForm: { open: true, productId: opts?.productId, type: opts?.type } }),
  closeMovementForm: () => set({ movementForm: { open: false } }),

  detailProductId: null,
  openDetail: (id) => set({ detailProductId: id }),
  closeDetail: () => set({ detailProductId: null }),

  supplierForm: { open: false },
  openSupplierForm: (opts) => set({ supplierForm: { open: true, supplierId: opts?.supplierId } }),
  closeSupplierForm: () => set({ supplierForm: { open: false } }),

  orderOpen: false,
  orderSupplierId: null,
  openOrder: (supplierId = null) => set({ orderOpen: true, orderSupplierId: supplierId }),
  closeOrder: () => set({ orderOpen: false, orderSupplierId: null }),
}))

