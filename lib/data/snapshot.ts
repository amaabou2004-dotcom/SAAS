/**
 * Snapshot réel de la base Supabase (projet suuchdahpftxwbvwhbyq), extrait le
 * 2026-11-02 : tenant, catalogue, stock, flux hebdomadaires et journal.
 *
 * Sert de source pour le mode démo (le sandbox n'a pas d'accès réseau vers
 * supabase.co). En production, ces données viennent de l'API Supabase.
 */

import type {
  Category,
  Member,
  PermissionCode,
  Product,
  Role,
  StockLocation,
  Supplier,
  Tenant,
  WeeklyFlow,
} from "./types";

export const TENANT: Tenant = {
  id: "0969579a-c676-4542-b846-d9df6235f6e6",
  name: "Kanti Démo SARL",
  slug: "kanti-demo-sarl",
  currency_code: "XOF",
  timezone: "Africa/Niamey",
  status: "active",
  address: "Rue du Grand Marché, Niamey",
  phone: "+227 90 00 00 00",
};

export const LOCATION: StockLocation = {
  id: "77687156-196d-4b52-897c-a75d30bb0c20",
  name: "Dépôt principal",
  code: "PRINCIPAL",
  active: true,
};

const cat = (id: string, name: string): Category => ({ id, name, active: true });

export const CATEGORIES: Category[] = [
  cat("7d79cc72-6943-4dff-9eb5-c0b2b9146132", "Alimentation"),
  cat("68c7da73-ab37-4b8f-a0c7-64c26f980470", "Boissons"),
  cat("0b927102-a99c-4710-bfa4-7fb584ab312a", "Céréales & farines"),
  cat("ec4c8366-a4fd-428c-b402-44308e8d6604", "Cosmétiques"),
  cat("a0bb86cf-14e5-4ff2-8609-1a7ce85fd12c", "Divers"),
  cat("0eeec452-b492-4e8d-ab8e-b27bb43b0593", "Électricité"),
  cat("eb620352-693b-435e-9da5-e39a4376bbc7", "Entretien"),
  cat("43a632b8-c205-4007-8bc9-f04c922a6d15", "Hygiène"),
  cat("16109f91-083d-4f05-bddb-2a7182b3fe5b", "Papeterie"),
];

export const SUPPLIERS: Supplier[] = [
  {
    id: "86609bfb-82f7-4498-aa55-d20a4506a6fd",
    name: "Coopérative Agricole Tillabéri",
    contact: "Hamidou Djibo",
    phone: "+227 91 23 45 67",
    email: null,
    city: "Tillabéri",
    lead_time_days: 7,
    notes: "Mil, sorgho et niébé de saison.",
    active: true,
  },
  {
    id: "9e9874e9-141b-4094-bed1-993c07607a8c",
    name: "Grand Marché Distribution",
    contact: "Abdou Salam",
    phone: "+227 90 12 34 56",
    email: "contact@gmd-niger.com",
    city: "Niamey",
    lead_time_days: 3,
    notes: "Livraison lundi et jeudi. Paiement à 15 jours.",
    active: true,
  },
  {
    id: "5d961472-263e-43bb-9fd8-d1e81dc87691",
    name: "Import Afrique Ouest",
    contact: "Chantal Koffi",
    phone: "+228 90 88 77 66",
    email: "proforma@iao-togo.com",
    city: "Lomé",
    lead_time_days: 12,
    notes: "Import conteneur — prévoir les délais douane.",
    active: true,
  },
  {
    id: "239114ff-27b9-4c17-8220-7eea181ef26a",
    name: "Niger Boissons SA",
    contact: "Fatima Oumarou",
    phone: "+227 96 44 21 10",
    email: "commandes@nigerboissons.ne",
    city: "Niamey",
    lead_time_days: 2,
    notes: "Dépôt de Yantala.",
    active: true,
  },
  {
    id: "e41a4a31-a2c4-46e0-b6ed-5c4da4058b79",
    name: "Sahel Hygiène & Entretien",
    contact: "Rachid Alassane",
    phone: "+227 87 65 43 21",
    email: null,
    city: "Niamey",
    lead_time_days: 5,
    notes: "Commande minimum 150 000 FCFA.",
    active: true,
  },
];

const C = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.id]));
const S = Object.fromEntries(SUPPLIERS.map((s) => [s.name, s.id]));

type Row = [
  name: string,
  sku: string,
  unit: string,
  sale: number,
  cost: number,
  rp: number,
  rq: number,
  category: string,
  supplier: string,
  onHand: number,
  issues60: number,
  receipts60: number,
];

