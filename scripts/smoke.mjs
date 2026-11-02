import { JSDOM } from 'jsdom'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..'

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.localStorage = window.localStorage
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.SVGElement = window.SVGElement
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = globalThis.ResizeObserver
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
globalThis.matchMedia = window.matchMedia
window.scrollTo = () => {}
window.confirm = () => true

const errors = []
const originalError = console.error
console.error = (...args) => {
  const message = args.map(String).join(' ')
  if (/width\(0\) and height\(0\)|not wrapped in act|Warning: ReactDOM/.test(message)) return
  errors.push(message)
  originalError(...args)
}

// Authentification simulée : les tests de rendu ne parlent pas au réseau.
const mockAuth = path.join(root, 'scripts/mocks/auth.tsx')
const authAlias = {
  name: 'mock-auth',
  setup(build) {
    build.onResolve({ filter: /lib\/auth$/ }, () => ({ path: mockAuth }))
  },
}

await esbuild.build({
  entryPoints: [path.join(root, 'scripts/smoke-entry.tsx')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: '/tmp/kanti-smoke-app.mjs',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx' },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.VITE_SUPABASE_URL': '"http://localhost:54321"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-key"',
  },
  logLevel: 'error',
  plugins: [authAlias],
})

const app = await import('/tmp/kanti-smoke-app.mjs')
const { renderAt, renderAuth, renderOnboarding, useUI, useScanner, useData } = app

// ---- Jeu de données de rendu (le store est un cache : on l'alimente directement) ----
const day = 86_400_000
const now = Date.now()
const iso = (daysAgo) => new Date(now - daysAgo * day).toISOString()
const suppliers = [
  { id: 's1', name: 'Grand Marché Distribution', contact: 'Abdou', phone: '+227 90 12 34 56', email: 'gmd@test.ne', city: 'Niamey', leadTimeDays: 3, notes: 'Livraison lundi', createdAt: iso(120) },
  { id: 's2', name: 'Niger Boissons SA', contact: 'Fatima', phone: '+227 96 44 21 10', email: '', city: 'Niamey', leadTimeDays: 2, notes: '', createdAt: iso(90) },
]
const rows = [
  ['p1', 'RIZ-25', 'Riz parfumé 25 kg', 'Céréales & farines', 'sac', 17500, 19500, 0, 20, 40, 's1'],
  ['p2', 'MIL-50', 'Mil local 50 kg', 'Céréales & farines', 'sac', 22000, 25000, 8, 12, 25, 's1'],
  ['p3', 'EAU-15L', 'Eau minérale 1,5 L', 'Boissons', 'pack', 1400, 1800, 95, 50, 100, 's2'],
  ['p4', 'SAVON-MAR', 'Savon de Marseille 400 g', 'Hygiène', 'pièce', 350, 500, 180, 100, 200, 's2'],
  ['p5', 'PATES-500', 'Pâtes alimentaires 500 g', 'Alimentation', 'paquet', 450, 600, 210, 100, 150, 's1'],
]
const products = rows.map(([id, sku, name, category, unit, cost, price, stock, reorderPoint, reorderQty, supplierId], index) => ({
  id, variantId: `v-${id}`, categoryId: null, sku, barcode: `61912345000${index + 11}`,
  name, category, unit, cost, price, stock, reorderPoint, reorderQty, supplierId,
  location: `Rayon ${index + 1}`, active: true, createdAt: iso(60), updatedAt: iso(index),
}))
const movements = [
  { id: 'm1', operationId: 'op1', productId: 'p2', type: 'out', quantity: 4, stockBefore: 12, stockAfter: 8, unitCost: 22000, reason: 'Vente comptoir', reference: 'VTE-1001', user: 'Moussa', at: iso(0) },
  { id: 'm2', operationId: 'op2', productId: 'p3', type: 'out', quantity: 10, stockBefore: 105, stockAfter: 95, unitCost: 1400, reason: 'Vente boutique', reference: 'VTE-1002', user: 'Moussa', at: iso(1) },
  { id: 'm3', operationId: 'op3', productId: 'p5', type: 'in', quantity: 60, stockBefore: 150, stockAfter: 210, unitCost: 450, reason: 'Réception fournisseur', reference: 'REC-501', user: 'Aïcha', at: iso(2) },
  { id: 'm4', operationId: 'op4', productId: 'p4', type: 'out', quantity: 20, stockBefore: 200, stockAfter: 180, unitCost: 350, reason: 'Livraison client', reference: 'VTE-1003', user: 'Ibrahim', at: iso(3) },
  { id: 'm5', operationId: 'op5', productId: 'p1', type: 'adjust', quantity: 3, stockBefore: 3, stockAfter: 0, unitCost: 17500, reason: 'Inventaire physique', reference: 'INV-1201', user: 'Moussa', at: iso(4) },
]

