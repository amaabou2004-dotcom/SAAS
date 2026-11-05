# Acheter et brancher `stokari.com`

> **En une phrase** : c'est l'adresse courte et crédible de votre service
> (`https://stokari.com`), et c'est aussi la condition technique pour que Google affiche
> « Stokari » au lieu de `…supabase.co`. Compter **6 000 à 9 000 F CFA par an**, rien d'autre.
>
> ⚠️ Le domaine s'écrit exactement comme la marque : **`stokari.com`** (un seul « c »).
> Si le site s'appelait `stockari.com`, Google refuserait la vérification de marque : le nom de
> l'application doit être identique partout.

---

## 1. Acheter le domaine (15 minutes)

Un domaine s'achète chez un **registrar** (un vendeur d'adresses). Les plus fiables et sans
mauvaise surprise :

| Registrar | Prix indicatif `.com` | Points forts |
| --- | --- | --- |
| **Cloudflare Registrar** | ~10 $/an, prix coûtant | aucune marge, protection Whois incluse, DNS rapide |
| **Porkbun** | ~11 $/an | interface simple, Whois masqué gratuit |
| **Namecheap** | ~12 $/an | très répandu, support correct |
| **OVH / Gandi** | ~13–16 $/an | facture en euros, support francophone |

Mode d'emploi, quel que soit le vendeur :

1. Tapez `stokari.com` dans la recherche de leur site pour vérifier qu'il est libre.
2. Prenez-le pour **1 an** (pas besoin de 5 ans).
3. **Activez le renouvellement automatique** et la **protection Whois** (souvent gratuite) : sans
   elle, votre nom, adresse et téléphone deviennent publics.
4. Utilisez une adresse e-mail que vous consultez vraiment : c'est là qu'arrivent les rappels et
   les codes de vérification.
5. Paiement : carte Visa/Mastercard. Beaucoup de plateformes acceptent aussi PayPal.

> **À vérifier avant de payer** : le prix de la **deuxième année** (certains vendeurs cassent le
> prix la première année puis doublent). Le tableau ci-dessus indique un ordre de grandeur annuel
> courant, pas un tarif garanti.

---

## 2. Brancher le domaine sur Netlify

Dans Netlify → votre site → **Domain management → Add a domain** → saisir `stokari.com`.

### Option A — recommandée : confier les DNS à Netlify

1. Netlify propose **« Set up Netlify DNS »** et affiche **quatre serveurs de noms**
   (du type `dns1.p0X.nsone.net`).
2. Chez votre registrar → **Nameservers / Serveurs DNS** → remplacez-les par ceux de Netlify.
3. Attendez de 1 à 24 heures (souvent moins de 2 heures).

### Option B — garder les DNS du registrar

Netlify affiche les deux enregistrements à créer chez le registrar :

| Type | Nom | Valeur |
| --- | --- | --- |
| `A` | `@` (racine) | l'adresse affichée par Netlify (souvent `75.2.60.5`) |
| `CNAME` | `www` | `<nom-du-site>.netlify.app` |

Le HTTPS est ensuite émis **automatiquement et gratuitement** par Netlify (certificat Let's
Encrypt). Rien à acheter en plus.

---

## 3. Vérifier que tout est en place

1. <https://stokari.com> s'ouvre, avec un cadenas, et affiche la page d'accueil Stokari.
2. <https://www.stokari.com> ouvre le même site (Netlify redirige vers le domaine principal).
3. Dans Netlify → **Domain management**, `stokari.com` est marqué **Primary domain**, et
   « HTTPS » est actif.

Si l'une de ces trois cases n'est pas cochée, ne passez pas à l'étape suivante.

---

## 4. Mettre à jour les adresses (une seule fois)

| Où | Quoi mettre |
| --- | --- |
| Supabase → **Authentication → URL Configuration** | **Site URL** : `https://stokari.com` |
| Supabase → mêmes réglages | **Redirect URLs** : `https://stokari.com/**` (gardez aussi `http://localhost:5173/**`) |
| Google Cloud → **Clients** → client OAuth | **Authorized JavaScript origins** : ajouter `https://stokari.com` |
| Google Cloud | **Authorized redirect URIs** : inchangé — c'est l'adresse Supabase (`…supabase.co/auth/v1/callback`) |
| Netlify → variables d'environnement | `VITE_APP_URL=https://stokari.com` (déjà dans `netlify.toml`) |
| Search Console | vérifier la propriété `stokari.com` (enregistrement TXT) |
| Vercel (si utilisé un jour) | même variable `VITE_APP_URL` |

Côté code, **rien à modifier** : `VITE_APP_URL` alimente automatiquement l'adresse publique
(`legalInfo.siteUrl`), le plan du site (`/sitemap.xml`) et les liens des documents légaux.

---

## 5. Facultatif : une adresse e-mail à votre nom

Pour recevoir du courrier à `contact@stokari.com`, ajoutez chez votre registrar les
enregistrements **MX** de votre messagerie (Google Workspace, Zoho — offre gratuite pour un
domaine, ou Proton). Pour **envoyer** les e-mails de Stokari (vérification, mot de passe), voir la
partie « SMTP » de [`security/identite-google-oauth.md`](./security/identite-google-oauth.md).

---

## 6. Récapitulatif des coûts

| Poste | Prix |
| --- | --- |
| Domaine `stokari.com` | 6 000 – 9 000 F CFA / an |
| HTTPS (certificat) | 0 — inclus chez Netlify |
| Site, base de données, comptes | 0 — offres gratuites déjà utilisées |
| Vérification de marque Google | 0 |
| **Total** | **le prix du domaine, rien de plus** |

---

## 7. Ce qui est déjà prêt dans le dépôt

- l'adresse publique centralisée (`VITE_APP_URL` → `legalInfo.siteUrl`), plus aucune adresse
  Netlify codée en dur ;
- une page d'accueil publique qui décrit le service, avec liens vers la confidentialité, les
  conditions et les mentions légales ;
- `robots.txt` + `sitemap.xml` sur `https://stokari.com` ;
- le logo carré 120 × 120 pour l'écran de consentement Google ;
- le guide complet de la marque Google : [`security/identite-google-oauth.md`](./security/identite-google-oauth.md).

Il ne reste que les achats et les clics dans les consoles, décrits ci-dessus.
