# Stokari

Plateforme multi-entreprises de gestion commerciale, de stock et de boutiques en ligne.

> **État actuel : itération 5 — identité, entreprise, catalogue, stock, ventes, rapports et équipe.**
> La caisse est en place (panier, ticket numéroté, encaissement espèces / Mobile Money / crédit,
> annulation tracée), les rapports aussi (CA, marge, top produits, produits dormants, export
> CSV), ainsi que la gestion de l’équipe (invitations, rôles, acceptation automatique à la
> connexion). Les boutiques publiques et les abonnements ne sont pas encore implémentés.
> L’interface ne présente aucune donnée commerciale fictive.

## Déploiement sur Vercel

Le dépôt est prêt : `vercel.json` décrit le build du front (`apps/web/dist`), la réécriture
SPA et les en-têtes de cache.

1. <https://vercel.com/new> → import du dépôt `amaabou2004-dotcom/SAAS` ;
2. Framework **Vite**, Root Directory **vide**, Node **22.x** ;
3. Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DATA_MODE=direct`,
   `VITE_GOOGLE_AUTH_ENABLED=true` ;
4. Deploy.

Guide détaillé, vérifications et configuration Google/Supabase :
[`docs/DEPLOIEMENT-VERCEL.md`](./docs/DEPLOIEMENT-VERCEL.md).

## Endpoints de service

| Route | Rôle |
| --- | --- |
| `GET /` | page de découverte (service, version, liens) — évite une 404 sur l’URL racine |
| `GET /api/v1` | même contenu, sous le préfixe de l’API |
| `GET /api/v1/health` | état du service |
| `/api/docs` | Swagger (développement) |

> **Vous reprenez le projet ?** Lisez d'abord [`docs/REPRENDRE.md`](./docs/REPRENDRE.md) :
> une page unique qui dit ce qui est le projet, ce qui marche, ce qui manque, et par quoi continuer.

## Modes d’accès aux données

Le front n’a qu’un seul point d’entrée réseau (`apiFetch`), ce qui permet deux modes :

| Mode | Variable | Chemin | Usage |
| --- | --- | --- | --- |
| `api` *(défaut)* | `VITE_DATA_MODE=api` | navigateur → API NestJS (`/api/v1`) → Supabase | production : autorisation et règles métier dans l’API |
| `direct` | `VITE_DATA_MODE=direct` | navigateur → Supabase (PostgREST + RPC) | aperçu / démonstration quand l’API n’est pas joignable |

En mode `direct`, les garanties ne changent pas de nature : la RLS filtre les lectures
(`is_tenant_member`, `has_tenant_permission`, vues en `security_invoker`) et **aucune écriture
directe en table n’est possible** — tout passe par les RPC `security definer`
(`create_tenant`, `upsert_category`, `upsert_product`, `upsert_stock_location`,
`post_stock_operation`). Le contrat de données est identique (mêmes formes, validées par zod),
les deux modes sont donc interchangeables sans toucher aux écrans.

## Parcours disponible dans le code

- inscription par e-mail et mot de passe ;
- vérification par code OTP à 8 chiffres ou lien de confirmation ;
- connexion Google OAuth sans OTP, après activation du fournisseur ;
- connexion et récupération du mot de passe ;
- création transactionnelle d’une entreprise ;
- attribution du rôle propriétaire et de ses permissions ;
- isolation des tenants par PostgreSQL RLS ;
- catégories, produits/variantes et emplacements tenant-scopés ;
- stock physique, réservé et disponible calculé, avec réceptions, ajustements et transferts transactionnels ;
- historique immuable et contre-passations avec motif et idempotence ;
- API NestJS documentée avec Swagger en développement.

Une instance Supabase configurée est indispensable pour exécuter réellement ces parcours. Sans elle, les formulaires d’authentification restent désactivés et affichent un message de configuration explicite.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS et TanStack Query ;
- NestJS, Supabase Auth et PostgreSQL ;
- Supabase CLI, migrations SQL et tests pgTAP ;
- Vitest, Testing Library et Supertest ;
- pnpm workspaces et ESLint.

## Prérequis

- Node.js 22.12 ou supérieur ;
- Corepack/pnpm 10 ;
- Docker pour exécuter Supabase localement et les tests de base de données.

## Installation

```bash
corepack enable pnpm
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Démarrez ensuite Supabase :

