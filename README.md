# Kanti — gestion de stock simple et puissante

Kanti est un SaaS de gestion de stock pensé pour être **utilisé au comptoir, sur un téléphone** :
une sortie de stock se fait en deux gestes, un scan de code-barres ouvre la vente, et les alertes
de réapprovisionnement sont calculées à partir des **ventes réelles** et du **délai fournisseur** —
pas seulement d'un seuil fixe.

L'application est désormais **multi-entreprises et multi-utilisateurs** : authentification Supabase,
PostgreSQL avec Row Level Security, rôles et permissions, journal de stock transactionnel
(idempotence, annulation par contre-écriture).

---

## 🔐 Compte de démonstration

| E-mail | Mot de passe |
| --- | --- |
| `demo@kanti.app` | `KantiDemo2026!` |

L'espace **Kanti Démo SARL** contient 33 produits, 5 fournisseurs et ~270 mouvements sur 45 jours
(valorisation ≈ 4,4 M FCFA). Vous pouvez aussi créer votre propre compte : l'espace de travail est
provisionné avec un catalogue de démonstration en option.

---

## ✨ Fonctionnalités

### Authentification & espaces de travail
- Inscription, connexion, mot de passe oublié/réinitialisation (Supabase Auth, PKCE).
- Connexion Google (OAuth) configurable.
- Création d'espaces (tenants), sélection de l'espace actif, plusieurs entreprises par utilisateur.
- Rôle affiché (Propriétaire, Gestionnaire, Vendeur…) issu des permissions de l'espace.

### Tableau de bord « Aujourd'hui »
- Valeur du stock, alertes, mouvements du jour, marge potentielle.
- File « À traiter maintenant » avec **réapprovisionnement en un clic**.
- Flux entrées/sorties sur 14 jours, meilleures sorties, derniers mouvements.
- Actions rapides : sortie, entrée, scan, inventaire, nouveau produit, bon de commande.

### Stock
- Recherche instantanée par nom, SKU ou **code-barres** ; filtres statut/catégorie/fournisseur ; tris.
- Tableau desktop détaillé, cartes tactiles sur mobile.
- **Import CSV** (collage Excel/Sheets ou fichier) avec alias d'en-têtes, mises à jour par SKU et rapport.
- **Export CSV** de la vue filtrée.

### Mouvements
- Entrée, sortie ou **inventaire** (stock compté, écart calculé) — chaque opération est une
  `stock_operation` transactionnelle avec clé d'idempotence, lignes et trace utilisateur.
- Quantités rapides, contrôle de stock insuffisant côté client **et** côté base.
- **Annulation** par contre-écriture (`reversal`), depuis la notification ou l'historique.
- Historique filtrable (type, période, produit, texte), valorisation des sorties.

### Alertes intelligentes
- Regroupement **par fournisseur** et coût estimé.
- Quantité suggérée = couverture des ventes pendant le délai fournisseur × 1,3 (minimum : quantité de réappro).
- Couverture en jours, ventes moyennes/jour, réception ligne à ligne ou groupée.

### Bons de commande
- Générés depuis les alertes, groupés par fournisseur, export CSV, copie presse-papiers
  (WhatsApp / e-mail) et **réception en un clic** (une opération de stock par ligne).

### Rapports
- CA des sorties, marge brute, rotation, sorties quotidiennes, valeur par catégorie.
- Top produits, capital immobilisé, meilleure marge, **produits dormants**.

### Scan & recherche rapide
- Scan caméra via `BarcodeDetector` (Chrome/Android) avec repli saisie manuelle et douchette USB.
- Palette de commandes ⌘K / Ctrl+K, raccourcis ⌘I pour une entrée.

### Réglages
- Entreprise (nom, devise, adresse, téléphone via RPC), profil utilisateur, rôle.
- Exports CSV, rechargement serveur, chargement du catalogue de démonstration dans un espace vide.

---

## 🚀 Démarrage

```bash
npm install
cp .env.example .env.local     # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:5173
```

### Scripts

```bash
npm run typecheck   # TypeScript strict
npm run test:logic  # 18 tests des règles métier pures (alertes, flux, dormants, CSV, formats)
npm run smoke       # 24 tests de rendu jsdom : écrans, modales, auth, onboarding, contrôle de stock
npm test            # les trois
npm run build       # build de production
```