useData.setState({
  ready: true,
  loading: false,
  error: null,
  viewer: {
    tenantId: 'tenant-1', userId: 'test-user', userName: 'Moussa Démo', roleName: 'Propriétaire',
    company: 'Kanti Démo SARL', currency: 'XOF', timezone: 'Africa/Niamey', phone: '+227 90 00 00 00', address: 'Niamey',
  },
  products: products.map((p) => ({ ...p })),
  suppliers: suppliers.map((s) => ({ ...s })),
  movements: movements.map((m) => ({ ...m })),
  categories: [],
  locations: [{ id: 'loc-1', name: 'Dépôt principal', code: 'PRINCIPAL' }],
  settings: { company: 'Kanti Démo SARL', userName: 'Moussa Démo', currency: 'XOF', role: 'Propriétaire', phone: '+227 90 00 00 00', address: 'Niamey' },
})

let failures = 0
const check = (label, cond, extra = '') => {
  if (!cond) { failures++; console.log('FAIL', label, extra); return }
  console.log('PASS', label)
}

// ---- Rendu des écrans ----
const cases = [
  ['/', 'Bonjour Moussa'],
  ['/stock', 'Riz parfumé 25 kg'],
  ['/mouvements', 'Mouvements'],
  ['/alertes', 'Alertes de stock'],
  ['/rapports', 'Rapports'],
  ['/fournisseurs', 'Grand Marché Distribution'],
  ['/reglages', 'Réglages'],
]
for (const [route, expected] of cases) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = renderAt(route, el)
  await new Promise((r) => setTimeout(r, 260))
  const text = el.textContent || ''
  check(`écran ${route}`, text.includes(expected), `${text.length} caractères rendus`)
  root.unmount()
  el.remove()
}

// ---- Modales ----
const el = document.createElement('div')
document.body.appendChild(el)
const modalRoot = renderAt('/', el)
const wait = (ms = 240) => new Promise((r) => setTimeout(r, ms))
const bodyHas = (needle) => (document.body.textContent || '').includes(needle)
const product = useData.getState().products[1]

const modals = [
  ['formulaire produit', () => useUI.getState().openProductForm(), 'Nouveau produit'],
  ['modification produit', () => useUI.getState().openProductForm({ productId: product.id }), 'Modifier le produit'],
  ['mouvement prérempli', () => useUI.getState().openMovementForm({ productId: product.id, type: 'out' }), 'Mouvement de stock'],
  ['fiche produit', () => useUI.getState().openDetail(product.id), product.name],
  ['bon de commande', () => useUI.getState().openOrder(), 'Générer un bon de commande'],
  ['palette de recherche', () => useScanner.getState().openPalette(), 'À traiter en priorité'],
  ['scanner', () => useScanner.getState().openScanner(), 'Scanner un produit'],
  ['guide « Comment ça marche »', () => useUI.getState().openHelp(), 'Je crée mes produits'],
]
for (const [label, open, expected] of modals) {
  open()
  await wait()
  check(`modale ${label}`, bodyHas(expected))
}

// Interactions sans réseau : saisie de quantité et contrôle de stock
useUI.getState().closeProductForm()
useUI.getState().closeDetail()
useScanner.getState().closePalette()
useUI.getState().closeHelp()
useScanner.getState().closeScanner()
useUI.getState().closeOrder()
useUI.getState().openMovementForm({ productId: product.id, type: 'out' })
await wait()
const qtyInput = [...document.querySelectorAll('input')].find((input) => input.getAttribute('inputmode') === 'decimal')
check('champ quantité présent', Boolean(qtyInput))
if (qtyInput) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(qtyInput, '999')
  qtyInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  await wait(120)
  check('alerte stock insuffisant côté client', bodyHas('Quantité supérieure au stock disponible'))
  const validate = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Valider'))
  check('validation désactivée si stock insuffisant', Boolean(validate?.disabled))
}
modalRoot.unmount()
el.remove()

// ---- Écrans d'authentification ----
const authCases = [
  ['signin', 'Content de vous revoir'],
  ['signup', 'Créer votre compte'],
  ['forgot', 'Mot de passe oublié'],
  ['reset', 'Nouveau mot de passe'],
]
for (const [mode, expected] of authCases) {
  const node = document.createElement('div')
  document.body.appendChild(node)
  const authRoot = renderAuth(mode, node)
  await wait()
  check(`écran auth ${mode}`, (node.textContent || '').includes(expected))
  if (mode === 'signin') check('bouton « Entrer dans la démo »', (node.textContent || '').includes('Entrer dans la démo'))
  authRoot.unmount()
  node.remove()
}

const onboardingEl = document.createElement('div')
document.body.appendChild(onboardingEl)
const onboardingRoot = renderOnboarding(onboardingEl)
await wait()
check('écran onboarding', (onboardingEl.textContent || '').includes('Créez votre espace de travail'))
onboardingRoot.unmount()
onboardingEl.remove()

if (errors.length) {
  console.log(`\n${errors.length} erreur(s) console :`)
  errors.slice(0, 10).forEach((error) => console.log(' -', error.slice(0, 300)))
  failures += errors.length
}

console.log(failures === 0 ? '\nSMOKE OK' : `\n${failures} problème(s)`)
process.exit(failures === 0 ? 0 : 1)

