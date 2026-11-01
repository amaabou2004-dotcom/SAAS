import type { Movement, Product, Supplier } from './types'
import type { ProductDraft } from './store'
import { formatDate, stockStatus } from './format'

function escapeCell(value: string | number | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value)
  if (/[";\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function toCSV(headers: string[], rows: (string | number | undefined | null)[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n')
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['\ufeff' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function stamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function exportProductsCSV(products: Product[], suppliers: Supplier[]): void {
  const headers = [
    'SKU',
    'Code-barres',
    'Nom',
    'Catégorie',
    'Unité',
    'Prix achat',
    'Prix vente',
    'Stock',
    'Seuil alerte',
    'Qté réappro',
    'Fournisseur',
    'Emplacement',
    'Statut',
  ]
  const rows = products.map((p) => [
    p.sku,
    p.barcode,
    p.name,
    p.category,
    p.unit,
    p.cost,
    p.price,
    p.stock,
    p.reorderPoint,
    p.reorderQty,
    suppliers.find((s) => s.id === p.supplierId)?.name ?? '',
    p.location,
    stockStatus(p) === 'out' ? 'Rupture' : stockStatus(p) === 'low' ? 'Sous seuil' : 'OK',
  ])
  downloadFile(`kanti-produits-${stamp()}.csv`, toCSV(headers, rows))
}

export function exportMovementsCSV(movements: Movement[], products: Product[]): void {
  const headers = ['Date', 'Référence', 'Type', 'Produit', 'SKU', 'Quantité', 'Unité', 'Motif', 'Stock après', 'Utilisateur', 'Note']
  const rows = movements.map((m) => {
    const p = products.find((x) => x.id === m.productId)
    const label = m.type === 'in' ? 'Entrée' : m.type === 'out' ? 'Sortie' : 'Ajustement'
    return [
      formatDate(m.at, true),
      m.reference ?? '',
      label,
      p?.name ?? 'Produit supprimé',
      p?.sku ?? '',
      m.quantity,
      p?.unit ?? '',
      m.reason,
      m.stockAfter,
      m.user,
      m.note ?? '',
    ]
  })
  downloadFile(`kanti-mouvements-${stamp()}.csv`, toCSV(headers, rows))
}

export function exportOrderCSV(
  lines: { product: Product; qty: number }[],
  supplierName: string,
): void {
  const headers = ['Fournisseur', 'Produit', 'SKU', 'Stock actuel', 'Seuil', 'Qté à commander', 'PA unitaire', 'Total']
  const rows = lines.map(({ product, qty }) => [
    supplierName,
    product.name,
    product.sku,
    product.stock,
    product.reorderPoint,
    qty,
    product.cost,
    qty * product.cost,
  ])
  downloadFile(`kanti-commande-${stamp()}.csv`, toCSV(headers, rows))
}

function detectDelimiter(line: string): string {
  const candidates = [';', ',', '\t']
  let best = ';'
  let bestCount = -1
  for (const c of candidates) {
    const count = line.split(c).length
    if (count > bestCount) {
      best = c
      bestCount = count
    }
  }
  return best
}

export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').trim()
  if (!clean) return []
  const firstLine = clean.split('\n')[0]
  const delimiter = detectDelimiter(firstLine)

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

const HEADER_ALIASES: Record<string, string> = {
  sku: 'sku',
  code: 'sku',
  reference: 'sku',
  ref: 'sku',
  codebarres: 'barcode',
  codebarre: 'barcode',
  ean: 'barcode',
  barcode: 'barcode',
  nom: 'name',
  produit: 'name',
  designation: 'name',
  name: 'name',
  categorie: 'category',
  category: 'category',
  famille: 'category',
  unite: 'unit',
  unit: 'unit',
  prixachat: 'cost',
  pa: 'cost',
  cout: 'cost',
  cost: 'cost',
  prixvente: 'price',
  pv: 'price',
  prix: 'price',
  price: 'price',
  stock: 'stock',
  quantite: 'stock',
  qte: 'stock',
  seuil: 'reorderPoint',
  seuilalerte: 'reorderPoint',
  stockmin: 'reorderPoint',
  reorderpoint: 'reorderPoint',
  qtéreappro: 'reorderQty',
  qtereappro: 'reorderQty',
  quantitereappro: 'reorderQty',
  reorderqty: 'reorderQty',
  reappro: 'reorderQty',
  fournisseur: 'supplier',
  supplier: 'supplier',
  emplacement: 'location',
  location: 'location',
  rayon: 'location',
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/\s/g, '').replace(/[^\d,.-]/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

export function parseProductsCSV(
  text: string,
  suppliers: Supplier[],
): { drafts: Partial<ProductDraft>[]; skipped: number } {
  const rows = parseDelimited(text)
  if (rows.length < 2) return { drafts: [], skipped: 0 }
  const headers = rows[0].map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? '')
  const drafts: Partial<ProductDraft>[] = []
  let skipped = 0

  for (const row of rows.slice(1)) {
    if (row.every((c) => c.trim() === '')) continue
    const raw: Record<string, string> = {}
    headers.forEach((key, index) => {
      if (key) raw[key] = (row[index] ?? '').trim()
    })
    if (!raw.name) {
      skipped += 1
      continue
    }
    const supplierName = raw.supplier?.toLowerCase()
    const supplier = supplierName
      ? suppliers.find((s) => s.name.toLowerCase() === supplierName || s.name.toLowerCase().includes(supplierName))
      : undefined
    drafts.push({
      name: raw.name,
      sku: raw.sku,
      barcode: raw.barcode,
      category: raw.category || 'Divers',
      unit: raw.unit || 'pièce',
      cost: toNumber(raw.cost) ?? 0,
      price: toNumber(raw.price) ?? 0,
      stock: toNumber(raw.stock) ?? 0,
      reorderPoint: toNumber(raw.reorderPoint) ?? 0,
      reorderQty: toNumber(raw.reorderQty) ?? 10,
      location: raw.location || '',
      supplierId: supplier?.id ?? null,
    })
  }

  return { drafts, skipped }
}
