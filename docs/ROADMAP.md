# La suite du projet — feuille de route

> État au dernier commit : socle technique terminé (authentification, entreprises, catalogue,
> stock, mouvements, historique, sécurité). Ce document décrit **ce qui reste**, dans l'ordre,
> avec le pourquoi de chaque étape.

---

## Où en est le produit, en une image

Stokari sait aujourd'hui **ranger et compter** : produits, catégories, emplacements, stock,
mouvements. C'est la fondation — solide, testée (73 tests), isolée par entreprise.

Ce qui manque, c'est **ce qui se passe au comptoir** : la vente. Et ce qui en découle :
les rapports, la boutique en ligne, l'équipe, l'abonnement.

```
   [FAIT] Catalogue + Stock + Mouvements + Sécurité
              │
              ▼
   [1] VENTES  ──►  [2] RAPPORTS ──►  [3] ABONNEMENT
        │
        └──►  [4] BOUTIQUE PUBLIQUE ──►  [5] ÉQUIPE
```

---

## Étape 1 — Les ventes (le cœur du métier)

**Pourquoi d'abord :** sans vente, l'application reste un inventaire. C'est aussi la brique
dont dépendent les rapports (chiffre d'affaires) et la boutique publique.

**Ce que l'utilisateur voit**
- Un nouvel onglet **Ventes** : liste des ventes du jour, total encaissé.
- Un écran **Nouvelle vente** : recherche produit (nom, SKU, code-barres), quantités,
  remise éventuelle, puis un bouton **Encaisser**.
- Modes de paiement : **espèces**, **Mobile Money** (saisie de la référence), **crédit** (à recevoir).
- À l'encaissement : un **ticket** numéroté (`VTE-000123`), imprimable ou copiable.
- Le **stock baisse automatiquement** — sans double saisie.

**Ce que je construis**
- Tables `sales`, `sale_items`, `payments` (migration versionnée).
- Une fonction `post_sale(...)` transactionnelle et idempotente, qui crée la vente **et** les
  sorties de stock dans la même transaction (réutilise `post_stock_operation`).
- Refus si le stock disponible est insuffisant, avec un message clair.
- Annulation d'une vente = contre-passation (le stock revient).
- Routes API `POST /sales`, `GET /sales`, `POST /sales/:id/void` + le mode direct.

**Critère de réussite :** vendre 3 articles, voir le stock diminuer de 3, annuler la vente,
voir le stock revenir — et que tout figure dans l'historique.

---

## Étape 2 — Les rapports

**Pourquoi :** savoir ce qui se vend, ce qui rapporte, ce qui dort. C'est ce qui fait revenir
le commerçant chaque semaine.

**Ce que l'utilisateur voit**
- **Aujourd'hui** : CA du jour, nombre de ventes, panier moyen, marge.
- **Période** (7 / 30 / 90 jours) : courbe du CA, top 10 produits, top catégories.
- **Marge** par produit (prix de vente − coût) et marge totale.
- **Rotation** : produits dormants (aucune vente récente), capital immobilisé.

**Technique :** vues SQL (`sales_daily`, `product_performance`) + export CSV.

**Critère de réussite :** après 10 ventes, les chiffres du tableau de bord correspondent
exactement à la somme des tickets.

---

## Étape 3 — La boutique publique (le différenciateur)

**Pourquoi :** au Niger et en Afrique de l'Ouest, on vend sur WhatsApp. Un lien de catalogue
partageable transforme Stokari en vitrine, sans application à installer côté client.

**Ce que l'utilisateur voit**
- Un lien public : `stokari.vercel.app/b/<slug>` — catalogue avec photos, prix, disponibilité.
- Un panier simple côté client → la commande arrive **dans l'application**, à confirmer.
- Le stock est réservé à la confirmation, la vente suit le circuit normal.

**Technique :** route publique en lecture seule (pas d'authentification, pas d'exposition
des coûts ni des autres entreprises) + table `storefront_orders`. Photos via Supabase Storage.

**Critère de réussite :** partager un lien, passer une commande depuis un téléphone,
la voir apparaître côté commerçant.

---

## Étape 4 — L'équipe

**Pourquoi :** dans une boutique, il y a le patron et le vendeur. Les rôles existent déjà en
base (5 rôles, permissions vérifiées) ; il manque l'écran pour ajouter des personnes.

**Ce que l'utilisateur voit :** inviter un vendeur par e-mail, changer son rôle, le retirer,
avec les garde-fous (impossible de retirer le dernier propriétaire).

**Technique :** table `tenant_invitations` + RPC `invite_member`, `accept_invitation`,
`update_member_role`, `remove_member` — le travail déjà spécifié, à porter sur ce schéma.

**Critère de réussite :** inviter une 2ᵉ personne avec le rôle Vendeur ; elle ne voit ni les
coûts, ni les autres entreprises, et ne peut pas modifier le catalogue.

---

## Étape 5 — L'abonnement (le modèle économique)

**Pourquoi :** un SaaS doit encaisser. À faire une fois que la valeur est démontrée.

**Ce que l'utilisateur voit :** un plan **Gratuit** (1 utilisateur, 50 produits, 100 ventes/mois)
et un plan **Pro** (utilisateurs illimités, boutique publique, rapports avancés), payé par
**Mobile Money** ou carte.

**Technique :** table `subscriptions` + limites appliquées côté base (pas seulement dans l'UI),
webhook de paiement, écran de facturation.

---

## Ordre de travail proposé

| # | Étape | Effort | Valeur |
| --- | --- | --- | --- |
| 1 | **Ventes** | ⭐⭐⭐⭐ | transforme l'outil en caisse : indispensable |
| 2 | **Rapports** | ⭐⭐⭐ | donne la raison de revenir chaque semaine |
| 3 | **Boutique publique** | ⭐⭐⭐ | différencie sur le marché local |
| 4 | **Équipe** | ⭐⭐ | débloque les boutiques à plusieurs vendeurs |
| 5 | **Abonnement** | ⭐⭐ | transforme l'usage en revenus |

**Recommandation :** enchaîner **1 → 2** (ventes puis rapports). À ce moment-là, le produit
est utilisable tous les jours par un vrai commerce, et vous pouvez le montrer à un client.

---

## Dette technique à traiter en parallèle

| Sujet | Pourquoi | Quand |
| --- | --- | --- |
| API dans une image Docker + hébergeur Node | l'API n'est pas déployée aujourd'hui (mode direct) | avec l'étape 3 |
| Tests de bout en bout (Playwright déjà configuré) | vérifier les parcours réels à chaque déploiement | étape 1 |
| Photos produits (Supabase Storage) | indispensable pour la boutique publique | étape 3 |
| Sauvegardes et plan de reprise | un commerce ne perd pas son stock | avant la mise en production payante |
| Journal d'audit exploitable | qui a fait quoi, quand | étape 4 |

---

## Découpage de l'étape 1 (si on démarre)

1. Migration `sales` + `post_sale` + vues de lecture, appliquée et testée en SQL.
2. Contrat côté front (`sales-api.ts`) + tests unitaires.
3. Écran **Ventes** (liste) et **Nouvelle vente** (panier).
4. Ticket, impression, annulation.
5. Tests : 6 à 8 nouveaux cas, dont le refus de vendre sans stock.
