# Kanti — gestion de stock simple et puissante

Kanti est un SaaS de gestion de stock pensé pour être **utilisé au comptoir, sur un téléphone** :
une sortie de stock se fait en deux gestes, un scan de code-barres ouvre la vente, et les alertes
de réapprovisionnement sont calculées à partir des **ventes réelles** et du **délai fournisseur** —
pas seulement d'un seuil fixe.

L'application est une démo pleinement fonctionnelle : **33 produits, 5 fournisseurs et plus de
400 mouvements de démonstration** sont chargés au premier lancement, dans un contexte ouest-africain
(Niamey, FCFA). Toutes les données restent **dans le navigateur** (localStorage) et peuvent être
exportées ou restaurées.

---

## ✨ Fonctionnalités

### Tableau de bord « Aujourd'hui »
- Valeur du stock, alertes, mouvements du jour, marge potentielle.
- File « À traiter maintenant » avec **réapprovisionnement en un clic**.
- Flux entrées/sorties sur 14 jours, meilleures sorties, derniers mouvements.
- Actions rapides : sortie, entrée, scan, inventaire, nouveau produit, bon de commande.

### Stock
- Recherche instantanée par nom, SKU ou **code-barres**.
- Filtres statut (en stock / bas / rupture), catégorie, fournisseur, tri (stock, valeur, marge).
- Tableau détaillé sur ordinateur, cartes tactiles sur mobile.
- **Import CSV** (collage Excel/Sheets ou fichier) avec correspondance automatique des en-têtes,
  mise à jour par SKU et rapport d'import.
- **Export CSV** de la vue filtrée.

### Mouvements
- Entrée, sortie ou **inventaire** (stock compté) avec écart calculé.
- Quantités rapides (+1/−1, 1, 5, 10, 25), contrôle de stock insuffisant.
- Motifs prédéfinis, note, référence auto, prix d'achat mis à jour à la réception.
- **Annulation immédiate** depuis la notification ou depuis l'historique (stock rétabli).
- Historique filtrable par type, période (7/30/90/tout), produit et texte libre.

### Alertes intelligentes
- Regroupement **par fournisseur** avec coût estimé.
- Quantité suggérée = couverture des ventes pendant le délai fournisseur × 1,3 (minimum : quantité de réappro).
- Indicateur de couverture en jours, ventes moyennes/jour.
- « Tout réceptionner » par fournisseur, ou réception ligne par ligne.
- Export CSV de la liste de réapprovisionnement.

### Bons de commande
- Généré automatiquement à partir des alertes, groupé par fournisseur.
- Export CSV, copie dans le presse-papiers (WhatsApp / e-mail) et **réception en un clic**.

### Rapports
- CA des sorties, marge brute, rotation du stock.
- Sorties quotidiennes, répartition de la valeur par catégorie.
- Top produits, capital immobilisé, meilleure marge, **produits dormants** (45 j sans sortie).
- Exports produits et mouvements.

### Scan & recherche rapide
- Scan caméra via l'API `BarcodeDetector` (Chrome/Android), avec repli en saisie manuelle.
- Compatible **douchette USB** : le code tapé dans la recherche (⌘K / Ctrl+K) ouvre le produit.
- Palette de commandes clavier (↑ ↓ ↵).

### Réglages
- Entreprise, utilisateur, devise (XOF, XAF, EUR, USD, MAD, NGN, GHS), adresse.
- Sauvegarde JSON complète, restauration, réinitialisation de la démo.

---

## 🚀 Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/
npm run preview    # prévisualisation du build
```

### Qualité

```bash
npm run typecheck  # TypeScript strict
npm run test:store # test métier du store (mouvements, annulation, import…)
npm run smoke      # rendu de tous les écrans et modales dans un DOM jsdom
npm test           # les trois
```

Les tests de fumée et de store utilisent `esbuild` + `jsdom` et s'exécutent sans navigateur.

---

## 🧱 Architecture

```
src/
├── components/
│   ├── Layout.tsx          # navigation, header, barre mobile, raccourcis clavier
│   ├── MovementForm.tsx    # saisie entrée / sortie / inventaire
│   ├── ProductForm.tsx     # fiche produit + marge calculée
│   ├── ProductDetail.tsx   # fiche + historique + actions
│   ├── OrderModal.tsx      # bon de commande groupé
│   ├── ScannerModal.tsx    # scan caméra (BarcodeDetector)
│   ├── SearchPalette.tsx   # recherche globale ⌘K
│   ├── ImportModal.tsx     # import CSV
│   └── ui.tsx              # primitives (Modal, Toaster, badges, empty states)
├── pages/                  # Dashboard, Stock, Movements, Alerts, Reports, Suppliers, Settings
├── lib/
│   ├── store.ts            # Zustand + persist (produits, fournisseurs, mouvements, réglages)
│   ├── analytics.ts        # KPI, alertes, flux, rotation, dormants
│   ├── csv.ts              # export / import CSV tolérant
│   ├── seed.ts             # jeu de démonstration réaliste
│   ├── format.ts           # monnaie, dates, statuts
│   └── uiStore.ts          # état des modales + notifications
└── index.css               # design system Tailwind
```

**Stack** : React 19 + TypeScript + Vite, Tailwind CSS, Zustand (persist), Recharts, lucide-react.

### Invariants métier
- Le stock ne change **que** par un mouvement (entrée, sortie, inventaire) : chaque variation est
  horodatée, attribuée à un utilisateur et réversible.
- Une sortie supérieure au stock disponible est refusée.
- Un ajustement enregistre l'écart (`|compté − stock|`) et le stock compté.
- La quantité suggérée de réapprovisionnement = `max(quantité de réappro, ⌈ventes/jour × délai × 1,3⌉)`.
- Un fournisseur lié à des produits ne peut pas être supprimé.

---

## 📦 Déploiement

Le build est un SPA statique. Pour un hébergement avec réécriture d'URL :

- **Netlify** : `public/_redirects` est déjà fourni (`/* /index.html 200`).
- **Vercel** : ajouter un rewrite `/(.*) → /index.html`.
- **Nginx** : `try_files $uri $uri/ /index.html;`

---

## 🗺️ Feuille de route SaaS

1. **Comptes & multi-tenant** : Supabase Auth + Postgres avec Row Level Security
   (`organizations`, `members`, `products`, `movements`), le store local devenant un cache offline.
2. **Synchronisation hors-ligne** : file d'attente de mouvements et résolution de conflits.
3. **Rôles** : propriétaire, gestionnaire, vendeur (sorties uniquement).
4. **Caisse / ventes rapides** : panier multi-lignes, tickets, encaissement Mobile Money.
5. **Notifications** : alertes e-mail/WhatsApp, rapport quotidien.
6. **Facturation SaaS** : abonnement par nombre d'utilisateurs et de entrepôts.
7. **Multi-entrepôts & transferts**, import de factures fournisseurs.

---

## 📄 Licence

AGPL-3.0 (voir `LICENSE`).
