import type { Movement, MovementType, Product, Settings, Supplier } from './types'

const now = Date.now()
const iso = (daysAgo = 0, hour = 10, minute = 0) => {
  const d = new Date(now - daysAgo * 86_400_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const seedSuppliers: Supplier[] = [
  {
    id: 's-01',
    name: 'Grand Marché Distribution',
    contact: 'Abdou Salam',
    phone: '+227 90 12 34 56',
    email: 'contact@gmd-niger.com',
    city: 'Niamey',
    leadTimeDays: 3,
    notes: 'Livraison le lundi et jeudi. Paiement à 15 jours.',
    createdAt: iso(240),
  },
  {
    id: 's-02',
    name: 'Niger Boissons SA',
    contact: 'Fatima Oumarou',
    phone: '+227 96 44 21 10',
    email: 'commandes@nigerboissons.ne',
    city: 'Niamey',
    leadTimeDays: 2,
    notes: 'Dépôt de Yantala. Camion 3,5 t.',
    createdAt: iso(210),
  },
  {
    id: 's-03',
    name: 'Sahel Hygiène & Entretien',
    contact: 'Rachid Alassane',
    phone: '+227 87 65 43 21',
    city: 'Niamey',
    leadTimeDays: 5,
    notes: 'Commande minimum 150 000 FCFA.',
    createdAt: iso(180),
  },
  {
    id: 's-04',
    name: 'Import Afrique Ouest',
    contact: 'Chantal Koffi',
    phone: '+228 90 88 77 66',
    email: 'proforma@iao-togo.com',
    city: 'Lomé',
    leadTimeDays: 12,
    notes: 'Import conteneur — prévoir les délais douane.',
    createdAt: iso(300),
  },
  {
    id: 's-05',
    name: 'Coopérative Agricole Tillabéri',
    contact: 'Hamidou Djibo',
    phone: '+227 91 23 45 67',
    city: 'Tillabéri',
    leadTimeDays: 7,
    notes: 'Mil, sorgho et niébé de saison.',
    createdAt: iso(150),
  },
]

type SeedRow = [
  sku: string,
  barcode: string,
  name: string,
  category: string,
  unit: string,
  cost: number,
  price: number,
  stock: number,
  reorderPoint: number,
  reorderQty: number,
  supplierId: string,
  location: string,
]

const rows: SeedRow[] = [
  ['RIZ-25', '6191234500011', 'Riz parfumé 25 kg', 'Céréales & farines', 'sac', 17500, 19500, 42, 20, 40, 's-05', 'Rayon A1'],
  ['MIL-50', '6191234500028', 'Mil local 50 kg', 'Céréales & farines', 'sac', 22000, 25000, 8, 12, 25, 's-05', 'Rayon A2'],
  ['SORGHO-50', '6191234500035', 'Sorgho 50 kg', 'Céréales & farines', 'sac', 18000, 21000, 0, 10, 20, 's-05', 'Rayon A2'],
  ['FARINE-50', '6191234500042', 'Farine de blé 50 kg', 'Céréales & farines', 'sac', 24000, 27500, 17, 10, 20, 's-01', 'Rayon A3'],
  ['HUILE-5L', '6191234500059', 'Huile végétale 5 L', 'Alimentation', 'bidon', 5800, 6700, 64, 30, 48, 's-01', 'Rayon B1'],
  ['SUCRE-1K', '6191234500066', 'Sucre en morceaux 1 kg', 'Alimentation', 'paquet', 700, 850, 120, 60, 100, 's-01', 'Rayon B2'],
  ['LAIT-500', '6191234500073', 'Lait en poudre 500 g', 'Alimentation', 'boîte', 2400, 2900, 36, 40, 60, 's-01', 'Rayon B2'],
  ['THE-400', '6191234500080', 'Thé vert 400 g', 'Boissons', 'paquet', 1900, 2400, 78, 40, 60, 's-01', 'Rayon C1'],
  ['CAFE-100', '6191234500097', 'Café soluble 100 g', 'Boissons', 'boîte', 1500, 1950, 25, 24, 48, 's-01', 'Rayon C1'],
  ['EAU-15L', '6191234500103', 'Eau minérale 1,5 L', 'Boissons', 'pack', 1400, 1800, 95, 50, 100, 's-02', 'Réserve'],
  ['ENERG-33', '6191234500110', 'Boisson énergisante 33 cl', 'Boissons', 'carton', 7500, 9000, 24, 15, 30, 's-02', 'Rayon C2'],
  ['JUS-1L', '6191234500127', 'Jus d’orange 1 L', 'Boissons', 'bouteille', 850, 1150, 54, 36, 72, 's-02', 'Rayon C2'],
  ['SODA-33', '6191234500134', 'Soda cola 33 cl', 'Boissons', 'carton', 5200, 6500, 31, 20, 40, 's-02', 'Rayon C2'],
  ['PATES-500', '6191234500141', 'Pâtes alimentaires 500 g', 'Alimentation', 'paquet', 450, 600, 210, 100, 150, 's-01', 'Rayon B3'],
  ['TOMATE-70', '6191234500158', 'Tomate concentrée 70 g', 'Alimentation', 'boîte', 180, 250, 320, 150, 300, 's-01', 'Rayon B3'],
  ['SARDINE-125', '6191234500165', 'Sardines à l’huile 125 g', 'Alimentation', 'boîte', 550, 750, 96, 80, 120, 's-01', 'Rayon B3'],
  ['SAVON-MAR', '6191234500172', 'Savon de Marseille 400 g', 'Hygiène', 'pièce', 350, 500, 180, 100, 200, 's-03', 'Rayon D1'],
  ['DETERG-1K', '6191234500189', 'Détergent lessive 1 kg', 'Entretien', 'sachet', 950, 1250, 42, 50, 80, 's-03', 'Rayon D2'],
  ['JAVEL-1L', '6191234500196', 'Eau de javel 1 L', 'Entretien', 'bouteille', 400, 600, 68, 40, 72, 's-03', 'Rayon D2'],
  ['VAISSELLE-1L', '6191234500202', 'Liquide vaisselle 1 L', 'Entretien', 'bouteille', 900, 1200, 19, 24, 36, 's-03', 'Rayon D2'],
  ['EPONGE-3', '6191234500219', 'Éponges (lot de 3)', 'Entretien', 'paquet', 250, 400, 140, 60, 100, 's-03', 'Rayon D3'],
  ['PAPIER-HYG', '6191234500226', 'Papier hygiénique (4 rouleaux)', 'Hygiène', 'pack', 900, 1300, 57, 36, 60, 's-03', 'Rayon D3'],
  ['PILES-AA', '6191234500233', 'Piles AA (lot de 4)', 'Électricité', 'pack', 1200, 1800, 33, 20, 40, 's-04', 'Rayon E1'],
  ['AMPOULE-9W', '6191234500240', 'Ampoule LED 9 W', 'Électricité', 'pièce', 700, 1200, 6, 24, 50, 's-04', 'Rayon E1'],
  ['CABLE-25', '6191234500257', 'Câble électrique 2,5 mm²', 'Électricité', 'rouleau', 14500, 17500, 11, 6, 10, 's-04', 'Réserve'],
  ['CAHIER-200', '6191234500264', 'Cahier 200 pages', 'Papeterie', 'pièce', 300, 450, 240, 100, 200, 's-04', 'Rayon F1'],
  ['STYLO-B', '6191234500271', 'Stylos bleus (boîte de 50)', 'Papeterie', 'boîte', 3750, 5000, 14, 10, 20, 's-04', 'Rayon F1'],
  ['RAMETTE-A4', '6191234500288', 'Ramette A4 (500 feuilles)', 'Papeterie', 'ramette', 3200, 4000, 0, 12, 24, 's-04', 'Rayon F2'],
  ['PARFUM-50', '6191234500295', 'Eau de toilette 50 ml', 'Cosmétiques', 'pièce', 3500, 5500, 22, 12, 24, 's-04', 'Rayon G1'],
  ['LAIT-CORPS', '6191234500301', 'Lait corporel 400 ml', 'Cosmétiques', 'pièce', 1800, 2600, 41, 18, 36, 's-03', 'Rayon G1'],
  ['BOUGIE-6', '6191234500318', 'Bougies (lot de 6)', 'Divers', 'paquet', 600, 900, 88, 40, 80, 's-04', 'Rayon H1'],
  ['ALLUMETTE', '6191234500325', 'Allumettes (carton de 10)', 'Divers', 'carton', 250, 400, 64, 30, 60, 's-04', 'Rayon H1'],
  ['SAC-PLAST', '6191234500332', 'Sacs plastiques (paquet de 100)', 'Divers', 'paquet', 500, 800, 210, 80, 150, 's-04', 'Réserve'],
]

export const seedProducts: Product[] = rows.map((r, i) => {
  const [sku, barcode, name, category, unit, cost, price, stock, reorderPoint, reorderQty, supplierId, location] = r
  return {
    id: `p-${String(i + 1).padStart(3, '0')}`,
    sku,
    barcode,
    name,
    category,
    unit,
    cost,
    price,
    stock,
    reorderPoint,
    reorderQty,
    supplierId,
    location,
    active: true,
    createdAt: iso(200 - (i % 40)),
    updatedAt: iso(i % 9),
  }
})

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const OUT_REASONS = ['Vente comptoir', 'Vente boutique', 'Livraison client', 'Casse / perte', 'Don', 'Transfert sortant']
const IN_REASONS = ['Réception fournisseur', 'Retour client', 'Transfert entrant', 'Production']

export function buildSeedMovements(products: Product[]): Movement[] {
  const rand = mulberry32(20261101)
  const movements: Movement[] = []
  const users = ['Moussa', 'Aïcha', 'Ibrahim']

  const dormantSkus = new Set(['CABLE-25', 'PARFUM-50', 'BOUGIE-6', 'SAC-PLAST'])

  for (let day = 60; day >= 0; day--) {
    for (const product of products) {
      if (dormantSkus.has(product.sku)) continue
      const heavy = product.price < 1500 ? 1.7 : 1
      const chance = 0.16 * heavy * (day % 7 === 0 ? 0.55 : 1)

      if (rand() < chance) {
        const qty = Math.max(1, Math.round((0.08 + rand() * 0.22) * Math.max(6, product.reorderQty)))
        const type: MovementType = 'out'
        const reason = OUT_REASONS[Math.floor(rand() * OUT_REASONS.length)]
        const stockAfter = Math.max(0, product.stock + Math.round(rand() * 20) - 10 + qty)
        movements.push({
          id: `m-${day}-${product.id}-o`,
          productId: product.id,
          type,
          quantity: qty,
          stockBefore: stockAfter + qty,
          stockAfter,
          unitCost: product.cost,
          reason,
          note: reason === 'Casse / perte' ? 'Produit endommagé' : undefined,
          reference: `VTE-${String(1000 + Math.floor(rand() * 8000))}`,
          user: users[Math.floor(rand() * users.length)],
          at: iso(day, 8 + Math.floor(rand() * 11), Math.floor(rand() * 60)),
        })
      }

      if (rand() < 0.035) {
        const qty = Math.max(1, Math.round(product.reorderQty * (0.6 + rand() * 0.8)))
        const stockBefore = Math.max(0, product.stock - Math.round(rand() * 15))
        movements.push({
          id: `m-${day}-${product.id}-i`,
          productId: product.id,
          type: 'in',
          quantity: qty,
          stockBefore,
          stockAfter: stockBefore + qty,
          unitCost: product.cost,
          reason: IN_REASONS[Math.floor(rand() * IN_REASONS.length)],
          reference: `REC-${String(500 + Math.floor(rand() * 2000))}`,
          user: users[Math.floor(rand() * users.length)],
          at: iso(day, 8 + Math.floor(rand() * 9), Math.floor(rand() * 60)),
        })
      }
    }
  }

  return movements.sort((a, b) => (a.at < b.at ? 1 : -1))
}

export const seedSettings: Settings = {
  company: 'Kanti Démo SARL',
  userName: 'Moussa',
  currency: 'XOF',
  role: 'Gestionnaire de stock',
  phone: '+227 90 00 00 00',
  address: 'Rue du Grand Marché, Niamey',
}
