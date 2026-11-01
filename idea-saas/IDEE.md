# Boutiki — la boutique qui répond toute seule sur WhatsApp

> **Une idée de SaaS B2B, pensée pour le Niger / l'Afrique de l'Ouest.**
> Pitch en une phrase : *Boutiki transforme le WhatsApp d'une vendeuse en boutique
> automatique — catalogue, commandes, paiement mobile money et relances, sans
> qu'elle installe quoi que ce soit.*

---

## 1. Le problème (réel, observable à Niamey)

Des milliers de vendeuses et vendeurs font 100 % de leur business sur WhatsApp :
vêtements, cosmétiques, bijoux, pagnes, gâteaux, téléphones, produits
d'importation. Le quotidien :

- elle répond **50 fois par jour** aux mêmes questions (« c'est combien ? », « tu as
  la taille M ? », « tu livres à Yantala ? ») ;
- les commandes se perdent dans la conversation — **aucun suivi**, pas de liste de
  livraison, pas de relance ;
- le stock est **dans sa tête** ; elle vend un article déjà épuisé ;
- elle ne sait pas combien elle a **vraiment gagné** ce mois-ci ;
- elle perd les clientes qui écrivent à 23 h, quand elle dort.

Les outils existants (Shopify, WooCommerce, catalogues PDF) échouent : trop chers,
en anglais, pensés pour du web, et **le client final ne veut pas installer une
app ni cliquer 6 écrans** — il veut juste écrire sur WhatsApp.

## 2. La cible

**Wedge (à attaquer en premier, un seul vertical) :** vendeuses de mode / beauté /
bijoux à Niamey et Ouagadougou, 20–200 commandes par mois, 1 à 3 personnes.

Ensuite : pâtisseries, électronique, quincaillerie, pharmacies de quartier,
revendeurs de pièces auto — même douleur, même produit.

## 3. Le produit — MVP en 3 briques

**A. Le catalogue qui répond seul (le hook)**
La vendeuse envoie ses produits une fois (photo + prix + tailles + stock) dans un
formulaire simple ou directement par WhatsApp. Ensuite, quand une cliente écrit
« catalogue », « combien le sac rouge ? », « tu as du 40 ? » → le bot répond avec
photos, prix, disponibilité, en français (et plus tard en haoussa / zarma /
peul), 24 h/24.

**B. La commande capturée, pas perdue**
Le bot collecte : article, taille, quantité, quartier, créneau de livraison →
crée une **commande** + un **lien de paiement mobile money** (ou « paiement à la
livraison ») → envoie une confirmation numérotée à la cliente.

**C. Le tableau de bord vendeur (sur son téléphone)**
- commandes du jour + **liste de livraison optimisée** (quartier par quartier) ;
- stock décrémenté automatiquement → alerte « il ne reste que 2 » ;
- **relances automatiques** : panier non payé à H+2, « votre commande est
  arrivée ? », code promo à J-21 pour faire revenir la cliente ;
- CA du mois, meilleurs produits, taux de conversion (conversations → commandes) ;
- export / reçu WhatsApp au format image pour la comptabilité.

**Ce qui fait la différence :** zéro app à installer côté cliente, 20 minutes pour
mettre une vendeuse en route, et toutes les données de vente centralisées.

## 4. Modèle économique

Prix en FCFA, facturés au mois (ou 10 mois payés = 12, grosse remise pour la
trésorerie) :

| Offre | Prix | Contenu |
|---|---|---|
| **Starter** | 5 000 FCFA/mois | 1 numéro, catalogue, 150 commandes/mois |
| **Pro** | 12 000 FCFA/mois | 3 numéros, paiement mobile money, relances auto, stock |
| **Business** | 25 000 FCFA/mois | multi-boutiques, livreurs, promos ciblées, API |

