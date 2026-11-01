import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'

const mem = new Map()
globalThis.window = { localStorage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } }
globalThis.localStorage = window.localStorage

await esbuild.build({
  entryPoints: [path.join(root, 'src/lib/store.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: '/tmp/kanti-store.mjs',
  logLevel: 'error',
})

const { useData } = await import('/tmp/kanti-store.mjs')
const s = () => useData.getState()
let pass = 0
let fail = 0
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS', label) } else { fail++; console.log('FAIL', label, extra) }
}

const product = s().products.find((p) => p.sku === 'RIZ-25')
const initialStock = product.stock

// sortie
const out = s().addMovement({ productId: product.id, type: 'out', quantity: 5, reason: 'Vente comptoir' })
check('sortie créée', out.ok && out.movement.quantity === 5)
check('stock décrémenté', s().products.find((p) => p.id === product.id).stock === initialStock - 5)
check('mouvement en tête', s().movements[0].productId === product.id && s().movements[0].type === 'out')

// stock insuffisant
const tooMuch = s().addMovement({ productId: product.id, type: 'out', quantity: 999999, reason: 'Vente' })
check('sortie refusée si stock insuffisant', !tooMuch.ok && /insuffisant/i.test(tooMuch.error))

// inventaire
const adj = s().addMovement({ productId: product.id, type: 'adjust', quantity: 12, reason: 'Inventaire physique' })
check('ajustement appliqué', adj.ok && s().products.find((p) => p.id === product.id).stock === 12)
check('quantité ajustement = écart', adj.movement.quantity === Math.abs(12 - (initialStock - 5)))

// annulation
const undo = s().undoMovement(adj.movement.id)
check('annulation restaure le stock', undo.ok && s().products.find((p) => p.id === product.id).stock === initialStock - 5)

// création produit + SKU auto
const created = s().addProduct({ name: 'Thé à la menthe 250 g', sku: '', barcode: '', category: 'Boissons', unit: 'paquet', cost: 500, price: 800, stock: 0, reorderPoint: 5, reorderQty: 10, supplierId: null, location: 'Test', active: true })
check('SKU généré', created.sku === 'THE-A-MENT' || created.sku.length > 0, created.sku)

// import
const imported = s().importProducts([
  { name: 'Produit importé', sku: 'IMP-1', cost: 1000, price: 1500, stock: 4, reorderPoint: 2 },
  { name: 'Riz parfumé 25 kg', sku: 'RIZ-25', stock: 55 },
  { name: '', sku: 'X' },
])
check('import ajout + update', imported.added === 1 && imported.updated === 1 && imported.skipped === 1, JSON.stringify(imported))
check('import met à jour le stock existant', s().products.find((p) => p.sku === 'RIZ-25').stock === 55)

// fournisseur lié
const supplier = s().suppliers[0]
const delLinked = s().deleteSupplier(supplier.id)
check('suppression fournisseur lié bloquée', !delLinked.ok)

// reset
s().resetDemo()
check('reset restaure la démo', s().products.length === 33 && s().movements.length > 100)

console.log(`\n${pass} passés, ${fail} échoués`)
process.exit(fail ? 1 : 0)