/** Catalogue + soldes réels relevés en base. */
const ROWS: Row[] = [
  ["Allumettes (carton de 10)", "ALLUMETTE", "carton", 400, 250, 30, 60, "Divers", "Import Afrique Ouest", 3, 61, 0],
  ["Ampoule LED 9 W", "AMPOULE-9W", "pièce", 1200, 700, 24, 50, "Électricité", "Import Afrique Ouest", 63, 27, 84],
  ["Boisson énergisante 33 cl", "ENERG-33", "carton", 9000, 7500, 15, 30, "Boissons", "Niger Boissons SA", 2, 22, 0],
  ["Bougies (lot de 6)", "BOUGIE-6", "paquet", 900, 600, 40, 80, "Divers", "Import Afrique Ouest", 7, 81, 0],
  ["Câble électrique 2,5 mm²", "CABLE-25", "rouleau", 17500, 14500, 6, 10, "Électricité", "Import Afrique Ouest", 15, 7, 11],
  ["Café soluble 100 g", "CAFE-100", "boîte", 1950, 1500, 24, 48, "Boissons", "Grand Marché Distribution", 83, 33, 91],
  ["Cahier 200 pages", "CAHIER-200", "pièce", 450, 300, 100, 200, "Papeterie", "Import Afrique Ouest", 222, 398, 380],
  ["Détergent lessive 1 kg", "DETERG-1K", "sachet", 1250, 950, 50, 80, "Entretien", "Sahel Hygiène & Entretien", 106, 73, 137],
  ["Eau de javel 1 L", "JAVEL-1L", "bouteille", 600, 400, 40, 72, "Entretien", "Sahel Hygiène & Entretien", 0, 68, 0],
  ["Eau de toilette 50 ml", "PARFUM-50", "pièce", 5500, 3500, 12, 24, "Cosmétiques", "Import Afrique Ouest", 26, 22, 26],
  ["Eau minérale 1,5 L", "EAU-15L", "pack", 1800, 1400, 50, 100, "Boissons", "Niger Boissons SA", 198, 141, 244],
  ["Éponges (lot de 3)", "EPONGE-3", "paquet", 400, 250, 60, 100, "Entretien", "Sahel Hygiène & Entretien", 82, 117, 59],
  ["Farine de blé 50 kg", "FARINE-50", "sac", 27500, 24000, 10, 20, "Céréales & farines", "Grand Marché Distribution", 22, 22, 27],
  ["Huile végétale 5 L", "HUILE-5L", "bidon", 6700, 5800, 30, 48, "Alimentation", "Grand Marché Distribution", 111, 30, 77],
  ["Jus d'orange 1 L", "JUS-1L", "bouteille", 1150, 850, 36, 72, "Boissons", "Niger Boissons SA", 105, 94, 145],
  ["Lait corporel 400 ml", "LAIT-CORPS", "pièce", 2600, 1800, 18, 36, "Cosmétiques", "Sahel Hygiène & Entretien", 54, 46, 59],
  ["Lait en poudre 500 g", "LAIT-500", "boîte", 2900, 2400, 40, 60, "Alimentation", "Grand Marché Distribution", 4, 32, 0],
  ["Liquide vaisselle 1 L", "VAISSELLE-1L", "bouteille", 1200, 900, 24, 36, "Entretien", "Sahel Hygiène & Entretien", 0, 39, 20],
  ["Mil local 50 kg", "MIL-50", "sac", 25000, 22000, 12, 25, "Céréales & farines", "Coopérative Agricole Tillabéri", 57, 17, 66],
  ["Papier hygiénique (4 rouleaux)", "PAPIER-HYG", "pack", 1300, 900, 36, 60, "Hygiène", "Sahel Hygiène & Entretien", 123, 69, 135],
  ["Pâtes alimentaires 500 g", "PATES-500", "paquet", 600, 450, 100, 150, "Alimentation", "Grand Marché Distribution", 105, 105, 0],
  ["Piles AA (lot de 4)", "PILES-AA", "pack", 1800, 1200, 20, 40, "Électricité", "Import Afrique Ouest", 21, 53, 41],
  ["Ramette A4 (500 feuilles)", "RAMETTE-A4", "ramette", 4000, 3200, 12, 24, "Papeterie", "Import Afrique Ouest", 0, 0, 0],
  ["Riz parfumé 25 kg", "RIZ-25", "sac", 19500, 17500, 20, 40, "Céréales & farines", "Coopérative Agricole Tillabéri", 3, 39, 0],
  ["Sacs plastiques (paquet de 100)", "SAC-PLAST", "paquet", 800, 500, 80, 150, "Divers", "Import Afrique Ouest", 465, 90, 345],
  ["Sardines à l'huile 125 g", "SARDINE-125", "boîte", 750, 550, 80, 120, "Alimentation", "Grand Marché Distribution", 14, 149, 67],
  ["Savon de Marseille 400 g", "SAVON-MAR", "pièce", 500, 350, 100, 200, "Hygiène", "Sahel Hygiène & Entretien", 8, 172, 0],
  ["Soda cola 33 cl", "SODA-33", "carton", 6500, 5200, 20, 40, "Boissons", "Niger Boissons SA", 2, 29, 0],
  ["Sorgho 50 kg", "SORGHO-50", "sac", 21000, 18000, 10, 20, "Céréales & farines", "Coopérative Agricole Tillabéri", 0, 0, 56],
  ["Stylos bleus (boîte de 50)", "STYLO-B", "boîte", 5000, 3750, 10, 20, "Papeterie", "Import Afrique Ouest", 18, 11, 15],
  ["Sucre en morceaux 1 kg", "SUCRE-1K", "paquet", 850, 700, 60, 100, "Alimentation", "Grand Marché Distribution", 35, 160, 75],
  ["Thé vert 400 g", "THE-400", "paquet", 2400, 1900, 40, 60, "Boissons", "Grand Marché Distribution", 76, 73, 71],
  ["Tomate concentrée 70 g", "TOMATE-70", "boîte", 250, 180, 150, 300, "Alimentation", "Grand Marché Distribution", 383, 123, 186],
];

