# Déployer Stokari sur Netlify

> **Tout est déjà configuré dans le dépôt.** Le fichier `netlify.toml` contient la commande de
> build, le dossier publié, la réécriture SPA, les en-têtes de cache/sécurité et les variables
> publiques du front. Il n'y a **aucun réglage à faire à la main** dans Netlify.

---

## 0. Combien ça coûte : **0 F CFA**

| Poste | Offre utilisée | Prix |
| --- | --- | --- |
| Site Stokari | **Netlify Free** (100 Go/mois, builds illimités) | 0 |
| Base de données, comptes, photos | **Supabase Free** | 0 |
| Nom de domaine | l'adresse fournie (`…netlify.app`) | 0 |
| Abonnement dans l'application | **il n'y en a aucun** | 0 |

Aucune carte bancaire n'est demandée.

---

## 1. Ce qui est déjà fait (vérifié)

| Élément | État |
| --- | --- |
| `netlify.toml` versionné (build, dossier, SPA, en-têtes, variables) | ✅ |
| Build de production rejoué localement avec les mêmes variables | ✅ `apps/web/dist`, 9 fichiers, 127 ko compressés |
| Node 22 + pnpm 10.22 déclarés dans `netlify.toml` | ✅ (la version du dépôt) |
| Supabase → **Site URL** = `https://stokari.netlify.app` | ✅ |
| Supabase → **Redirect URLs** : `stokari.netlify.app` + `https://*.netlify.app/**` | ✅ |
| Google OAuth : origine à ajouter après le premier déploiement | ⏳ (étape 4) |

---

## 2. Déploiement (2 minutes, une seule fois)

1. Ouvrez <https://app.netlify.com/start>.
2. **Import from Git** → GitHub → autorisez puis choisissez `amaabou2004-dotcom/SAAS`.
3. Netlify lit `netlify.toml` et affiche :
   - **Build command** : `pnpm --filter @saas/web build`
   - **Publish directory** : `apps/web/dist`
   - **Base directory** : racine du dépôt
   → **ne modifiez rien**.
4. **Branch to deploy** : `arena/a1588569-saas` (la branche actuellement développée ;
   plus tard `main`).
5. **Deploy site**. Le premier build prend 2 à 4 minutes (installation pnpm de tout le
   monorepo).

### Nom du site (facultatif mais recommandé)

**Site configuration → Change site name** → `stokari` → l'adresse devient
`https://stokari.netlify.app`, exactement celle déjà autorisée dans Supabase.
Si ce nom est déjà pris, Netlify en attribue un autre (`stokari-xxxx.netlify.app`) : il est
couvert par la règle `https://*.netlify.app/**`, donc **rien ne casse**.

---

## 3. Variables d'environnement

Elles sont **déjà dans `netlify.toml`** (valeurs publiques, clé `publishable`) :

```text
VITE_SUPABASE_URL=https://suuchdahpftxwbvwhbyq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_-zxno-IY7ZlBHBM9L_cbNw_QJxtaD0q
VITE_DATA_MODE=direct
VITE_GOOGLE_AUTH_ENABLED=true
```

Pour les changer sans toucher au dépôt : **Site configuration → Environment variables**
(les variables du tableau de bord sont prioritaires sur `netlify.toml`).

⚠️ Ne jamais y mettre la clé `service_role` : tout ce qui commence par `VITE_` finit dans le
navigateur.

---

## 4. Après le premier déploiement

### a. Vérifier l'adresse réelle

Ouvrez l'URL donnée par Netlify. Si elle diffère de `stokari.netlify.app`, dites-le moi :
j'ajuste **Site URL** dans Supabase (les redirections, elles, sont déjà couvertes).

### b. Connexion Google

Dans Google Cloud Console → *Credentials* → votre client OAuth :

- **Authorized JavaScript origins** : ajoutez `https://stokari.netlify.app` (ou l'URL réelle)
- **Authorized redirect URIs** : `https://suuchdahpftxwbvwhbyq.supabase.co/auth/v1/callback`
  (déjà présente)

### c. Vérifier en 4 clics

1. Ouvrez l'URL Netlify.
2. Créez un compte (e-mail + mot de passe de 12 caractères).
3. Créez l'entreprise → ajoutez un produit → saisissez du stock.
4. Rechargez la page : session et données restent (elles vivent dans Supabase).

### d. Plus tard : nom de domaine personnalisé

**Domain management → Add a domain** (ex. `stokari.shop`). Ensuite, ajoutez ce domaine dans
**Supabase → Authentication → URL Configuration**. Aucun code à modifier.

---

## 5. Déploiements suivants

Chaque `git push` sur la branche de production reconstruit et publie le site
automatiquement (~2 minutes). Les autres branches donnent un **aperçu** avec sa propre URL
(déjà autorisée dans Supabase).

Deux fichiers cohabitent volontairement :

| Fichier | Plateforme |
| --- | --- |
| `netlify.toml` | Netlify (cible actuelle) |
| `vercel.json` | Vercel (alternative, conservée) |

Ils ne se gênent pas : chaque plateforme ne lit que son fichier.

---

## 6. Et l'API NestJS ?

En mode `direct`, le navigateur parle directement à Supabase : **l'API NestJS n'est pas
déployée** et les règles restent garanties par la base (RLS en lecture, fonctions
`security definer` en écriture). Pour la publier plus tard : Netlify Functions (adaptateur
Express) ou un hébergeur Node, puis repasser `VITE_DATA_MODE=api`.

---

## 7. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| Build : `ERR_PNPM_OUTDATED_LOCKFILE` | `pnpm-lock.yaml` non poussé | commiter le lockfile, relancer |
| Build : `command not found: pnpm` | `PNPM_VERSION` ignoré | vérifier `NODE_VERSION=22` et `PNPM_VERSION=10.22.0` dans `netlify.toml` |
| Page blanche, message « configuration manquante » | variables `VITE_*` absentes du build | vérifier `[build.environment]` puis relancer un build avec **Clear cache** |
| Connexion Google : `redirect_uri_mismatch` | origine absente dans Google Cloud | étape 4.b |
| Lien de réinitialisation invalide | domaine absent de Supabase | ajouter l'URL dans **Redirect URLs** |
