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
globalThis.IS_REACT_ACT_ENVIRONMENT = false

const errors = []
const origError = console.error
console.error = (...args) => {
  errors.push(args.map(String).join(' '))
  origError(...args)
}

await esbuild.build({
  entryPoints: [path.join(root, 'scripts/smoke-entry.tsx')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: '/tmp/kanti-smoke-app.mjs',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'error',
})

const { renderAt, useUI, useScanner, useData } = await import('/tmp/kanti-smoke-app.mjs')

const cases = [
  ['/', 'Bonjour Moussa'],
  ['/stock', 'Stock'],
  ['/mouvements', 'Mouvements'],
  ['/alertes', 'Alertes de stock'],
  ['/rapports', 'Rapports'],
  ['/fournisseurs', 'Fournisseurs'],
  ['/reglages', 'Réglages'],
]

let failures = 0
for (const [route, expected] of cases) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = renderAt(route, el)
  await new Promise((r) => setTimeout(r, 350))
  const text = el.textContent || ''
  const ok = text.includes(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${route} (${text.length} car.) ${ok ? '' : `— "${expected}" introuvable`}`)
  root.unmount()
  el.remove()
}

// ---- Modales ----
const modalEl = document.createElement('div')
document.body.appendChild(modalEl)
const modalRoot = renderAt('/', modalEl)
const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms))
const has = (needle) => (document.body.textContent || '').includes(needle)
const check = (label, cond) => {
  if (!cond) failures++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}`)
}
const product = useData.getState().products[0]

const modalCases = [
  ['formulaire création produit', () => useUI.getState().openProductForm(), 'Nouveau produit'],
  ['formulaire modification produit', () => useUI.getState().openProductForm({ productId: product.id }), 'Modifier le produit'],
  ['mouvement avec produit', () => useUI.getState().openMovementForm({ productId: product.id, type: 'out' }), 'Mouvement de stock'],
  ['fiche produit', () => useUI.getState().openDetail(product.id), product.name],
  ['bon de commande', () => useUI.getState().openOrder(), 'Générer un bon de commande'],
  ['palette de recherche', () => useScanner.getState().openPalette(), 'À traiter en priorité'],
  ['scanner', () => useScanner.getState().openScanner(), 'Scanner un produit'],
]
for (const [label, open, expected] of modalCases) {
  open()
  await wait()
  const ok = has(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — "${expected}" introuvable`}`)
}
useUI.getState().closeProductForm()
useUI.getState().closeMovementForm()
useUI.getState().closeDetail()
useScanner.getState().closeScanner()
useScanner.getState().closePalette()
useUI.getState().closeOrder()
await wait()
modalRoot.unmount()
modalEl.remove()

// ---- Parcours : sortie de stock puis annulation via la notification ----
useData.getState().resetDemo()
const flowEl = document.createElement('div')
document.body.appendChild(flowEl)
const flowRoot = renderAt('/', flowEl)
await wait()
const sold = useData.getState().products.find((x) => x.sku === 'RIZ-25')
const startStock = sold.stock
useUI.getState().openMovementForm({ productId: sold.id, type: 'out' })
await wait()

const qtyInput = [...document.querySelectorAll('input')].find((i) => i.getAttribute('inputmode') === 'decimal')
check('champ quantité présent', Boolean(qtyInput))
if (qtyInput) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(qtyInput, '3')
  qtyInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  await wait(80)
  const validate = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Valider'))
  check('bouton de validation présent', Boolean(validate))
  validate?.click()
  await wait()
  check('stock décrémenté après validation', useData.getState().products.find((x) => x.id === sold.id).stock === startStock - 3)
  const undo = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Annuler')
  check('action Annuler dans la notification', Boolean(undo))
  undo?.click()
  await wait()
  check('stock rétabli après annulation', useData.getState().products.find((x) => x.id === sold.id).stock === startStock)
}

flowRoot.unmount()
flowEl.remove()

if (errors.length) {
  console.log(`\n${errors.length} message(s) console.error :`)
  errors.slice(0, 12).forEach((e) => console.log(' -', e.slice(0, 400)))
  failures += errors.filter((e) => !/not wrapped in act|Warning: ReactDOM/.test(e)).length
}

console.log(failures === 0 ? '\nSMOKE OK' : `\n${failures} problème(s)`)
process.exit(failures === 0 ? 0 : 1)