const vid = (sku: string) => `v-${sku.toLowerCase()}`;

export const PRODUCTS: Product[] = ROWS.map(
  ([name, sku, unit, sale, cost, rp, rq, category, supplier]) => ({
    id: `p-${sku.toLowerCase()}`,
    variant_id: vid(sku),
    name,
    sku,
    barcode: null,
    unit,
    category_id: C[category] ?? null,
    supplier_id: S[supplier] ?? null,
    sale_price: sale,
    cost_price: cost,
    reorder_point: rp,
    reorder_qty: rq,
    storage_label: null,
    active: true,
  }),
);

export const BALANCES: Record<string, { on_hand: number; reserved: number }> = Object.fromEntries(
  ROWS.map((row) => [vid(row[1]), { on_hand: row[9], reserved: 0 }]),
);

export const FLOWS_60D: Record<string, { issues: number; receipts: number }> = Object.fromEntries(
  ROWS.map((row) => [vid(row[1]), { issues: row[10], receipts: row[11] }]),
);

/** Flux réels par semaine (8 dernières semaines). */
export const WEEKLY: WeeklyFlow[] = [
  { week: "2026-09-14", issues: 70, receipts: 375, operations: 9 },
  { week: "2026-09-21", issues: 246, receipts: 389, operations: 33 },
  { week: "2026-09-28", issues: 222, receipts: 349, operations: 24 },
  { week: "2026-10-05", issues: 375, receipts: 373, operations: 35 },
  { week: "2026-10-12", issues: 577, receipts: 513, operations: 60 },
  { week: "2026-10-19", issues: 331, receipts: 151, operations: 31 },
  { week: "2026-10-26", issues: 513, receipts: 106, operations: 41 },
  { week: "2026-11-02", issues: 69, receipts: 161, operations: 8 },
];

/** 12 dernières opérations du journal (réelles). */
export const RECENT_OPERATIONS: Array<{
  type: "receipt" | "issue";
  reference: string;
  reason: string;
  date: string;
  lines: Array<[sku: string, qty: number]>;
}> = [
  { type: "issue", reference: "VTE-7412", reason: "Vente comptoir", date: "2026-11-02", lines: [["SAVON-MAR", -30]] },
  { type: "issue", reference: "VTE-2992", reason: "Vente comptoir", date: "2026-11-02", lines: [["JUS-1L", -5]] },
  { type: "issue", reference: "VTE-1624", reason: "Vente comptoir", date: "2026-11-02", lines: [["VAISSELLE-1L", -4]] },
  { type: "receipt", reference: "REC-605", reason: "Réception fournisseur", date: "2026-11-02", lines: [["CAHIER-200", 161]] },
  { type: "issue", reference: "VTE-2169", reason: "Vente comptoir", date: "2026-11-02", lines: [["THE-400", -13]] },
  { type: "issue", reference: "VTE-3662", reason: "Vente comptoir", date: "2026-11-02", lines: [["FARINE-50", -3]] },
  { type: "issue", reference: "VTE-6577", reason: "Vente comptoir", date: "2026-11-02", lines: [["SUCRE-1K", -14]] },
  { type: "issue", reference: "VTE-1024", reason: "Vente comptoir", date: "2026-11-01", lines: [["CAFE-100", -8]] },
  { type: "issue", reference: "VTE-1867", reason: "Vente comptoir", date: "2026-11-01", lines: [["SUCRE-1K", -13]] },
  { type: "issue", reference: "VTE-6205", reason: "Vente comptoir", date: "2026-11-01", lines: [["FARINE-50", -3]] },
  { type: "issue", reference: "VTE-4833", reason: "Vente comptoir", date: "2026-11-01", lines: [["LAIT-CORPS", -4]] },
];

