# Reprendre le projet — la page unique

> Vous ne savez plus où vous en êtes ? Lisez cette page, elle fait le point.
> Dernière mise à jour : version `0.1.0` — itération 4 (la caisse et l'équipe sont en place).

---

## 1. Le projet en une phrase

**Stokari** est une application web de **gestion commerciale pour les commerces** :
vous y gérez vos **produits**, vos **stock** (entrées, sorties, transferts), vos
**catégories**, vos **emplacements** — vous y **encaissez vos ventes** (panier, ticket,
Mobile Money, annulation) et vous y **gérez votre équipe** (invitations, rôles) — chaque
entreprise étant totalement isolée des autres.

Plusieurs personnes peuvent travailler dans la même entreprise, chacune avec un rôle
(propriétaire, gestionnaire, vendeur…).

---

## 2. Ce qui marche aujourd'hui (testable tout de suite)

| Fonction | État | Où |
| --- | --- | --- |
| Créer un compte (e-mail + mot de passe) | ✅ | `/auth/inscription` |
| Vérifier son e-mail par code à 8 chiffres | ✅ | `/auth/verification` |
| Se connecter / se déconnecter | ✅ | `/auth/connexion` |
| Mot de passe oublié et réinitialisation | ✅ | `/auth/mot-de-passe-oublie` |
| Connexion Google | ✅ (si activée) | bouton sur la connexion |
| Créer son entreprise (onboarding) | ✅ | `/onboarding` |
| Rôles et permissions à la création | ✅ | automatique |
| Catégories de produits | ✅ | `/workspace/categories` |
| Produits et variantes (SKU, code-barres) | ✅ | `/workspace/produits` |
| Emplacements de stock | ✅ | `/workspace/emplacements` |
| Niveaux de stock (physique, réservé, disponible) | ✅ | `/workspace/stock` |
| Réceptions, ajustements, transferts | ✅ | `/workspace/mouvements` |
| Historique immuable + contre-passation (annulation) | ✅ | `/workspace/mouvements` |
| **Ventes** : liste, total et marge du jour, ticket détaillé | ✅ | `/workspace/ventes` |
| **Nouvelle vente** : panier, prix modifiable, ticket imprimable | ✅ | `/workspace/ventes/nouvelle` |
| Encaissement espèces / Mobile Money / crédit | ✅ | écran Nouvelle vente |
| Annulation d'une vente avec retour du stock | ✅ | détail d'une vente |
| **Équipe** : membres, rôles, invitations en attente | ✅ | `/workspace/equipe` |
| Inviter une personne par e-mail et lui donner un rôle | ✅ | `/workspace/equipe` |
| Retirer un membre (jamais le dernier propriétaire) | ✅ | `/workspace/equipe` |
| Idempotence (pas de double saisie) | ✅ | toutes les opérations |
| Isolation entre entreprises (RLS PostgreSQL) | ✅ | base de données |

**En clair :** quelqu'un peut s'inscrire, créer sa boutique, saisir ses produits,
enregistrer son stock, suivre les mouvements, **vendre au comptoir** (ticket numéroté, stock
qui baisse tout seul, annulation qui remet le stock) **et inviter son vendeur** avec un rôle
limité. C'est un socle solide et testé (116 tests).

---

## 3. Ce qui n'existe pas encore

| À construire | Pourquoi c'est important |
| --- | --- |
| **Boutiques publiques** (catalogue partageable, lien client) | vendre hors du magasin, sur WhatsApp |
| **Rapports** (chiffre d'affaires, marge, rotation) | savoir ce qui rapporte |
| **Abonnements / facturation** | gagner de l'argent avec le SaaS |

---

## 4. Comment le voir tourner (3 minutes)

1. Ouvrez l'aperçu du **port 5173**.
2. **Créez un compte** : e-mail + mot de passe (8 caractères minimum).
3. Un **code à 8 chiffres** s'affiche — en développement, il est dans la réponse du
   serveur ; sinon utilisez le lien reçu.
4. Vous arrivez sur **« Créer votre entreprise »** : nom, devise (XOF par défaut), fuseau.
5. Vous êtes dans l'espace : commencez par **Emplacements** (un dépôt est déjà créé),
   puis **Catégories**, puis **Produits**.
6. Onglet **Stock** : saisissez une quantité d'ouverture via **Mouvements** → réception.
7. Onglet **Mouvements** : chaque opération est horodatée, attribuée et annulable.
8. Onglet **Ventes** → **Nouvelle vente** : ajoutez un produit, ajustez la quantité,
   choisissez le paiement, **Encaissez**. Le ticket s'affiche avec son numéro `VTE-…`.
9. Revenez sur **Ventes** : le ticket est dans la liste. Ouvrez **Détails** pour annuler
   (le stock revient) — l'annulation demande un motif.
10. Onglet **Équipe** : invitez une adresse avec le rôle **Vendeur**. Si cette personne crée
    un compte avec cette adresse, l'entreprise apparaîtra chez elle dès sa connexion.

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
| Ventes, ticket, panier | `apps/web/src/features/sales/` |
| Équipe, invitations, rôles | `apps/web/src/features/team/` |
| Les routes du serveur | `apps/api/src/*/‑controller.ts` |
| Les règles métier du serveur | `apps/api/src/*/‑service.ts` |
| Les tables et la sécurité | `supabase/migrations/*.sql` |

---

## 7. Comment vérifier que tout va bien

```bash
pnpm install          # installer les dépendances
pnpm test             # 116 tests (API + web)
pnpm typecheck        # vérification TypeScript
pnpm lint             # qualité du code
pnpm dev              # lancer l'interface (5173) et l'API (3001)
```

---

> **La suite détaillée du projet** (5 étapes, effort, critères de réussite) :
> [`docs/ROADMAP.md`](./ROADMAP.md).

## 8. La prochaine étape recommandée

**Les rapports.** Ventes et équipe sont en place : il reste à transformer les tickets en
informations utiles — ce qui rapporte, ce qui dort, quelle marge.

Ordre proposé :

1. ~~Ventes~~ ✅ — panier, ticket, encaissement, stock automatique, annulation.
2. **Rapports** — chiffre d'affaires du jour / 7 / 30 / 90 jours, marge, top produits.
3. **Boutique publique** — un lien à partager sur WhatsApp, avec le catalogue et les prix.
4. ~~Invitations d'équipe~~ ✅ — membres, rôles, invitations, acceptation automatique.
5. **Abonnements** — offrir un plan gratuit limité, puis un plan payant.
