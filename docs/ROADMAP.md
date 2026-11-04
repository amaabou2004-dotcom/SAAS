# La suite du projet — feuille de route

> État au dernier commit : **étapes 1 (ventes) et 4 (équipe) terminées** — la caisse
> fonctionne (panier, ticket, encaissement, annulation, sortie de stock automatique) et
> l'équipe se gère dans l'application (invitation par e-mail, rôles, retrait), en plus du
> socle technique (authentification, entreprises, catalogue, stock, mouvements, sécurité).
> Ce document décrit **ce qui reste**, dans l'ordre, avec le pourquoi de chaque étape.

---

## Où en est le produit, en une image

Stokari sait aujourd'hui **ranger, compter, vendre et travailler à plusieurs** : produits,
catégories, emplacements, stock, mouvements, caisse (ticket numéroté, stock qui baisse tout
seul, annulation tracée) et gestion de l'équipe par rôles. C'est testé (116 tests) et isolé
par entreprise.

Ce qui manque maintenant, c'est **ce que la vente produit comme information** (les rapports),
puis **la vente hors du magasin** (la boutique publique), et l'abonnement.

```
   [FAIT] Catalogue + Stock + Mouvements + Sécurité + VENTES + ÉQUIPE
              │
              ▼
   [2] RAPPORTS ──► [3] BOUTIQUE PUBLIQUE ──► [5] ABONNEMENT
```

---

## Étape 1 — Les ventes (le cœur du métier) — ✅ TERMINÉE

