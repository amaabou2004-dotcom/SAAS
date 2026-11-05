# Faire apparaître « Stokari » partout (au lieu de `…supabase.co`)

> **Le message que vous avez reçu** — *« Vous avez partagé certaines données de votre compte
> Google avec `suuchdahpftxwbvwhbyq.supabase.co` »* — est envoyé par **Google**, pas par Stokari.
> Il désigne l'application à laquelle l'accès a été accordé. Tant que l'écran de consentement
> Google n'est pas « vérifié » et que le retour de connexion passe par l'adresse technique de la
> base de données, Google affiche cette adresse. Ce document explique comment obtenir **« Stokari »**
> à la place, ce qui est déjà prêt dans le dépôt, et ce qu'il reste à faire dans les consoles.

---

## 1. Pourquoi Google affiche cette adresse

Le parcours de connexion Google de Stokari est celui de Supabase :

```text
Stokari → Google → https://<projet>.supabase.co/auth/v1/callback → Stokari
```

Google affiche **le domaine de l'adresse de retour** tant que la marque de l'application n'a pas
été **vérifiée** (nom + logo + domaine). Autrement dit :

| Ce qui manque | Conséquence visible |
| --- | --- |
| Domaine propre absent (site en `…netlify.app`) | Google ne peut pas vérifier `netlify.app` : impossible d'afficher le nom |
| Marque non soumise à vérification | Google montre `…supabase.co` au lieu de « Stokari » |
| Domaine personnalisé Supabase non activé | Le retour de connexion reste sur `*.supabase.co` |

Les scopes utilisés (`openid`, `email`, `profile`) sont **non sensibles** : il n'y a donc **pas**
d'audit de sécurité à passer. Seule la **vérification de marque** (« brand verification ») est
nécessaire — elle est **gratuite**.

---

## 2. Les trois leviers (ce qu'ils changent, ce qu'ils coûtent)

| Levier | Effet | Coût | Obligatoire ? |
| --- | --- | --- | --- |
| **A. Domaine propre** — `stokari.com` | Le site, les pages légales et la marque vivent sur un domaine que Google peut vérifier | 6 000–9 000 F CFA / an | **oui**, sans domaine vérifiable la marque ne peut pas être validée |
| **B. Vérification de marque Google** | Google affiche **« Stokari »** + le logo, et non plus l'adresse technique | 0 | **oui** pour que le nom apparaisse |
| **C. Domaine personnalisé Supabase** (ex. `auth.stokari.com`) | Le retour de connexion ne passe plus par `*.supabase.co` : même l'adresse affichée devient la vôtre | offre Pro Supabase 25 $/mois + option domaine 10 $/mois, soit ≈ 35 $/mois | non, mais c'est le seul moyen de faire disparaître complètement `supabase.co` |

Ordre recommandé : **A → B** (gratuit, règle le problème principal), puis **C** plus tard si le
budget le permet.

---

## 3. Étape A — Un nom de domaine à vous

C'est le prérequis de tout le reste : Google demande de prouver que vous possédez le domaine
(Search Console), ce qui est **impossible avec `…netlify.app`** (domaine de Netlify, pas le vôtre).

1. Le domaine retenu est **`stokari.com`** — achat, DNS et branchement Netlify détaillés dans
   [`../DOMAINE-STOKARI.md`](../DOMAINE-STOKARI.md) (6 000 à 9 000 F CFA par an).
2. Netlify → **Domain management → Add a domain** → suivez les enregistrements DNS indiqués
   (CNAME vers votre site, ou serveurs DNS Netlify). Laissez Netlify gérer le HTTPS.
3. Dans Supabase → **Authentication → URL Configuration** :
   - **Site URL** : `https://stokari.com`
   - **Redirect URLs** : `https://stokari.com/**` (+ `http://localhost:5173/**` pour le
     développement).
4. Mettez à jour le dépôt là où l'adresse apparaît :
   - `netlify.toml` / variables Netlify : `VITE_APP_URL=https://stokari.com` ;
   - `apps/web/src/features/legal/legal-info.ts` → `siteUrl` ;
   - dans Google Cloud → **Clients** → votre client OAuth → **Authorized JavaScript origins** :
     ajoutez `https://stokari.com`.

> **État au 5 novembre 2026** : `stokari.com` n'est pas encore acheté. Tant qu'il ne l'est pas,
> Google continuera d'afficher l'adresse technique de Supabase. Guide d'achat et de branchement :
> [`../DOMAINE-STOKARI.md`](../DOMAINE-STOKARI.md).

> **Note** : le site fonctionne déjà sur son adresse Netlify actuelle. Le domaine propre ne casse
> rien : ajoutez-le d'abord, vérifiez qu'il affiche bien Stokari, puis changez les URL ci-dessus.

---

## 4. Étape B — Vérifier la marque dans Google (gratuit)

Console : <https://console.cloud.google.com/auth/overview> (choisissez le projet qui porte le
client OAuth de Supabase).