```bash
pnpm supabase:start
```

La commande affiche les URL et clés **locales**. Recopiez uniquement la clé publiable/anon dans les deux fichiers `.env` :

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=...
```

Ne placez jamais une clé `service_role`, une clé secrète, un client secret Google ou une clé Resend dans une variable `VITE_`.

Pour activer la connexion Google, suivez [le guide OAuth sécurisé](./docs/security/google-oauth.md), puis définissez `VITE_GOOGLE_AUTH_ENABLED=true` uniquement après activation du fournisseur Supabase.

## Développement

```bash
pnpm dev
```

- Web : `http://localhost:5173`
- API : `http://localhost:3001/api/v1`
- Swagger : `http://localhost:3001/api/docs`
- Studio Supabase local : `http://localhost:54323`
- Boîte e-mail de test Mailpit : `http://localhost:54324`

## Test E2E réel (Supabase local + Mailpit)

Ce parcours utilise de vrais comptes jetables, lit le code OTP dans Mailpit, puis exerce les formulaires d’entreprise, de catalogue et de stock. Il vérifie aussi l’isolation d’un second compte et supprime ses données de test à la fin.

Avec Docker et Supabase local démarrés, et après avoir arrêté les serveurs Web/API qui utiliseraient déjà les ports 5173 et 3001 :

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Le lanceur récupère uniquement les clés locales affichées par `supabase status`, démarre les serveurs Web/API et refuse une base de données distante. Aucun e-mail réel n’est envoyé et aucune clé `service_role` n’est utilisée.

Le navigateur appelle uniquement des URL relatives `/api`. Vite transmet ces requêtes à NestJS ; aucun code frontend ne dépend d’un `localhost` pour atteindre l’API.

## Vérifications

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Avec Supabase local démarré :

```bash
pnpm test:db
pnpm test:db:concurrency
pnpm db:lint
```

Les tests SQL couvrent la structure, les contraintes, les privilèges, l’isolation de deux tenants, les transferts et les contre-passations. Le script de concurrence utilise deux connexions PostgreSQL indépendantes pour vérifier l’absence de survente et de doublon. Ils nécessitent un vrai PostgreSQL/Supabase et ne sont pas remplacés par les tests unitaires JavaScript.

## Structure

```text
apps/
  web/                 React, authentification et onboarding
  api/                 API NestJS
supabase/
  migrations/          Schéma et fonctions transactionnelles
  tests/               Tests pgTAP et isolation RLS
  config.toml          Configuration Auth/OTP locale
.github/workflows/     CI application et base de données
docs/                  Décisions et consignes de sécurité
```

## Règles de sécurité actuelles

- Supabase Auth conserve les mots de passe ; aucune table applicative ne les stocke.
- La création d’entreprise exige un utilisateur authentifié avec e-mail confirmé.
- Le rôle `authenticated` ne peut pas insérer directement dans `tenants`, `roles` ou `memberships`.
- La fonction `create_tenant` vérifie son appelant et réalise toutes les écritures dans une seule transaction.
- Les écritures catalogue et stock passent par des RPC transactionnelles ; les soldes et mouvements ne sont pas modifiables directement par le rôle `authenticated`.
- Les transferts conservent les quantités, les retraits verrouillent les soldes et les clés d’idempotence sont liées à une empreinte du payload.
- Les helpers `SECURITY DEFINER` fixent `search_path` et exposent uniquement les opérations nécessaires.
- L’API utilise le jeton de l’utilisateur et une clé publiable, pas une clé secrète contournant la RLS.
- Les erreurs de base sensibles ne sont pas renvoyées au navigateur.

## Avant la production

Cette première tranche ne suffit pas pour une mise en production. Il reste notamment à brancher un SMTP personnalisé, activer le CAPTCHA, tester la restauration, finaliser les durées de session, exécuter les tests E2E avec de vrais e-mails et faire auditer les migrations sur l’environnement cible.

## Licence

GNU AGPL-3.0. Voir [LICENSE](./LICENSE).
