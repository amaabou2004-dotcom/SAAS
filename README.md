# Kanti — gestion de stock multi-dépôts

Application de gestion de stock pour les commerces d’Afrique de l’Ouest : catalogue et
déclinaisons (SKU, code-barres, unité), soldes par dépôt, points de commande, valorisation en
FCFA, journal d’opérations auditable et rôles/permissions.

**Next.js 16 (App Router) · React 19 · TypeScript · zéro dépendance UI · Supabase (Postgres 17)**

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 9 tests du cœur métier (node:test, TypeScript natif)
npm run typecheck
npm run build
```

## Le produit

Le backend existait déjà : le projet Supabase `suuchdahpftxwbvwhbyq` (région `eu-north-1`)
contient un schéma multi-tenant complet pour **Kanti Démo SARL** (Niamey) — 33 références,
9 catégories, 5 fournisseurs, 241 opérations sur 45 jours. Cette application en est l’interface.

| Écran | Ce qu’il fait |
|---|---|
| `/` Tableau de bord | Valeur du stock, ruptures, réassort à passer, flux hebdomadaires, dernières opérations |
| `/stock` | 33 lignes triées par urgence, filtres état/catégorie/recherche, couverture en jours |
| `/operations` | Saisie d’une réception / sortie / ajustement + journal complet |
| `/catalogue` | Catalogue par catégorie, marges, seuils, fournisseur |
| `/fournisseurs` | Fiches, délais de livraison, réassort à passer par partenaire |
| `/equipe` | Membres et matrice des 15 permissions × 5 rôles système |
| `/settings` | Mode de données actif, tables et RPC exploités, contrat d’erreurs |

## Architecture de données

Une seule interface (`lib/data/repository.ts`), deux implémentations :

- **`SupabaseSource`** (production) — PostgREST + RPC. Lit `stock_overview`,
  `stock_movement_history`, `products`/`product_variants`, `list_tenant_members`,
  `list_tenant_roles` ; écrit via `post_stock_operation`.
- **`DemoSource`** (défaut) — snapshot réel du 2026-11-02 (`lib/data/snapshot.ts`), mutations en
  mémoire. Utilisé quand les variables d’environnement Supabase sont absentes.

Le basculement est déterminé côté serveur par `getDataSource()` ; aucune clé n’est exposée au
navigateur, tous les appels passent par les route handlers.

```bash
# .env.local pour passer en live
NEXT_PUBLIC_SUPABASE_URL=https://suuchdahpftxwbvwhbyq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # ou SUPABASE_USER_JWT pour respecter la RLS utilisateur
```

## Logique métier (testée)

`lib/data/logic.ts` — aucune I/O, 9 tests dans `tests/stock.test.ts` :

| Fonction | Règle |
|---|---|
| `stockStatus` | `0` → rupture, `≤ seuil` → bas, sinon OK (un disponible négatif reste une rupture) |
| `coverDays` | disponible ÷ (sorties 60 j ÷ 60) — **`null`** si le produit ne bouge pas, jamais d’infini affiché |
| `suggestedOrder` | au-dessus du seuil → 0 ; sinon `max(lot de réassort, manque)` |
| `turnover` | rotation annuelle estimée, `null` sans stock |
| `sortByUrgency` | ruptures, puis couverture croissante, puis nom |
| `computeKpis` | valeur coût/vente, marge potentielle, nombre et coût du réassort |

## Contrat d’écriture

L’API interne (`POST /api/operations`) valide la forme puis délègue à la base :

| Cas | Réponse |
|---|---|
| Ligne manquante, quantité nulle, doublon de produit, motif absent sur ajustement/inventaire | `422` + liste des erreurs |
| Type inconnu, référence > 120 caractères, > 50 lignes | `422` |
| Stock disponible insuffisant | `409` avec le message de la base |
| Succès | `201` + l’opération créée |

Le RPC `post_stock_operation` reste l’autorité : `SECURITY DEFINER`, permission
`inventory.manage`, idempotence (clé + empreinte SHA-256), verrous `FOR UPDATE` par ligne,
refus si `on_hand < reserved`, motif obligatoire pour ajustement/inventaire/annulation, et
mécanisme d’annulation (`reversal`) qui empêche les doubles saisies.

## Vérifications

- `npm run build` ✅ · `npx tsc --noEmit` ✅ · `npm test` **9/9** ✅
- Les 7 pages répondent 200 ; l’API refuse correctement une sortie de 999 sacs de riz pour 3 en
  stock, un ajustement sans motif et un doublon de ligne.

## Suite

1. Auth Supabase (email + mot de passe) et sélection du tenant à la connexion.
2. Écran d’administration des membres : invitations (`invite_member`), changement de rôle,
   révocation.
3. Transferts entre dépôts (`transfer` doit équilibrer chaque variante) et inventaire guidé.
4. Export CSV/PDF des états de stock et du journal.
5. Alertes de rupture par email ou WhatsApp à partir du réassort suggéré.