**Pourquoi d'abord :** sans vente, l'application reste un inventaire. C'est aussi la brique
dont dépendent les rapports (chiffre d'affaires) et la boutique publique.

**Ce qui est livré**

- Onglet **Ventes** (`/workspace/ventes`) : ventes du jour, total encaissé, marge du jour,
  liste complète avec le détail de chaque ticket.
- Écran **Nouvelle vente** (`/workspace/ventes/nouvelle`) : recherche par nom ou SKU,
  panier, quantité, prix modifiable, disponibilité affichée par emplacement.
- Paiement **espèces**, **Mobile Money** (référence obligatoire) ou **crédit**.
- **Ticket** numéroté (`VTE-000001`) affiché après encaissement, imprimable
  (feuille d'impression dédiée : seul le ticket sort).
- **Stock retiré automatiquement** dans la même transaction que la vente.
- **Annulation** depuis la liste, avec motif obligatoire : le stock revient,
  la vente reste visible avec le statut « Annulée ».
- Envoi protégé par **clé d'idempotence** : un double clic ne crée pas deux ventes.
- Mêmes règles en **mode direct** (RPC `post_sale` / `void_sale`) et via l'**API NestJS**
  (`POST/GET /tenants/:id/sales`, `POST /tenants/:id/sales/:id/void`).

**Décisions techniques à connaître**

- Une vente écrit sa sortie de stock **elle-même** (et non via `post_stock_operation`) :
  un vendeur possède `sales.manage` mais pas `inventory.manage`, et doit pouvoir encaisser.
- L'annulation, elle, passe par une **contre-passation** et exige donc `sales.manage`
  **et** `inventory.manage` : annuler, c'est toucher au stock.
- Les tables `sales` / `sale_items` sont en **lecture seule** pour le client : les écritures
  passent uniquement par les fonctions `security definer`.

**Critère de réussite (vérifié en base) :** vendre 3 articles → stock −3, ticket numéroté,
rejeu de la même clé → une seule vente, stock insuffisant → refus explicite, annulation →
stock restauré, double annulation → refus.

**Reste à faire sur cette étape (plus tard)**

- Douchette code-barres (le champ `barcode` existe déjà) et raccourcis clavier.
- Remise globale ou par ligne (aujourd'hui : prix unitaire modifiable).
- Table `payments` dédiée si l'on encaisse un ticket en plusieurs fois (utile pour le crédit).

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

## Étape 4 — L'équipe — ✅ TERMINÉE

**Pourquoi :** dans une boutique, il y a le patron et le vendeur. Les rôles existaient déjà en
base ; il manquait l'écran pour ajouter des personnes.

**Ce qui est livré** (`/workspace/equipe`)

- Liste des **membres** : nom, e-mail, rôle, date d'arrivée, mention « vous ».
- **Changer le rôle** d'un membre dans une liste déroulante (les 5 rôles sont expliqués à
  droite de l'écran, avec leurs permissions).
- **Retirer** un membre, avec une confirmation en deux temps (pas de suppression accidentelle).
- **Inviter** par e-mail avec un rôle : si la personne a déjà un compte, elle rejoint
  l'entreprise immédiatement ; sinon l'invitation attend son inscription.
- **Invitations en attente** : liste, date d'expiration (14 jours) et annulation.
- **Acceptation automatique** : à la connexion, les invitations envoyées à votre adresse
  deviennent des adhésions réelles — l'entreprise apparaît alors dans votre espace.
- Lecture seule pour qui n'a pas `members.manage` : on voit l'équipe, on ne la modifie pas.

**Garde-fous côté base (vérifiés en SQL)**

- il doit toujours rester **au moins un propriétaire** (changer son rôle ou le retirer échoue) ;
- seul un propriétaire peut inviter / changer / retirer (`members.manage`) ;
- les invitations expirent au bout de 14 jours ; une invitation révoquée ne revient pas ;
- le client ne peut pas écrire directement dans `tenant_invitations` (fonctions
  `security definer` uniquement) ;
- un vendeur qui tente d'inviter reçoit un refus explicite.

**Reste à faire sur cette étape (plus tard)**

- Envoi réel de l'e-mail d'invitation (aujourd'hui : aucun e-mail automatique, l'invitation
  s'active à la connexion) — nécessite un SMTP personnalisé.
- Invitation par lien partageable (le jeton `token` existe déjà dans la table).
- Journal d'audit des changements d'équipe.

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
| 1 | **Ventes** ✅ | ⭐⭐⭐⭐ | transforme l'outil en caisse : indispensable |
| 2 | **Rapports** | ⭐⭐⭐ | donne la raison de revenir chaque semaine |
| 3 | **Boutique publique** | ⭐⭐⭐ | différencie sur le marché local |
| 4 | **Équipe** ✅ | ⭐⭐ | débloque les boutiques à plusieurs vendeurs |
| 5 | **Abonnement** | ⭐⭐ | transforme l'usage en revenus |

**Recommandation :** l'étape 1 est faite — enchaîner sur **2 (rapports)**. À ce moment-là, le
produit est utilisable tous les jours par un vrai commerce et peut être montré à un client.

---

## Dette technique à traiter en parallèle

| Sujet | Pourquoi | Quand |
| --- | --- | --- |
| API dans une image Docker + hébergeur Node | l'API n'est pas déployée aujourd'hui (mode direct) | avec l'étape 3 |
| Tests de bout en bout (Playwright déjà configuré) | vérifier les parcours réels à chaque déploiement | étape 2 |
| Photos produits (Supabase Storage) | indispensable pour la boutique publique | étape 3 |
| Sauvegardes et plan de reprise | un commerce ne perd pas son stock | avant la mise en production payante |
| Journal d'audit exploitable | qui a fait quoi, quand | étape 2 |

---

## Découpage de l'étape 2 (les rapports)

1. Vues SQL `sales_daily` (CA, marge, panier moyen par jour) et `product_performance`
   (quantités, CA, marge par produit / catégorie), avec tests SQL.
2. Contrat front (`reports-api.ts`) + mode direct + route API, tests unitaires.
3. Écran **Rapports** : aujourd'hui, 7 / 30 / 90 jours, top produits, produits dormants.
4. Export CSV (ventes de la période, produits).
5. Tests : les chiffres de l'écran doivent égaler la somme exacte des tickets.
