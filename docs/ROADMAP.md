# La suite du projet — feuille de route

> État au dernier commit : **étapes 1 (ventes), 2 (rapports) et 4 (équipe) terminées** — la
> caisse fonctionne (panier, ticket, encaissement, annulation, sortie de stock automatique),
> les rapports répondent (CA, marge, top produits, produits dormants, export CSV) et l'équipe
> se gère dans l'application (invitation par e-mail, rôles, retrait), en plus du socle
> technique (authentification, entreprises, catalogue, stock, mouvements, sécurité).
> Ce document décrit **ce qui reste**, dans l'ordre, avec le pourquoi de chaque étape.

---

## Où en est le produit, en une image

Stokari sait aujourd'hui **ranger, compter, vendre, mesurer et travailler à plusieurs** :
produits, catégories, emplacements, stock, mouvements, caisse (ticket numéroté, stock qui
baisse tout seul, annulation tracée), rapports (CA, marge, top produits, dormants, CSV) et
gestion de l'équipe par rôles. C'est testé (132 tests) et isolé par entreprise.

Ce qui manque maintenant, c'est **la vente hors du magasin** (la boutique publique), puis
l'abonnement.

```
   [FAIT] Catalogue + Stock + Mouvements + Sécurité + VENTES + RAPPORTS + ÉQUIPE
              │
              ▼
   [3] BOUTIQUE PUBLIQUE ──► [5] ABONNEMENT
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

## Étape 2 — Les rapports — ✅ TERMINÉE

**Pourquoi :** savoir ce qui se vend, ce qui rapporte, ce qui dort. C'est ce qui fait revenir
le commerçant chaque semaine.

**Ce qui est livré** (`/workspace/rapports`)

- **Aujourd'hui** en tête : encaissé, nombre de ventes, marge du jour.
- **Période 7 / 30 / 90 jours** : CA, marge, nombre de ventes, panier moyen.
- **Graphique jour par jour** (jours sans vente inclus, donc pas de faux trou).
- **Top 10 produits** : quantité, CA, marge — et **top 5 catégories** avec part du CA.
- **Produits dormants** : du stock, aucune vente depuis 30 jours (ou jamais vendu) — c'est de
  l'argent qui dort, avec sa valeur.
- **Capital immobilisé** : somme de (quantité × prix d'achat) sur tout le stock.
- **Export CSV** (séparateur `;`, compatible Excel/LibreOffice en français).

**Technique**

- Une fonction SQL `report_summary(tenant, du, au)` `security definer` : un seul appel, une
  seule vérification de droit (`reports.read`), des montants arrondis côté base.
- Les dates sont calculées dans le **fuseau de l'entreprise** (`Africa/Niamey` par défaut) :
  une vente à 23 h 30 heure locale compte bien le bon jour.
- Les **ventes annulées sont exclues partout** (CA, marge, top produits), mais le stock
  remis ne fausse pas le capital immobilisé.
- Garde-fous : période inversée refusée, période > 400 jours refusée, non-membre refusé
  (`42501`).
- Route identique en mode direct (`rpc report_summary`) et via l'API NestJS
  (`GET /tenants/:id/reports?from=&to=`).

**Critère de réussite (vérifié en base) :** vendre 2 articles + 1 article, annuler une 3ᵉ
vente → le rapport compte **2 ventes**, et le CA/marge ajoutés correspondent **au centime**
à la somme des tickets non annulés ; série de 8 jours pour une période de 7 jours ;
top produit = 3 unités ; 10 dormants détectés.

**Reste à faire sur cette étape (plus tard)**

- Comparaison entre deux périodes (mois précédent).
- Rapport « ventes par vendeur » et « ventes par moyen de paiement ».
- Envoi du rapport par e-mail / WhatsApp (le CSV est prêt pour ça).

---

## Étape 3 — La boutique publique — ✅ TERMINÉE

**Pourquoi :** au Niger et en Afrique de l'Ouest, on vend sur WhatsApp. Un lien de catalogue
partageable transforme Stokari en vitrine, sans application à installer côté client.

**Ce qui est livré (le lien à partager)**

- Un lien public : `/b/<adresse>` — catalogue avec prix et disponibilité, **sans compte**,
  sans coût d'achat et sans accès aux autres entreprises.
- Un panier côté client, puis un formulaire **nom + téléphone WhatsApp + précision**.
- La commande arrive **dans l'application**, onglet **Boutique** (`/workspace/commandes`),
  avec un numéro `CMD-000123`.
- **Confirmer** la commande crée la vente (stock retiré, ticket numéroté `VTE-…` dans l'onglet
  Ventes) ; **Annuler** demande un motif ; **Marquer livrée** clôt la commande.
- Écran de réglages : adresse de la boutique, nom affiché, numéro WhatsApp, emplacement de
  sortie du stock, ouverture/fermeture au public. Boutons **copier le lien** et **envoyer sur
  WhatsApp** (message prérempli).

**Garde-fous côté base (vérifiés en SQL)**

- le prix d'une commande est **toujours recalculé** par la base : un prix envoyé par le client
  est ignoré ; le panier est refusé si le stock a baissé entre-temps ;
- l'envoi porte une **clé d'idempotence** : un réseau qui coupe et un client qui renvoie ne
  créent pas de doublon ; renvoyer une clé avec d'autres informations est refusé ;
- une boutique fermée renvoie « introuvable » (informations vides, catalogue vide, commande
  refusée) ;
- le rôle `anon` n'a **aucun** droit direct sur les trois tables (`storefront_settings`,
  `storefront_orders`, `storefront_order_items`) : tout passe par des fonctions
  `security definer` ; un tiers authentifié est refusé (42501) ;
- anti-abus : 50 lignes maximum par commande et 500 commandes en attente maximum par boutique ;
- 100 commandes les plus récentes affichées côté commerçant.

**Reste à faire sur cette étape (plus tard)**

- **Photos produits** (Supabase Storage) : le catalogue est aujourd'hui textuel.
- Notifications (SMS ou WhatsApp) envoyées au commerçant à l'arrivée d'une commande.
- Page de suivi pour le client (« où en est ma commande ? ») à partir du numéro de commande.

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
| 2 | **Rapports** ✅ | ⭐⭐⭐ | donne la raison de revenir chaque semaine |
| 3 | **Boutique publique** ✅ | ⭐⭐⭐ | différencie sur le marché local |
| 4 | **Équipe** ✅ | ⭐⭐ | débloque les boutiques à plusieurs vendeurs |
| 5 | **Abonnement** | ⭐⭐ | transforme l'usage en revenus |

**Recommandation :** les étapes 1, 2, 3 et 4 sont faites — la prochaine chantier utile est
l'**étape 5 (abonnement)**, une fois quelques boutiques utilisatrices.

---

## Dette technique à traiter en parallèle

| Sujet | Pourquoi | Quand |
| --- | --- | --- |
| API dans une image Docker + hébergeur Node | l'API n'est pas déployée aujourd'hui (mode direct) | avant la production payante |
| Tests de bout en bout (Playwright déjà configuré) | vérifier les parcours réels à chaque déploiement | étape 5 |
| Photos produits (Supabase Storage) | la boutique publique est aujourd'hui textuelle | juste après l'étape 3 |
| Sauvegardes et plan de reprise | un commerce ne perd pas son stock | avant la mise en production payante |
| Journal d'audit exploitable | qui a fait quoi, quand | étape 5 |
| Test de bout en bout (Playwright) dans la CI | le métier est couvert par les tests unitaires, mais le parcours complet échoue encore en CI ; à rejouer avec Docker/Supabase local | avant la mise en production |

---

## Découpage de l'étape 3 (la boutique publique) — fait

1. ✅ `storefront_settings` (adresse publique, nom affiché, WhatsApp, emplacement, ouverture).
2. ✅ `storefront_orders` / `storefront_order_items` + `place_storefront_order` (aucune donnée
   de coût exposée, prix recalculé, clé d'idempotence).
3. ✅ Route publique `/b/:slug` : catalogue, recherche, panier, envoi de commande.
4. ✅ Écran commerçant « Boutique » : réglages, lien à partager, confirmer / annuler / livrée.
5. ✅ Tests : 169 tests (dont 8 sur le contrat de la boutique et le mode direct) + vérification
   SQL de bout en bout (commande → confirmation → vente → stock, fermeture, tiers refusé).
