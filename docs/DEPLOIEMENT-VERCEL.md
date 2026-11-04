# Déployer Stokari sur Vercel (alternative)

> **Cible actuelle : Netlify.** Voir [`DEPLOIEMENT-NETLIFY.md`](./DEPLOIEMENT-NETLIFY.md).
> Ce guide reste valable si tu préfères Vercel : `vercel.json` est conservé et à jour.

> Tout est prêt dans le dépôt : `vercel.json` à la racine, Supabase déjà autorisé pour le
> domaine Vercel. Il ne reste que l'import du projet.

---

## 0. Combien ça coûte : **0 F CFA**

Stokari est **gratuit pour le moment**, y compris pour le faire tourner :

| Poste | Offre utilisée | Prix |
| --- | --- | --- |
| Hébergement du site | **Vercel Hobby** (plan gratuit) | 0 |
| Base de données, comptes, photos | **Supabase Free** (plan gratuit) | 0 |
| Nom de domaine | l'adresse fournie par Vercel (`…vercel.app`) | 0 |
| Paiement dans l'application | **il n'y en a aucun** : pas d'abonnement, pas de carte | 0 |

Aucune carte bancaire n'est demandée pour ces deux plans gratuits. Le jour où le trafic
dépasse le plan gratuit (beaucoup de visiteurs ou beaucoup de photos), Vercel et Supabase
préviennent avant de facturer : il suffit alors de choisir un plan payant, ou de rester sur le
gratuit en supprimant d'anciennes photos.

---

## 1. Ce qui est déjà fait

| Élément | État |
| --- | --- |
| `vercel.json` (build, sortie, réécriture SPA, en-têtes) | ✅ versionné |
| Build vérifié en local (`pnpm --filter @saas/web build` → `apps/web/dist`) | ✅ 880 Ko, 9 fichiers |
| Domaine Vercel autorisé dans **Supabase → Auth → Redirect URLs** | ✅ |
| `Site URL` Supabase | `https://stokari.vercel.app` |
| Mode de données retenu pour l'hébergement | `direct` (navigateur → Supabase) |

---

## 2. Déploiement — option A (recommandée, 2 minutes)

Le dépôt GitHub est public : l'import direct est le plus simple.

1. Ouvrez <https://vercel.com/new>.
2. **Import Git Repository** → choisissez `amaabou2004-dotcom/SAAS`.
3. Réglages du projet :

   | Champ | Valeur |
   | --- | --- |
   | Framework Preset | **Vite** |
   | Root Directory | *(laisser vide — la racine du dépôt)* |
   | Install Command | `pnpm install --frozen-lockfile` |
   | Build Command | `pnpm --filter @saas/web build` |
   | Output Directory | `apps/web/dist` |
   | Node.js Version | **22.x** |

   Ces valeurs sont déjà dans `vercel.json` ; l'écran les reprend automatiquement.
   Vérifiez simplement qu'elles sont bien affichées.

4. **Environment Variables** (à créer avant le premier build) :

   | Nom | Valeur | Portées |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | `https://suuchdahpftxwbvwhbyq.supabase.co` | Production, Preview, Development |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_-zxno-IY7ZlBHBM9L_cbNw_QJxtaD0q` | Production, Preview, Development |
   | `VITE_DATA_MODE` | `direct` | Production, Preview, Development |
   | `VITE_GOOGLE_AUTH_ENABLED` | `true` | Production, Preview, Development |

   Copier-coller (nom = valeur, une par ligne) :

   ```text
   VITE_SUPABASE_URL=https://suuchdahpftxwbvwhbyq.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_-zxno-IY7ZlBHBM9L_cbNw_QJxtaD0q
   VITE_DATA_MODE=direct
   VITE_GOOGLE_AUTH_ENABLED=true
   ```

   ⚠️ Ce sont des valeurs **publiques** (clé `publishable`). Ne jamais mettre la clé
   `service_role` dans une variable `VITE_*`.

5. **Deploy**. Le build prend ~1 minute.

6. Dans **Settings → Git**, mettez **Production Branch** sur la branche que vous voulez
   publier (`arena/a1588569-saas` aujourd'hui, `main` une fois fusionnée).

## 3. Déploiement — option B (Arena)

Le connecteur Vercel d'Arena peut créer le projet et déployer **si le jeton a les
permissions « projets / déploiements »**.

État au 4 novembre 2026 : le jeton **authentifie bien le compte** (profil, équipes, domaines
et journal d'activité répondent — compte `amaabou2004-dotcom`, plan Hobby), mais **tous les
points d'entrée « projets / déploiements » répondent `Authentication failed`** :

```
GET  /v11/projects              -> Authentication failed
POST /v11/projects              -> Authentication failed
POST /v13/deployments           -> Authentication failed
```

Autrement dit, la portée « projets » manque au jeton. → Dans Arena, **déconnectez puis
reconnectez Vercel** en acceptant toutes les portées demandées ; il suffit ensuite de dire
« déploie sur Vercel ». Rien d'autre à préparer : `vercel.json`, les variables et les URL
Supabase sont déjà en place.

---

## 4. Après le premier déploiement

### a. Vérifier l'adresse réelle

Vercel attribue `<projet>.vercel.app` (ou `<projet>-<suffixe>.vercel.app` si le nom est
pris). L'allow-list Supabase couvre déjà :

- `https://stokari.vercel.app`
- `https://stokari*.vercel.app/**` (aperçus de branche)

Si le domaine attribué diffère (autre nom de projet), ajoutez-le dans
**Supabase → Authentication → URL Configuration → Redirect URLs**.

### b. Connexion Google

Dans Google Cloud Console → *Credentials* → votre client OAuth :

- **Authorized JavaScript origins** : ajoutez `https://<projet>.vercel.app`
- **Authorized redirect URIs** : `https://suuchdahpftxwbvwhbyq.supabase.co/auth/v1/callback`
  (déjà présent si Google fonctionne en local)

### c. Vérifier

1. Ouvrez l'URL Vercel.
2. Créez un compte : e-mail + mot de passe.
3. Créez votre entreprise → ajoutez un produit → saisissez le stock.
4. Rechargez la page : la session et les données restent (elles vivent dans Supabase).

---

## 5. Et l'API NestJS ?

En production « direct », le navigateur parle à Supabase et **l'API NestJS n'est pas
déployée** : les règles restent garanties par la base (RLS pour la lecture, fonctions
`security definer` pour l'écriture).

Pour publier aussi l'API plus tard, deux options :

| Option | Avantage | Inconvénient |
| --- | --- | --- |
| **Fonction serverless** (`api/index.ts` exportant l'app NestJS) | une seule plateforme | démarrage à froid, limite de taille |
| **Hébergeur Node** (Render, Railway, Fly.io) | vraie process Node, Swagger actif | second fournisseur à gérer |

Dans les deux cas, il suffira ensuite de repasser `VITE_DATA_MODE=api` et de définir
`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` côté serveur. Aucun écran à modifier.

---

## 6. Récapitulatif des fichiers concernés

| Fichier | Rôle |
| --- | --- |
| `vercel.json` | framework, commandes, dossier de sortie, réécriture SPA, en-têtes de cache |
| `apps/web/.env.example` | variables attendues par le front |
| `apps/web/src/lib/data-mode.ts` | bascule `api` / `direct` |
| `apps/web/src/features/onboarding/direct-data.ts` | pont navigateur → Supabase |