- ARPU cible : **8 000 FCFA/mois** ≈ **12 €**.
- 1 000 clientes payantes = **8 M FCFA/mois** (~12 200 €) de MRR.
- Option plus tard : **1 % sur les paiements encaissés** (le vrai levier fintech).
- Coût variable principal : conversations WhatsApp Business API + hébergement,
  estimé 8–15 % du CA → marge brute ~85 %.

## 5. Pourquoi ça peut gagner (le fossé)

1. **Données de vente** : au bout de 6 mois, Boutiki connaît le CA réel de chaque
   boutique → **scoring de crédit** pour financer son stock (BNPL) ou vendre une
   assurance. C'est là qu'est la valorisation, pas dans l'abonnement.
2. **Effet réseau livreurs / agents** : les livreurs et les agents mobile money
   deviennent des points de vente et d'onboarding.
3. **Coût de sortie** : le catalogue, l'historique clients et le stock vivent dans
   Boutiki. Repartir sur WhatsApp nu = repartir de zéro.
4. **Local-first** : langues locales, quartiers, prix en FCFA, support par
   WhatsApp vocal — un concurrent global ne le fera pas.

## 6. Go-to-market — 30 premiers jours, sans budget

- **Semaine 1 :** 20 boutiques rencontrées en direct (Petit Marché, Wadata,
  groupes Facebook « vente en ligne Niamey »). Onboarding **fait à la main**, sur
  le téléphone de la vendeuse, en 20 min. Objectif : 10 boutiques actives.
- **Semaine 2 :** n'accepter aucun paiement, mesurer une seule chose :
  **conversations → commandes générées**. Si le bot ne vend pas, le reste est inutile.
- **Semaine 3 :** activer le paiement mobile money + relances, puis facturer
  5 000 FCFA/mois aux 10 premières (prix fondateur à vie).
- **Semaine 4 :** 2 partenariats : un réseau de **livreurs** (ils voient passer
  toutes les boutiques) et une **agence mobile money** (elle gagne du volume).
- **Preuve à 90 jours :** 50 boutiques payantes, 2 500 commandes/mois traitées,
  churn < 5 %.

## 7. Risques et parades

| Risque | Parade |
|---|---|
| Coût / règles de l'API WhatsApp (Meta) | Passer par un BSP, modèles de messages validés, fallback SMS + lien web ; garder le coût < 12 % du prix |
| Les clientes paient en cash, pas en mobile money | Mode « paiement à la livraison » par défaut, mobile money en option — jamais l'inverse |
| Churn (la vendeuse abandonne après 3 semaines) | Onboarding humain, 1 seule métrique affichée (« vos commandes du jour »), relance téléphonique si 5 jours sans activité |
| Copie par un concurrent | Verrouiller le vertical mode/beauté + données de vente + réseau livreurs ; aller vite sur le crédit de stock |
| Écosystème WhatsApp dépendant d'un tiers | Prévoir dès le départ une page boutique web (`boutiki.shop/nom`) alimentée par les mêmes données |

## 8. Ce qu'on construit en premier (2 semaines de code)

1. Formulaire d'ajout produit + import d'un catalogue WhatsApp existant.
2. Webhook WhatsApp (Cloud API) + réponses catalogue/prix/stock (LLM en secours
   pour les questions libres).
3. Modèle de données : `boutique`, `produit`, `commande`, `cliente`, `message`.
4. Écran « commandes du jour » + décrément du stock (mobile-first, léger, il doit
   marcher en 3G).
5. Lien de paiement mobile money (agrégateur local) et reçu WhatsApp.

---

## Trois autres idées, si celle-ci ne te parle pas

- **Tontine OS** — cotisations et remboursements de tontines/coopératives
  collectés par mobile money, avec ledger et historique de confiance.
- **École+** — frais scolaires des écoles privées (échéanciers + mobile money) et
  communication parents par SMS/WhatsApp.
- **Float** — gestion de la liquidité des agents mobile money : prévision des
  ruptures de cash, réapprovisionnement entre agents.

> Mon choix : **Boutiki**, parce que la douleur est quotidienne, le client est
> joignable sans pub, et la donnée de vente ouvre une porte fintech.