---

## 🧱 Architecture

```
src/
├── lib/
│   ├── supabase.ts        # client Supabase + traduction des erreurs Postgres en français
│   ├── auth.tsx           # AuthProvider : session, profil, espaces, rôles, inscription/OAuth
│   ├── store.ts           # cache Zustand (produits, fournisseurs, mouvements) + actions RPC
│   ├── analytics.ts       # KPI, alertes, flux, rotation, dormants (fonctions pures testées)
│   ├── csv.ts             # export/import CSV tolérant
│   ├── format.ts          # monnaie, dates, statuts, unités, devises
│   └── uiStore.ts         # modales + notifications
├── components/            # Layout, formulaires produit/mouvement/fournisseur, bon de commande,
│                          # scanner, palette de recherche, primitives UI
├── pages/                 # Dashboard, Stock, Movements, Alerts, Reports, Suppliers, Settings,
│                          # Auth, Onboarding
└── index.css              # design system Tailwind
supabase/migrations/       # schéma + RPC (versionnés, appliqués sur le projet)
```

**Stack** : React 19 + TypeScript + Vite, Tailwind CSS, Zustand, Recharts, lucide-react,
Supabase (Auth + Postgres + RLS + RPC).

### Modèle de données (extrait)

```
tenants ─┬─ memberships ─ roles ─ role_permissions ─ permissions
         ├─ suppliers
         ├─ categories ─ products ─ product_variants ─┬─ stock_balances
         │                                            └─ stock_movements ─ stock_operations
         └─ stock_locations
```

### RPC disponibles

| Fonction | Rôle |
| --- | --- |
| `create_tenant` | Crée l'entreprise, le rôle Propriétaire, ses permissions et le dépôt principal |
| `upsert_product` | Crée/modifie produit + déclinaison (SKU, code-barres, unité, seuil, réappro, fournisseur) |
| `post_stock_operation` | Écrit les mouvements d'un coup : `opening`, `receipt`, `issue`, `adjustment`, `inventory`, `transfer`, `reversal` |
| `save_supplier` / `delete_supplier` | Fournisseurs (suppression détache les produits) |
| `delete_product` | Supprime, ou archive si l'historique existe |
| `update_tenant_settings` | Nom, devise, fuseau, adresse, téléphone |
| `seed_demo_data` / `seed_demo_history` | Catalogue et historique de démonstration |

### Invariants métier
- Le stock ne change **que** par une opération de stock ; chaque variation est horodatée, attribuée
  et réversible par contre-écriture.
- Une sortie supérieure au stock disponible échoue côté base (`Insufficient available stock`).
- Un ajustement enregistre l'écart (`inventaire`) ; la quantité comptée ne peut pas être négative.
- La quantité suggérée = `max(qté de réappro, ⌈ventes/jour × délai × 1,3⌉)`.
- Toute écriture directe en table est refusée : seules les RPC `SECURITY DEFINER` écrivent.
- L'isolation entre entreprises est garantie par RLS (`has_tenant_permission`, `is_tenant_member`).

---

## 📦 Déploiement

SPA statique (`dist/`) + Supabase managé.

- `public/_redirects` (Netlify) et `vercel.json` fournissent la réécriture SPA.
- Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé publishable, jamais la `service_role`).
- Dans Supabase → Authentication → URL Configuration : ajouter le domaine de production à
  `Site URL` et `Redirect URLs` (`/auth/callback`, `/auth/reinitialisation`).

---

## 🗺️ Feuille de route

1. **Invitations d'équipe** : `invite_member`, rôles personnalisés (Vendeur limité aux sorties).
2. **Multi-entrepôts** : écrans de transfert (`transfer` déjà supporté côté base).
3. **Mode hors-ligne** : file d'attente de mouvements + réconciliation par clé d'idempotence.
4. **Caisse** : panier multi-lignes, tickets, encaissement Mobile Money.
5. **Notifications** : e-mails/WhatsApp d'alerte, rapport quotidien, seuils par produit.
6. **Facturation SaaS** : abonnement par utilisateurs/entrepôts (Stripe, Mobile Money).
7. **Import de factures fournisseurs** et rapprochement de prix.

---

## 📄 Licence

AGPL-3.0 (voir `LICENSE`).
