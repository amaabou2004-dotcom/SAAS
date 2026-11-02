import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'

await esbuild.build({
  entryPoints: [path.join(root, 'src/lib/analytics.ts'), path.join(root, 'src/lib/csv.ts'), path.join(root, 'src/lib/format.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: '/tmp/kanti-logic',
  logLevel: 'error',
})

const analytics = await import('/tmp/kanti-logic/analytics.js')
const csv = await import('/tmp/kanti-logic/csv.js')
const format = await import('/tmp/kanti-logic/format.js')

let pass = 0
let fail = 0
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS', label) }
  else { fail++; console.log('FAIL', label, extra) }
}

const day = 86_400_000
const now = Date.now()
const product = (id, over = {}) => ({
  id, variantId: `v-${id}`, categoryId: null, sku: `SKU-${id}`, barcode: `61900000000${id}`,
  name: `Produit ${id}`, category: 'Alimentation', unit: 'pièce', cost: 1000, price: 1500,
  stock: 10, reorderPoint: 5, reorderQty: 20, supplierId: 's1', location: 'A1', active: true,
  createdAt: new Date(now - 100 * day).toISOString(), updatedAt: new Date(now).toISOString(), ...over,
})
const movement = (id, productId, type, quantity, daysAgo = 1, operationId = `op-${id}`) => ({
  id, operationId, productId, type, quantity,
  stockBefore: 10, stockAfter: type === 'in' ? 10 + quantity : 10 - quantity,
  unitCost: 1000, reason: type === 'in' ? 'Réception fournisseur' : 'Vente comptoir',
  user: 'Moussa', at: new Date(now - daysAgo * day).toISOString(),
})

const products = [
  product(1, { stock: 0, reorderPoint: 5 }),
  product(2, { stock: 3, reorderPoint: 10, reorderQty: 25 }),
  product(3, { stock: 50 }),
  product(4, { stock: 8, reorderPoint: 4 }),
]
const movements = [
  movement(1, 2, 'out', 4, 3),
  movement(2, 2, 'out', 6, 1),
  movement(3, 3, 'out', 10, 2),
  movement(4, 4, 'in', 8, 5),
  movement(5, 1, 'out', 2, 40),
]

const stats = analytics.inventoryStats(products)
check('valeur du stock au prix d’achat', stats.costValue === 61 * 1000, String(stats.costValue))
check('ruptures et alertes', stats.out === 1 && stats.low === 1 && stats.alerts === 2, JSON.stringify(stats))

const alerts = analytics.buildAlertLines(products, [{ id: 's1', name: 'Fournisseur', contact: '', phone: '', city: '', leadTimeDays: 5, createdAt: '' }], movements)
check('alertes triées ruptures d’abord', alerts[0].status === 'out' && alerts.length === 2)
check('quantité suggérée >= quantité de réappro', alerts.every((a) => a.suggestedQty >= 25 || a.suggestedQty >= a.product.reorderQty))
check('couverture calculée sur les ventes', alerts.find((a) => a.product.id === 2)?.coverageDays !== null)

const flow = analytics.dailyFlow(movements, 7)
check('flux sur 7 jours', flow.length === 7 && flow.reduce((s, d) => s + d.outbound, 0) === 20, JSON.stringify(flow.map((f) => f.outbound)))

const top = analytics.topMoving(products, movements, 30, 3)
check('top produits trié par quantité', top[0].qty === 10 && top.some((t) => t.product.id === 3), JSON.stringify(top.map((t) => [t.product.id, t.qty])))

const dormant = analytics.dormantProducts(products, movements, 45)
check('produit sans sortie = dormant', dormant.some((p) => p.id === 4), JSON.stringify(dormant.map((p) => p.id)))
const dormant30 = analytics.dormantProducts(products, movements, 30)
check('les produits sans stock sont exclus des dormants', dormant30.every((p) => p.stock > 0), JSON.stringify(dormant30.map((p) => p.id)))

const groups = analytics.orderLinesBySupplier(alerts)
check('regroupement par fournisseur', groups.length === 1 && groups[0].lines.length === 2)

check('statut rupture', format.stockStatus(products[0]) === 'out')
check('statut stock bas', format.stockStatus(products[1]) === 'low')
check('marge produit', Math.round(format.marginPercent(products[2])) === 33)
check('monnaie FCFA sans décimales', format.formatMoney(1500, 'XOF').replace(/\u202f|\u00a0/g, ' ') === '1 500 F CFA', format.formatMoney(1500, 'XOF'))

// CSV
const parsed = csv.parseDelimited('SKU;Nom;Stock\nRIZ-25;Riz 25 kg;40\n"TOMATE;70";Tomate;12')
check('parse CSV avec séparateur ; et guillemets', parsed.length === 3 && parsed[2][0] === 'TOMATE;70')
const importDrafts = csv.parseProductsCSV('code;designation;prix achat;prix vente;quantite;seuil\nABC;Produit test;1000;1500;7;3', [])
check('import CSV : alias d’en-têtes reconnus', importDrafts.drafts[0].sku === 'ABC' && importDrafts.drafts[0].stock === 7 && importDrafts.drafts[0].cost === 1000)
check('import CSV : lignes sans nom ignorées', csv.parseProductsCSV('Nom;Stock\n;5\nOk;2', []).skipped === 1)
check('export CSV échappe les guillemets', csv.toCSV(['A'], [['x"y']]).includes('"x""y"'))

console.log(`\n${pass} passés, ${fail} échoués`)
process.exit(fail ? 1 : 0)