### 4.1 Renseigner la marque (onglet **Branding**)

| Champ | Valeur à mettre |
| --- | --- |
| **App name** | `Stokari` (exactement, sans « Niger », sans tiret) |
| **User support email** | votre adresse de contact réelle (elle est visible des utilisateurs) |
| **App logo** | `apps/web/public/oauth-logo-120.png` — carré, exactement 120 × 120 px, < 1 Mo |
| **Application home page** | `https://stokari.com/` |
| **Application privacy policy link** | `https://stokari.com/confidentialite` |
| **Application terms of service link** | `https://stokari.com/conditions` |
| **Authorized domains** | `stokari.com` |
| **Developer contact email** | votre adresse (reçoit les messages de l'équipe Trust & Safety) |

Côté application, **rien n'est à créer** : la page d'accueil publique
(`apps/web/src/features/marketing/landing-page.tsx`) décrit le service, liste ses fonctions, et
renvoie vers la politique de confidentialité et les conditions générales. La politique de
confidentialité contient une section dédiée à la **connexion avec Google** (données reçues, usage,
durée, retrait de l'accès), ce que la vérification exige explicitement.

### 4.2 Prouver la propriété du domaine (Google Search Console)

1. <https://search.google.com/search-console> → **Ajouter une propriété** → type **Domaine**.
2. Copiez l'enregistrement **TXT** fourni (`google-site-verification=…`) chez votre registrar
   (ou dans Netlify → DNS).
3. Revenez dans Search Console → **Vérifier**. Comptez de quelques minutes à quelques heures.
4. Le domaine doit être vérifié par un **propriétaire ou éditeur** du projet Google Cloud.

### 4.3 Publier, puis demander la vérification

1. Onglet **Audience** : *User type* = **External**, statut de publication = **In production**
   (le mode « Testing » limite à quelques comptes de test et n'affiche jamais la marque).
2. Onglet **Branding** → bouton **Verify Branding**.
3. Suivez l'avancement dans **Verification Center**. Délai annoncé : **quelques minutes** si le
   contrôle automatique passe, **2 à 3 jours ouvrés** en revue manuelle.

> ⚠️ **Piège connu** : le robot de vérification ouvre votre écran de connexion, y lit le nom
> affiché (encore `…supabase.co`) et le compare au nom de votre page d'accueil → rejet
> « le nom affiché ne correspond pas ». Dans ce cas : faites d'abord l'étape C (domaine Supabase)
> ou répondez au fil de discussion Trust & Safety en expliquant que le domaine affiché est celui du
> fournisseur d'authentification.

### 4.4 Vérifier le résultat

En navigation privée, cliquez sur **Continuer avec Google** depuis `https://stokari.com` :

- l'écran Google doit afficher **Stokari** et le logo carré ;
- plus aucune mention « application non vérifiée » ;
- l'e-mail de sécurité de Google doit désormais citer **Stokari**.

Google peut conserver l'ancienne version quelques heures : retestez avec un autre compte ou
attendez la fin de la vérification.

---

## 5. Étape C — Domaine personnalisé Supabase (facultatif, payant)

Objectif : que l'adresse de retour ne soit plus `https://<projet>.supabase.co/auth/v1/callback`
mais `https://auth.stokari.com/auth/v1/callback`.

1. Supabase → **Project Settings → Custom Domains** → ajouter `auth.stokari.com`
   (nécessite l'offre **Pro** à 25 $/mois, plus l'option domaine à **10 $/mois**).
2. **Avant d'activer**, ajoutez dans Google Cloud → *Clients* → votre client OAuth :
   `https://auth.stokari.com/auth/v1/callback` dans **Authorized redirect URIs**.
3. Créez les enregistrements DNS demandés par Supabase, puis activez le domaine.
4. Mettez à jour `VITE_SUPABASE_URL` (Netlify, Vercel, `.env.local`) :
   `https://auth.stokari.com`. Rien d'autre ne change dans le code : le client Supabase lit
   cette variable.
5. Vérifiez la connexion Google, l'inscription par e-mail et la réinitialisation de mot de passe.

---

## 6. Étape D — Des e-mails d'authentification à votre nom

Aujourd'hui, les messages de vérification et de mot de passe partent par le service d'e-mail par
défaut de Supabase (adresse en `@mail.app.supabase.io`). C'est le dernier détail « pas très
professionnel » visible par vos utilisateurs, et il est **gratuit** à corriger.

### 6.1 Un expéditeur sur votre domaine

1. Créez un compte chez un service d'envoi (Brevo : 300 e-mails/jour gratuits ; Resend :
   3 000 e-mails/mois gratuits).
2. Ajoutez et validez votre domaine (`stokari.com`) chez ce prestataire.
3. Créez l'adresse expéditrice `no-reply@stokari.com` (ou `bonjour@…`).

### 6.2 Les enregistrements DNS qui évitent les indésirables

| Type | Nom | Valeur (exemple, fournie par le prestataire) |
| --- | --- | --- |
| TXT | `@` | `v=spf1 include:spf.brevo.com -all` |
| TXT (DKIM) | `mail._domainkey` | la clé fournie par le prestataire |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@stokari.com` |
| CNAME | `mail` (ou celui indiqué) | la cible fournie pour les liens de suivi |

Passez `p=none` → `p=quarantine` une fois quelques semaines d'envoi sans erreur.

### 6.3 Renseigner Supabase

Supabase → **Authentication → Emails / SMTP Settings** :

- **Sender email** : `no-reply@stokari.com` — **Sender name** : `Stokari`
- hôte, port `587`, utilisateur et mot de passe SMTP du prestataire
- puis **Envoyez un e-mail de test** et vérifiez le score sur <https://www.mail-tester.com>
  (viser 9/10 ou plus).

### 6.4 Les modèles de message

Les trois modèles sont déjà dans le dépôt, à la charte de la marque (bandeau bleu nuit, logo texte,
code lisible, pied de page avec liens légaux) :

| Fichier | Usage |
| --- | --- |
| `supabase/templates/confirmation.html` | code de vérification à l'inscription |
| `supabase/templates/recovery.html` | réinitialisation du mot de passe |
| `supabase/templates/email-change.html` | confirmation de la nouvelle adresse |

Ils sont déclarés dans `supabase/config.toml` pour le développement local. En production, copiez
leur contenu dans Supabase → **Authentication → Emails → Templates** (mêmes variables
`{{ .Token }}`, `{{ .ConfirmationURL }}`, `{{ .SiteURL }}`).

> `{{ .SiteURL }}` reprend l'URL du site configurée dans Supabase : les liens du pied de page
> pointent donc automatiquement vers votre domaine, sans modification du modèle.

---

## 7. Ce qui change concrètement

| Aujourd'hui | Après les étapes A + B (+ C) |
| --- | --- |
| « … avec `suuchdahpftxwbvwhbyq.supabase.co` » | « … avec **Stokari** » |
| Écran Google sans marque | Logo + nom **Stokari** |
| Adresse de retour `*.supabase.co` | `auth.stokari.com` (étape C) |
| E-mails depuis `@mail.app.supabase.io` | E-mails « Stokari » depuis `no-reply@stokari.app` |
| Page d'accueil = formulaire de connexion | Page de présentation + pages légales complètes |

L'avis de sécurité de Google, lui, continuera d'exister : c'est un message automatique envoyé à
chaque première autorisation. Seul son contenu (le nom de l'application) change.

---

## 8. Checklist

- [ ] Domaine acheté et branché sur Netlify (HTTPS actif).
- [ ] `Site URL` et `Redirect URLs` Supabase mises à jour avec le domaine.
- [ ] `VITE_APP_URL`, `legalInfo.siteUrl` et `netlify.toml` à jour.
- [ ] Propriété du domaine vérifiée dans Search Console.
- [ ] Écran de consentement : nom `Stokari`, logo 120 × 120, accueil, confidentialité, conditions.
- [ ] `Authorized domains` = votre domaine uniquement.
- [ ] Application publiée « In production ».
- [ ] **Verify Branding** envoyé, résultat positif.
- [ ] Test en navigation privée : « Stokari » visible, aucune alerte.
- [ ] (Option) Domaine personnalisé Supabase `auth.<domaine>` + URI de retour Google.
- [ ] SMTP propre, SPF/DKIM/DMARC, e-mail de test ≥ 9/10.
- [ ] Modèles d'e-mail copiés dans Supabase (production).

---

## 9. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| Toujours `…supabase.co` après vérification | Domaine Supabase non personnalisé : Google affiche l'hôte de retour | Étape C, ou accepter que le nom s'affiche à côté |
| « Verify Branding » refusé : nom différent | Le robot lit encore `…supabase.co` | Étape C en premier, ou message à Trust & Safety |
| Bouton « Verify Branding » absent | Application encore en « Testing » ou domaine non autorisé | Passer en production, ajouter le domaine |
| Google affiche « Stokari » mais le site non | Cache du navigateur / ancienne version | Recharger, tester en navigation privée |
| E-mails en indésirables | SPF, DKIM ou DMARC manquant | Reprendre 6.2, retester sur mail-tester |
| « redirect_uri_mismatch » | URI de retour absente du client OAuth | Ajouter l'URI **exacte** (avec `/auth/v1/callback`) |

---

## 10. Références

- Règles Google sur la vérification de marque : <https://developers.google.com/identity/verification>
- Domaine personnalisé Supabase : <https://supabase.com/docs/guides/platform/custom-domains>
- Configuration Google dans ce dépôt : [`google-oauth.md`](./google-oauth.md)
- Déploiement du site : [`../DEPLOIEMENT-NETLIFY.md`](../DEPLOIEMENT-NETLIFY.md)
- Alertes e-mail des commandes : [`../EMAIL-COMMANDES.md`](../EMAIL-COMMANDES.md)
