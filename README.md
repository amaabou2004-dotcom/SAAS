# Sahel Desk

Outil de facturation SaaS pour l'Afrique de l'Ouest : montants consolidés en **FCFA**, taux
**BCEAO** réels, échéances qui sautent les week-ends et les jours fériés du Niger.

Next.js 16 (App Router) · React 19 · TypeScript · zéro dépendance UI · **aucune clé API**.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests unitaires du cœur métier
npm run typecheck  # tsc --noEmit
npm run build
```

## Ce qui est branché

| API (`public-apis`) | Usage dans l'app | Où |
|---|---|---|
| [Frankfurter](https://frankfurter.dev) | Taux de change, y compris XOF/XAF via la BCEAO + série 30 jours | `lib/integrations/frankfurter.ts` |
| [Nager.Date](https://date.nager.at) | Jours fériés (Niger couvert) → report des échéances au jour ouvré | `lib/integrations/nager.ts` |
| [REST Countries](https://restcountries.com) | Sélecteur pays/devise/langue à la création de facture | `lib/integrations/countries.ts` |
| [Open-Meteo](https://open-meteo.com) | Météo du siège (Niamey par défaut) | `lib/integrations/weather.ts` |

Le détail du choix d'APIs et les alternatives écartées : [`docs/API-INTEGRATION.md`](docs/API-INTEGRATION.md).

## Pages

- `/` — tableau de bord : encaissé / en attente / en retard, courbe EUR→XOF, prochains fériés, météo.
- `/invoices` — liste des factures consolidées en FCFA.
- `/invoices/new` — formulaire avec aperçu du calcul HT / TVA / TTC et de l'échéance ajustée.
- `/invoices/[id]` — détail + changement de statut (envoyée, payée, en retard).
- `/settings` — état live/fallback de chaque intégration et points d'architecture.

## API interne (route handlers)

| Route | Méthode | Rôle |
|---|---|---|
| `/api/dashboard` | GET | Agrégat de la page d'accueil (1 requête au lieu de 4) |
| `/api/rates?base=EUR&quote=XOF&days=30` | GET | Taux + série |
| `/api/holidays?country=NE&year=2026` | GET | Jours fériés |
| `/api/holidays?country=NE&issueDate=2026-11-01&dueInDays=15` | GET | Échéance ajustée au jour ouvré |
| `/api/countries` | GET | Pays normalisés |
| `/api/weather?lat=13.51&lon=2.11` | GET | Météo |
| `/api/invoices` | GET / POST | Lister / créer (validation serveur, 422 détaillé) |
| `/api/invoices` | PATCH | `{ id, status }` |

## Décisions techniques

- **Tout appel externe est côté serveur.** Les APIs retenues sont sans clé et limitées par IP :
  passer par le serveur permet de cacher (ISR Next), d'éviter le CORS et de contrôler le quota.
- **Repli systématique.** `lib/http.ts#withFallback` coupe au bout de 4 s et renvoie une donnée
  locale marquée `source: "fallback"` ; l'UI affiche `● live` ou `◐ cache local`, jamais une page
  d'erreur. Utile hors ligne, en CI, ou si un fournisseur tombe.
- **La parité EUR/XOF est fixe** (655,957) : le taux est journalier, il n'a pas à bouger dans
  l'interface, mais il reste lu depuis l'API pour les autres devises.
- **Le taux est figé à l'émission.** Modifier une facture existante ne la réévalue pas.
- **Arrondis en francs entiers** : pas de centimes en FCFA, `Math.round` à chaque étape.
- **Le stockage est en mémoire** (`lib/store.ts`) : la démo survit au hot reload, mais pas à un
  redémarrage. Prochaine étape : Supabase/Postgres (voir « Suite »).

## Suite

1. Persistance réelle (Supabase : `invoices`, `clients`, `settings` + RLS).
2. Auth et multi-tenant (un workspace = un jeu de factures).
3. Export PDF de la facture (ou QR de paiement via une API de la liste).
4. Relances automatiques qui **sautent les jours fériés** — `getDeadline` fait déjà le calcul.
5. Webhook de paiement (Wave, Orange Money, Stripe) pour passer `sent` → `paid` tout seul.
