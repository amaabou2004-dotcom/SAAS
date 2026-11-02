export type MovementType = 'in' | 'out' | 'adjust'

export type Supplier = {
  id: string
  name: string
  contact: string
  phone: string
  email?: string
  city: string
  leadTimeDays: number
  notes?: string
  createdAt: string
}

export type Product = {
  id: string
  variantId: string
  categoryId: string | null
  sku: string
  barcode: string
  name: string
  category: string
  unit: string
  cost: number
  price: number
  stock: number
  reorderPoint: number
  reorderQty: number
  supplierId: string | null
  location: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Movement = {
  id: string
  operationId: string
  productId: string
  type: MovementType
  quantity: number
  stockBefore: number
  stockAfter: number
  unitCost: number
  reason: string
  note?: string
  reference?: string
  user: string
  at: string
}

export type Settings = {
  company: string
  userName: string
  currency: string
  role: string
  phone: string
  address: string
}

export type StockStatus = 'out' | 'low' | 'ok'

export type ImportSummary = {
  added: number
  updated: number
  skipped: number
  errors: string[]
}
