# Reprendre le projet — la page unique

> Vous ne savez plus où vous en êtes ? Lisez cette page, elle fait le point.
> Dernière mise à jour : version `0.1.0` — itération 10 (**caisse rapide**, **crédits clients**,
> **suivi de commande**, **logo de boutique** et **application installable**), en plus de l’accueil,
> du catalogue, du stock, des rapports et de l’équipe. **Stokari est gratuit pour le moment.**

---

## 1. Le projet en une phrase

**Stokari** est une application web de **gestion commerciale pour les commerces** :
vous y gérez vos **produits**, vos **stock** (entrées, sorties, transferts), vos
**catégories**, vos **emplacements** — vous y **encaissez vos ventes** (panier, ticket,
Mobile Money, annulation), vous y **suivez vos chiffres** (CA, marge, meilleurs produits,
produits dormants, export CSV) et vous y **gérez votre équipe** (invitations, rôles) — et vous
partagez une **boutique en ligne** dont le lien s'envoie sur WhatsApp, où vos clients commandent
**sans créer de compte**. Chaque entreprise est totalement isolée des autres.

Plusieurs personnes peuvent travailler dans la même entreprise, chacune avec un rôle
(propriétaire, gestionnaire, vendeur…).

---

## 2. Ce qui marche aujourd'hui (testable tout de suite)

