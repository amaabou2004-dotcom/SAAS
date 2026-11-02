# Quelles APIs intégrer dans SAAS (depuis `public-apis`)

> Source analysée : [public-apis/public-apis](https://github.com/public-apis/public-apis) — 2 281 APIs listées, dont **1 106 sans clé API**.
> Critères de sélection : **sans clé** (onboarding instantané), **HTTPS + JSON**, **CORS activé** (appel direct depuis le front), **utilisable en prod**, **ouvert/fair-use**.
> Contexte : Niamey, Niger → j'ai privilégié les APIs qui couvrent l'Afrique de l'Ouest (XOF, NE, zone UEMOA).

---

## 1. Le top 5 : à intégrer en premier

| # | API | Catégorie `public-apis` | Clé ? | Endpoint exemple | Pourquoi pour ton SaaS |
|---|-----|------------------------|------|------------------|----------------------|
| 1 | **Frankfurter** | Currency Exchange | ❌ | `https://api.frankfurter.dev/v2/rate/eur/xof` | Taux **XOF/XAF** via la **BCEAO** (source officielle), historique depuis 1998, **aucune limite**, CORS. Indispensable si tu factures en FCFA. |
| 2 | **Open-Meteo** | Weather / Environment | ❌ | `https://api.open-meteo.com/v1/forecast?latitude=13.51&longitude=2.11&current=temperature_2m` | Météo mondiale (utile pour agri, logistique, tourisme au Sahel), air quality, archive depuis 1940. 10 000 req/jour **non-commercial**. |
| 3 | **Nager.Date** | Calendar | ❌ | `https://date.nager.at/api/v3/NextPublicHolidays/NE` | Jours fériés — **le Niger (NE) est couvert**. Parfait pour les échéances de facturation / SLA / relances. |
| 4 | **REST Countries** | Geocoding | ❌ | `https://restcountries.com/v3.1/alpha/ne?fields=name,currencies,languages` | Pays, devises, langues, indicatifs téléphoniques, drapeaux. Utile pour les sélecteurs de pays au signup et la normalisation des adresses. |
| 5 | **DummyJSON** | Test Data | ❌ | `https://dummyjson.com/products?limit=10` | Données fakes (produits, users, posts) pour **développer et démontrer** le SaaS avant la vraie DB. Auth simulée incluse. |

### Exemples prêts à copier

```ts
// 1) Taux EUR → XOF (BCEAO, pas de clé)
const fx = await fetch("https://api.frankfurter.dev/v2/rate/eur/xof").then(r => r.json());
// → { date: "...", base: "EUR", quote: "XOF", rate: 655.957 }

// 2) Météo à Niamey
const wx = await fetch(
  "https://api.open-meteo.com/v1/forecast?latitude=13.51&longitude=2.11" +
  "&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto"
).then(r => r.json());

// 3) Prochains jours fériés au Niger
const holidays = await fetch("https://date.nager.at/api/v3/NextPublicHolidays/NE").then(r => r.json());

// 4) Fiche pays (devise + langue) pour un sélecteur
const country = await fetch(
  "https://restcountries.com/v3.1/alpha/ne?fields=name,currencies,languages,flag"
).then(r => r.json());
```

> ⚠️ **Nominatim** (geocoding, aussi sans clé) est dans la liste, mais impose un `User-Agent` identifiable et **max 1 req/s** : à appeler **côté serveur uniquement**, jamais depuis le navigateur.

---

## 2. Catalogue par besoin produit

### 💳 Paiement / facturation / finance
| API | Clé | Note |
|-----|-----|------|
| Frankfurter | ❌ | Taux BCEAO/BCE, historique, conversion — le meilleur choix pour XOF |
| CoinGecko | ❌ | Prix crypto (si tu acceptes USDT/BTC) — quota gratuit ~10-30 req/min, **cache 60 s obligatoire** |
| Binance (public endpoints) | ❌ | Tick data crypto, sans clé pour les endpoints publics |
| PurgoMalum | ❌ | Filtre de grossièretés sur les champs libres (noms, messages) |

### 🌍 Géolocalisation / pays
| API | Clé | Note |
|-----|-----|------|
| REST Countries | ❌ | Fiches pays, devises, langues, drapeaux |
| ipwhois.io / ip-api.com | ❌ | Géoloc de l'IP visiteur (pays → devise/langue par défaut). ip-api = HTTP only en gratuit |
| Nominatim (OSM) | ❌ | Adresse → coordonnées. Serveur only, 1 req/s |
| Open-Meteo Geocoding | ❌ | Recherche de villes **+ fuseau horaire**, très léger — meilleur que Nominatim pour de l'autocomplete |

### 🗓️ Planification / RH / calendrier
| API | Clé | Note |
|-----|-----|------|
| Nager.Date | ❌ | Fériés, ~100 pays, **NE couvert** |
| caldays | ❌ | Fériés pour **195+ pays** — si NE manque quelque part, c'est le plan B |
| Nager.Date `IsTodayPublicHoliday` | ❌ | Booléen rapide pour les crons (ne pas envoyer de relance un jour férié) |
| WorldTime / timezone.io | ❌ | Heure locale + DST pour l'affichage multi-pays |

### 🖼️ Assets & UI (gain de temps énorme)
| API | Clé | Note |
|-----|-----|------|
| DiceBear Avatars | ❌ | Avatars par défaut déterministes (`/9.x/initials/svg?seed=email`) — zéro stockage |
| Iconify | ❌ | 200+ sets d'icônes SVG en une requête |
| Icon Horse / Favicondl | ❌ | Favicon d'un domaine (logos clients sans upload) |
| QR & Barcode (solsigs) / Image-Charts | ❌ | QR codes de factures, graphiques en image pour emails |
| DummyImage / PlaceDog / PlaceBear | ❌ | Placeholders pour les états vides et les maquettes |

### 📧 Emails transactionnels
| API | Clé | Note |
|-----|-----|------|
| Disify / EVA / Email Validator (LifeStep) | ❌ | Validation syntaxe + MX + détection jetable, **avant** l'envoi → protège ta réputation |
| Guerrilla Mail / mail.gw / DropMail | ❌ | Boîtes jetables pour **tester** tes séquences d'inscription en CI |

> ❗ Aucune API gratuite de `public-apis` n'envoie de vrais emails en volume : pour la prod, utilise un provider dédié (Resend, Brevo, Postmark). `public-apis` ne sert ici qu'à **valider** les adresses.

### 📄 Documents / contenu
| API | Clé | Note |
|-----|-----|------|
| Open Library / Gutendex | ❌ | Métadonnées livres + couvertures (si tu fais du contenu/éducation) |
| Crossref | ❌ | Métadonnées d'articles (citations, DOIs) |
| OCR.Space | 🔑 | OCR d'images/PDF — free tier, pratique pour scanner des reçus |
| LibreTranslate | ❌/🔑 | Traduction FR ⇄ EN (instances publiques limitées, self-host possible) |
| Free Dictionary | ❌ | Définitions + phonétique (jeux de mots, SEO) |
| Quotable / JokeAPI / Advice Slip | ❌ | Contenu pour onboarding, emails « tip of the day », widgets |

### 🧪 Développement & tests
| API | Clé | Note |
|-----|-----|------|
| DummyJSON | ❌ | CRUD fake complet (produits, users, posts, todos) |
| JSONPlaceholder | ❌ | Le classique pour prototyper |
| flaky (flakyapi.dev) | ❌ | **Force des codes HTTP / latence** → teste tes états d'erreur et tes loaders |
| UUID Generator (uuidtools) | ❌ | UUID sans dépendance |
| DiceBear | ❌ | Seed de données de test déterministes |
| http.cat / http.dog | ❌ | Images d'erreur 404/500 sympas pour la page d'erreur |

---

## 3. Ce que je recommande concrètement pour SAAS

**Scénario « SaaS B2B avec abonnement facturé en FCFA »** — la stack minimale, 0 clé, 0 coût :

1. **Frankfurter** → prix affichés en EUR/USD convertis en XOF, avec cache serveur du taux du jour.
2. **REST Countries** → sélecteur pays/devise/langue au signup + normalisation des numéros.
3. **Nager.Date** → éviter les relances d'impayés et les notifications les jours fériés au Niger.
4. **DiceBear + Iconify** → avatars et icônes sans budget design.
5. **Disify** → blocage des emails jetables à l'inscription.
6. **DummyJSON + flaky** → données et états d'erreur pour la démo client.

**Architecture importante :** ces APIs sont publiques et sans clé, donc **rate-limitées par IP**. Fais tous les appels côté serveur (Next.js route handlers / Express) avec un **cache** (revalidation 1 h pour les taux, 24 h pour les fériés), et expose-les à ton front via **tes propres routes**. Ça évite :
- de cramer le quota partagé de l'IP du sandbox/proxy,
- de dépendre du CORS du fournisseur,
- de voir tes clés (le jour où tu en ajoutes) dans le bundle JS.

**Ce qu'il faut éviter de la liste :**
- Tout ce qui est **`apiKey` + pas de free tier réel** (la majorité des lignes « APILayer Suite », Fixer, ipapi.com…).
- Les APIs **HTTP-only** en 2026 (ip-api gratuit, 7Timer, loripsum) : bloquées sur un site HTTPS.
- Les APIs de **hobby** sans SLA (cat facts, waifu…) : sympa en démo, jamais dans un flux critique.
- Les agrégateurs RSS/news gratuits : instables, et souvent des données sous copyright.

---

## 4. Tableau de décision rapide

| Ton besoin | Prends ça | Évite |
|-----------|-----------|-------|
| Conversion de devise | **Frankfurter** | Fixer (100 req/mois), Coinlayer |
| Météo | **Open-Meteo** | Weatherstack (100 req/mois) |
| Jours fériés | **Nager.Date**, puis caldays | Calendarific (clé) |
| Pays / devises / langues | **REST Countries** | — |
| Adresse → GPS | **Open-Meteo Geocoding** (autocomplete), **Nominatim** (précis, serveur) | Geocode.xyz (quotas opaques) |
| Avatars / icônes | **DiceBear**, **Iconify** | Icons8 (clé) |
| Validation email | **Disify** | Kickbox (clé + payant) |
| Fake data / démo | **DummyJSON**, flaky | FakerAPI (plus lent) |
| QR code facture | **solsigs QR & Barcode** ou Image-Charts | OpenQR (clé) |
| Envoi d'emails réel | *hors public-apis* : Resend / Brevo | — |

---

## 5. Prochaine étape

Dis-moi **ce que fait SAAS** (facturation ? gestion de clients ? e-commerce ? outil interne ?) et je code directement le module d'intégration : route serveur + cache + typage TypeScript + tests, pour les 3 APIs les plus utiles à ton cas.
