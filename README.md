# Kanti — gestion de stock multi-dépôts

Application de gestion de stock pour les commerces d’Afrique de l’Ouest : catalogue et
déclinaisons (SKU, code-barres, unité), soldes par dépôt, points de commande, valorisation en
FCFA, journal d’opérations auditable, rôles/permissions et **authentification multi-entreprises**.

**Next.js 16 (App Router) · React 19 · TypeScript · Supabase (`@supabase/ssr`) · zéro dépendance UI**

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 19 tests : métier, tenancy et contrat de schéma Supabase
npm run typecheck
npm run build
```

## Deux modes, un seul code

| Mode | Déclencheur | Ce qui se passe |
|---|---|---|
| **Démo** | variables Supabase absentes | snapshot réel du 2026-11-02 en mémoire, accès libre, bandeau « Non connecté — mode démo » |
| **Live** | variables Supabase présentes | connexion obligatoire, RLS appliquée, données de votre entreprise |

Sans configuration, la préview reste **entièrement navigable** : c’est ce qui permet de juger
l’interface avant de brancher la base.

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://suuchdahpftxwbvwhbyq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

Aucune clé service n’est nécessaire : les requêtes partent avec le **JWT de l’utilisateur**, donc
les politiques RLS s’appliquent réellement. À déployer sur Vercel, les mêmes variables suffisent.

## Authentification et multi-tenant

- **Connexion** : email + mot de passe ou **Google OAuth** (`app/(auth)/login`). La confirmation
  d’email est activée côté projet Supabase ; l’auto-confirmation évite un aller-retour SMTP.
- **Session en cookies** via `@supabase/ssr` + `proxy.ts` (ex-middleware) qui rafraîchit le token à
  chaque requête et protège les routes. Si Supabase est injoignable, on dégrade en visiteur non
  connecté au lieu de casser les pages.
- **Sélection de l’entreprise** (`/select-tenant`) : liste les adhésions réelles de l’utilisateur,
  écrit un cookie `kanti_tenant` httpOnly. Le cookie est **revérifié contre les adhésions** à
  chaque requête (`pickActiveTenantId`) : une valeur forgée est ignorée.
- **Création d’entreprise** (`/onboarding`) : appelle le RPC `create_tenant`, qui exige un email
  confirmé, valide le slug et installe le rôle Propriétaire + les 15 permissions.
- **Déconnexion** : `POST /auth/signout`, qui nettoie aussi le cookie de tenant.

## Écrans

| Route | Rôle |
|---|---|
| `/` | Valeur du stock, ruptures, réassort à passer, flux hebdomadaires, dernières opérations |
| `/stock` | 33 lignes triées par urgence, filtres état/catégorie/recherche, couverture en jours |
| `/operations` | Réception / sortie / ajustement + journal complet |
| `/catalogue` | Catalogue par catégorie, marges, seuils, fournisseur |
| `/fournisseurs` | Fiches, délais, réassort à passer par partenaire |
| `/equipe` | Membres et matrice 15 permissions × 5 rôles |
| `/settings` | Mode de données, tables et RPC exploités, contrat d’erreurs |
| `/login` · `/select-tenant` · `/onboarding` | Parcours d’authentification (layout dédié, sans shell) |

## Architecture de données

Une interface (`lib/data/repository.ts`), deux implémentations, choisies côté serveur par
`getAppContext()` (`lib/data/server-source.ts`) :

- **`SupabaseSource`** — PostgREST + RPC avec le JWT de l’utilisateur, borné au tenant actif.
  Lit `stock_overview`, `stock_movement_history`, `products`/`product_variants`,
  `list_tenant_members`, `list_tenant_roles` ; écrit via `post_stock_operation`.
- **`DemoSource`** — snapshot réel (`lib/data/snapshot.ts`), mutations en mémoire.

## Logique métier (testée)

`lib/data/logic.ts` et `lib/data/tenancy-helpers.ts` — aucune I/O, 19 tests :

| Fonction | Règle |
|---|---|
| `stockStatus` | `0` → rupture, `≤ seuil` → bas, sinon OK |
| `coverDays` | disponible ÷ consommation quotidienne (60 j) — **`null`** si aucun flux, jamais d’infini |
| `suggestedOrder` | `max(lot de réassort, manque)` |
| `sortByUrgency` | ruptures, puis couverture croissante, puis nom |
| `computeKpis` | valeur coût/vente, marge potentielle, coût du réassort |
| `slugify` / `isValidSlug` | règles du RPC `create_tenant` (ASCII, 2–63 car., pas de tiret double) |
| `pickActiveTenantId` | ignore un cookie forgé, sélectionne l’unique tenant sans cookie |

`tests/supabase-contract.test.ts` verrouille en plus **le contrat de schéma** : chaque colonne
demandée dans un `select=` PostgREST doit exister dans `public.*`. Ce test a détecté un vrai bug —
la vue `stock_movement_history` expose `operation_status` et `operation_id`, pas `status`/`id` ;
les écrans Opérations et Flux hebdomadaires auraient échoué en production.

## Contrat d’écriture

`POST /api/operations` valide la forme puis délègue à la base :

| Cas | Réponse |
|---|---|
| Ligne manquante, quantité nulle, doublon, motif absent (ajustement/inventaire), > 50 lignes | `422` + erreurs détaillées |
| Stock insuffisant | `409` avec le message de la base |
| Succès | `201` + l’opération |

Le RPC `post_stock_operation` reste l’autorité : `SECURITY DEFINER`, permission
`inventory.manage`, idempotence (clé + empreinte SHA-256), verrous `FOR UPDATE`, refus si
`on_hand < reserved`, annulation par `reversal`.

## Vérifications

- `npm run build` ✅ · `tsc --noEmit` ✅ · `npm test` **19/19** ✅
- Sans variables : 7 pages + API répondent 200, `/login` redirige vers `/` (démo ouverte).
- Avec variables (clé factice) : `/` et `/stock` renvoient `307 → /login?next=…`, `/login`
  s’affiche hors du shell, `/onboarding` protège son accès.
- API : refuse une sortie de 999 sacs de riz pour 3 en stock, un ajustement sans motif et un
  doublon de ligne.

## Suite

1. **Gestion des membres** : invitations (`invite_member`, expiration 14 j), changement de rôle,
   révocation — l’écran `/equipe` est aujourd’hui en lecture seule.
2. **Réinitialisation de mot de passe** (`resetPasswordForEmail` + page de saisie).
3. Transferts entre dépôts et inventaire guidé.
4. Alertes de rupture par email/WhatsApp à partir du réassort suggéré.