| Fonction | État | Où |
| --- | --- | --- |
| **Accueil** : chiffres du jour, commandes à confirmer, ruptures, actions rapides | ✅ | `/workspace/accueil` |
| Créer un compte (e-mail + mot de passe) | ✅ | `/auth/inscription` |
| Vérifier son e-mail par code à 8 chiffres | ✅ | `/auth/verification` |
| Se connecter / se déconnecter | ✅ | `/auth/connexion` |
| Mot de passe oublié et réinitialisation | ✅ | `/auth/mot-de-passe-oublie` |
| Connexion Google | ✅ (si activée) | bouton sur la connexion |
| Créer son entreprise (onboarding) | ✅ | `/onboarding` |
| Rôles et permissions à la création | ✅ | automatique |
| Catégories de produits | ✅ | `/workspace/categories` |
| Produits et variantes — **SKU généré automatiquement**, code-barres facultatif | ✅ | `/workspace/produits` |
| **Photo du produit** choisie dans la galerie ou prise avec l'appareil photo | ✅ | `/workspace/produits` |
| **Quantité de départ saisie avec le produit** (stock d'ouverture tracé) | ✅ | `/workspace/produits` |
| Emplacements de stock | ✅ | `/workspace/emplacements` |
| Niveaux de stock (physique, réservé, disponible) | ✅ | `/workspace/stock` |
| Réceptions, ajustements, transferts | ✅ | `/workspace/mouvements` |
| Historique immuable + contre-passation (annulation) | ✅ | `/workspace/mouvements` |
| **Ventes** : liste, total et marge du jour, ticket détaillé | ✅ | `/workspace/ventes` |
| **Nouvelle vente** : panier, prix modifiable, ticket imprimable | ✅ | `/workspace/ventes/nouvelle` |
| **Caisse rapide** : produits en gros boutons, encaissement tactile et reçu WhatsApp | ✅ | `/workspace/ventes/caisse` |
| Encaissement espèces / Mobile Money / crédit | ✅ | écrans de vente |
| **Crédits clients** : reste dû, règlement total ou partiel | ✅ | `/workspace/credits` |
| Annulation d'une vente avec retour du stock | ✅ | détail d'une vente |
| **Rapports** : CA, marge, graphique, top produits, dormants | ✅ | `/workspace/rapports` |
| Export CSV du rapport (compatible Excel français) | ✅ | bouton sur les rapports |
| **Équipe** : membres, rôles, invitations en attente | ✅ | `/workspace/equipe` |
| Inviter une personne par e-mail et lui donner un rôle | ✅ | `/workspace/equipe` |
| Retirer un membre (jamais le dernier propriétaire) | ✅ | `/workspace/equipe` |
| **Boutique publique** : lien `/b/adresse`, catalogue illustré, panier, commande sans compte | ✅ | `/b/<adresse>` |
| **Tous les produits actifs visibles dans la boutique**, y compris en rupture (badge « indisponible ») | ✅ | `/b/<adresse>` |
| Réglages de la boutique (adresse, nom, WhatsApp, stock, ouverture) | ✅ | `/workspace/commandes` |
| **Commandes reçues** : confirmer (crée la vente), annuler, marquer livrée | ✅ | `/workspace/commandes` |
| **Suivi client** : état de la commande à partir du numéro `CMD-…` | ✅ | `/b/<adresse>/suivi` |
| **Logo de la boutique** dans la vitrine publique | ✅ | `/workspace/commandes` |
| **Application installable (PWA)** sur l’écran d’accueil du téléphone | ✅ | carte sur `/workspace/accueil` |
| Lien copiable + envoi WhatsApp prérempli | ✅ | `/workspace/commandes` |
| **Alerte e-mail gratuite** à chaque commande (adresse + historique d'envoi) | ✅ | `/workspace/commandes` |
| Idempotence (pas de double saisie) | ✅ | toutes les opérations |
| Isolation entre entreprises (RLS PostgreSQL) | ✅ | base de données |

**En clair :** quelqu'un peut s'inscrire, créer sa boutique, saisir ses produits,
enregistrer son stock, suivre les mouvements, **vendre au comptoir** (ticket numéroté, stock
qui baisse tout seul, annulation qui remet le stock), **voir ce qui rapporte** (rapports et
export CSV), **inviter son vendeur** avec un rôle limité, et **vendre en ligne** : il partage
un lien sur WhatsApp, ses clients commandent sans compte, et la commande devient une vente en
un clic. Il peut aussi **mettre une photo sur chaque produit depuis son téléphone** : elle
apparaît dans l'application et dans le catalogue public. La caisse rapide, les règlements de
crédit, le suivi client et l’installation sur téléphone complètent ce parcours. C'est un socle
solide et testé (**240 tests** : 64 API + 176 web).

### Saisie simplifiée (4 novembre)

Ajouter un produit ne demande plus que **deux informations obligatoires** : le nom et le prix
de vente. Tout le reste a une valeur par défaut :

* **le SKU est fabriqué automatiquement** (`EAUMIN-001`, `RIZPAR-001`…) si le champ est laissé vide ;
* **le prix de revient vaut 0** s'il n'est pas renseigné ;
* **la quantité en stock** saisie à la création est enregistrée comme stock d'ouverture
  (elle apparaît dans l'historique des mouvements, donc annulable) ;
* **le produit apparaît immédiatement dans la boutique**, et la fiche affiche son état :
  « 7 en stock · visible dans la boutique ».

Dans la boutique publique, **tous les produits actifs sont désormais affichés** : un produit sans
stock n'est plus invisible, il porte la mention « rupture de stock » et ne peut pas être commandé.
Avant, un produit à zéro était simplement masqué, ce qui donnait l'impression que la boutique
refusait les produits.

---

## 3. Ce qui n'existe pas encore

| À construire | Pourquoi c'est important |
| --- | --- |
| Notifications **SMS / WhatsApp** (l'e-mail, lui, est déjà en place) | joindre un commerçant qui ne lit pas ses e-mails |

> **L'abonnement n'est pas au programme :** l'application est **gratuite pour le moment**.
> Aucun plan payant, aucune limite, aucun paiement n'est demandé — il n'y a donc rien à
> désactiver. Le jour où cela changera, les plans s'ajouteront par-dessus l'existant sans
> bloquer les boutiques qui utilisent déjà Stokari.

---

## 4. Comment le voir tourner (3 minutes)

1. Ouvrez l'aperçu du **port 5173**.
2. **Créez un compte** : e-mail + mot de passe de 8 caractères minimum, contenant au moins une minuscule, une majuscule et un chiffre.
3. Un **code à 8 chiffres** s'affiche — en développement, il est dans la réponse du
   serveur ; sinon utilisez le lien reçu.
4. Vous arrivez sur **« Créer votre entreprise »** : nom, devise (XOF par défaut), fuseau.
5. Vous êtes dans l'espace, sur l'**Accueil** : ventes et marge du jour, commandes en ligne à
   confirmer, produits épuisés, actions rapides. Commencez par **Emplacements** (un dépôt est
   déjà créé),
   puis **Catégories**, puis **Produits**. Dans **Produits**, le bouton **Choisir une photo**
   ouvre la galerie (ou l'appareil photo) : la photo s'affiche en aperçu, puis dans la liste et
   dans le catalogue public.
6. Onglet **Stock** : saisissez une quantité d'ouverture via **Mouvements** → réception.
7. Onglet **Mouvements** : chaque opération est horodatée, attribuée et annulable.
8. Onglet **Ventes** → **Caisse rapide** : touchez les produits puis **Encaissez**. Le ticket
   `VTE-…` peut être imprimé ou envoyé sur WhatsApp. L’écran **Nouvelle vente** reste disponible
   pour le panier détaillé et les prix modifiables. Pour une vente à crédit, ouvrez ensuite
   **Crédits** afin d’enregistrer un règlement total ou partiel.
9. Revenez sur **Ventes** : le ticket est dans la liste. Ouvrez **Détails** pour annuler
   (le stock revient) — l'annulation demande un motif.
10. Onglet **Rapports** : choisissez 7 / 30 / 90 jours, vérifiez que le CA du jour correspond
    à vos tickets, puis **Exportez en CSV**.
11. Onglet **Équipe** : invitez une adresse avec le rôle **Vendeur**. Si cette personne crée
    un compte avec cette adresse, l'entreprise apparaîtra chez elle dès sa connexion.
12. Onglet **Boutique** : choisissez une adresse (ex. `ma-boutique`), un nom affiché, votre
    WhatsApp et l'emplacement qui sort le stock, cochez **Boutique ouverte au public**, puis
    **Enregistrer**. Le lien `…/b/ma-boutique` apparaît : **Copier le lien** ou **Envoyer sur
    WhatsApp**.
13. Ouvrez ce lien dans un autre onglet (ou sur un téléphone) : le catalogue s'affiche
    **sans connexion**. Ajoutez des produits, remplissez nom + téléphone, **Envoyer la
    commande** → un numéro `CMD-…` s'affiche.
14. Revenez dans **Boutique** : la commande est là, « À confirmer » → **Confirmer en vente**.
    Elle passe en « Confirmée », une vente `VTE-…` est créée et le stock baisse. **Marquer
    comme livrée** clôt le cycle ; **Annuler la commande** demande un motif. Le client suit ces
    étapes sur `/b/<adresse>/suivi` avec son numéro `CMD-…`.
15. Sous les réglages, carte **« Alertes e-mail des commandes »** : saisissez l'adresse à
    prévenir et **Enregistrer l'alerte**. Sans clé installée, les alertes restent
    « En attente d'envoi » — la mise en route gratuite (5 minutes) est décrite dans
    [`docs/EMAIL-COMMANDES.md`](./EMAIL-COMMANDES.md).

---

## 5. Comment c'est construit (sans jargon)

```
apps/web      → l'application que l'on voit (React + TypeScript)
apps/api      → le serveur qui applique les règles (NestJS)
supabase      → la base de données (PostgreSQL + sécurité par entreprise)
```

Deux façons de brancher le front à la base, sans changer un écran :

- **mode `api`** (par défaut) : le navigateur appelle le serveur NestJS, qui appelle la base.
  C'est le mode de production.
- **mode `direct`** : le navigateur appelle directement la base (utile en aperçu, quand le
  serveur n'a pas d'accès réseau sortant). Les règles restent dans la base : RLS pour la
  lecture, fonctions `security definer` pour l'écriture.

---

## 6. Où regarder dans le code

| Je cherche… | Fichier |
| --- | --- |
| Les écrans et les routes | `apps/web/src/app/App.tsx` |
| La connexion / inscription | `apps/web/src/features/auth/` |
| La création d'entreprise | `apps/web/src/features/onboarding/` |
| Produits, stock, mouvements | `apps/web/src/features/workspace/` |
| Ventes, caisse rapide, ticket, crédits | `apps/web/src/features/sales/` |
| Équipe, invitations, rôles | `apps/web/src/features/team/` |
| Rapports, CSV | `apps/web/src/features/reports/` |
| Accueil du jour (tableau de bord) | `apps/web/src/features/dashboard/` |
| Boutique publique et suivi client | `apps/web/src/features/storefront/` |
| Installation PWA | `apps/web/src/components/install-app-card.tsx` + `apps/web/public/sw.js` |
| Photos produits (envoi dans le rangement) | `apps/web/src/features/workspace/product-image.ts` |
| Alertes e-mail des commandes | `apps/web/src/features/storefront/order-notifications-card.tsx` + `supabase/migrations/*notifications*.sql` |
| Les routes du serveur | `apps/api/src/*/‑controller.ts` |
| Les règles métier du serveur | `apps/api/src/*/‑service.ts` |
| Les tables et la sécurité | `supabase/migrations/*.sql` |
| **Le dernier audit complet** (sécurité, tests, reste à faire) | `docs/AUDIT.md` |
| La mise en ligne du site (Netlify) | `netlify.toml` + `docs/DEPLOIEMENT-NETLIFY.md` |

---

## 7. Comment vérifier que tout va bien

```bash
pnpm install          # installer les dépendances
pnpm test             # 240 tests (64 API + 176 web)
pnpm typecheck        # vérification TypeScript
pnpm lint             # qualité du code
pnpm dev              # lancer l'interface (5173) et l'API (3001)
```

La CI GitHub est verte sur la branche de reprise : lint, types, 240 tests, build, tests pgTAP,
concurrence du stock et parcours navigateur E2E avec Supabase local et Mailpit.

---

> **La suite détaillée du projet** (5 étapes, effort, critères de réussite) :
> [`docs/ROADMAP.md`](./ROADMAP.md).

## 8. La prochaine étape recommandée

**Servir les boutiques qui utilisent déjà Stokari** — pas la facturation : l'application est
**gratuite pour le moment**, décision assumée. Les quatre étapes sont livrées, les photos
produits aussi, et l'abonnement est **volontairement reporté**.

Les chantiers utiles, dans cet ordre :

1. ~~Ne pas rater une commande~~ ✅ : l'**e-mail gratuit** est en place
   (`docs/EMAIL-COMMANDES.md`) ; reste à faire côté **SMS / WhatsApp**.
2. ~~Rassurer le client~~ ✅ : le suivi par numéro `CMD-…` est en place.
3. **Fiabiliser** : sauvegardes et journal d'audit lisible.

Ordre proposé :

1. ~~Ventes~~ ✅ — panier, ticket, encaissement, stock automatique, annulation.
2. ~~Rapports~~ ✅ — CA, marge, top produits, dormants, export CSV.
3. ~~Boutique publique~~ ✅ — lien à partager, catalogue, panier, commande reçue dans l'app,
   confirmation qui crée la vente.
4. ~~Invitations d'équipe~~ ✅ — membres, rôles, invitations, acceptation automatique.
5. ~~Photos produits~~ ✅ — photo choisie dans la galerie du téléphone, réduite avant envoi,
   affichée dans l'application et dans le catalogue public.
6. ~~Caisse rapide, crédits, suivi client et PWA~~ ✅ — livrés dans l’itération 10.
7. **Abonnements** — ⏸️ reporté : Stokari est **gratuit** pour le moment, rien à payer ni à
   désactiver. À rouvrir quand plusieurs boutiques l'utiliseront vraiment.