const ALL: PermissionCode[] = [
  "audit.read",
  "catalog.manage",
  "catalog.read",
  "inventory.manage",
  "inventory.read",
  "members.manage",
  "members.read",
  "reports.manage",
  "reports.read",
  "sales.manage",
  "sales.read",
  "stores.manage",
  "stores.read",
  "tenant.manage",
  "tenant.read",
];

/** Rôles système et permissions, tels que définis en base. */
export const ROLES: Role[] = [
  {
    id: "role-proprietaire",
    name: "Propriétaire",
    description: "Accès complet à l’entreprise",
    is_system: true,
    permissions: ALL,
  },
  {
    id: "role-gestionnaire",
    name: "Gestionnaire",
    description: "Catalogue, stock, rapports et équipe",
    is_system: true,
    permissions: [
      "audit.read",
      "catalog.manage",
      "catalog.read",
      "inventory.manage",
      "inventory.read",
      "members.read",
      "reports.read",
      "sales.read",
      "stores.manage",
      "stores.read",
      "tenant.read",
    ],
  },
  {
    id: "role-magasinier",
    name: "Magasinier",
    description: "Réception, sorties et inventaires",
    is_system: true,
    permissions: ["catalog.read", "inventory.manage", "inventory.read", "reports.read", "stores.read"],
  },
  {
    id: "role-vendeur",
    name: "Vendeur",
    description: "Sorties de stock et ventes",
    is_system: true,
    permissions: ["catalog.read", "inventory.read", "reports.read", "sales.manage", "sales.read"],
  },
  {
    id: "role-lecture",
    name: "Lecture seule",
    description: "Consultation uniquement",
    is_system: true,
    permissions: ["catalog.read", "inventory.read", "reports.read", "sales.read"],
  },
];

export const MEMBERS: Member[] = [
  {
    id: "m-1",
    full_name: "Aboubakar Amadou",
    email: "amaabou2004@gmail.com",
    role_id: "role-proprietaire",
    role_name: "Propriétaire",
    status: "active",
    joined_at: "2026-11-02",
  },
  {
    id: "m-2",
    full_name: "Hamidou Djibo",
    email: "hamidou.djibo@kanti.ne",
    role_id: "role-magasinier",
    role_name: "Magasinier",
    status: "active",
    joined_at: "2026-11-02",
  },
  {
    id: "m-3",
    full_name: "Fatima Oumarou",
    email: "fatima.oumarou@kanti.ne",
    role_id: "role-vendeur",
    role_name: "Vendeur",
    status: "active",
    joined_at: "2026-11-02",
  },
  {
    id: "m-4",
    full_name: "Rachid Alassane",
    email: "rachid.alassane@kanti.ne",
    role_id: "role-gestionnaire",
    role_name: "Gestionnaire",
    status: "invited",
    joined_at: "2026-11-02",
  },
];

export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  "audit.read": "Consulter le journal d’audit",
  "catalog.manage": "Gérer le catalogue",
  "catalog.read": "Consulter le catalogue",
  "inventory.manage": "Gérer le stock",
  "inventory.read": "Consulter le stock",
  "members.manage": "Gérer les membres",
  "members.read": "Consulter les membres",
  "reports.manage": "Configurer les rapports",
  "reports.read": "Consulter les rapports",
  "sales.manage": "Enregistrer les ventes",
  "sales.read": "Consulter les ventes",
  "stores.manage": "Gérer les dépôts",
  "stores.read": "Consulter les dépôts",
  "tenant.manage": "Gérer l’entreprise",
  "tenant.read": "Consulter l’entreprise",
};
