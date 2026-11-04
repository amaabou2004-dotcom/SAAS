# Reprendre le projet — la page unique

> Vous ne savez plus où vous en êtes ? Lisez cette page, elle fait le point.
> Dernière mise à jour : version `0.1.0` — itération 2.

---

## 1. Le projet en une phrase

**Stokari** est une application web de **gestion commerciale pour les commerces** :
vous y gérez vos **produits**, vos **stock** (entrées, sorties, transferts), vos
**catégories** et vos **emplacements** — chaque entreprise étant totalement isolée des autres.

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
| Idempotence (pas de double saisie) | ✅ | toutes les opérations |
| Isolation entre entreprises (RLS PostgreSQL) | ✅ | base de données |

**En clair :** quelqu'un peut s'inscrire, créer sa boutique, saisir ses produits,
enregistrer son stock et suivre tous les mouvements. C'est un socle solide et testé.

---

## 3. Ce qui n'existe pas encore

| À construire | Pourquoi c'est important |
| --- | --- |
| **Ventes / caisse** (panier, ticket, encaissement) | c'est le cœur de l'usage quotidien d'un commerce |
| **Boutiques publiques** (catalogue partageable, lien client) | vendre hors du magasin, sur WhatsApp |
| **Rapports** (chiffre d'affaires, marge, rotation) | savoir ce qui rapporte |
| **Abonnements / facturation** | gagner de l'argent avec le SaaS |
| **Invitations d'équipe** par e-mail | les rôles existent, mais on ajoute les membres en base |

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
| Les routes du serveur | `apps/api/src/*/‑controller.ts` |
| Les règles métier du serveur | `apps/api/src/*/‑service.ts` |
| Les tables et la sécurité | `supabase/migrations/*.sql` |

---

## 7. Comment vérifier que tout va bien

```bash
pnpm install          # installer les dépendances
pnpm test             # 73 tests (API + web)
pnpm typecheck        # vérification TypeScript
pnpm lint             # qualité du code
pnpm dev              # lancer l'interface (5173) et l'API (3001)
```

---

> **La suite détaillée du projet** (5 étapes, effort, critères de réussite) :
> [`docs/ROADMAP.md`](./ROADMAP.md).

## 8. La prochaine étape recommandée

**Les ventes.** C'est ce qui transforme un outil de stock en outil de commerce :
un panier, un encaissement, un ticket, et le stock qui diminue tout seul.

Ordre proposé :

1. **Ventes** — panier simple, encaissement (espèces / Mobile Money), ticket, sortie de stock automatique.
2. **Rapports** — chiffre d'affaires du jour, du mois, marge, produits qui se vendent le mieux.
3. **Boutique publique** — un lien à partager sur WhatsApp, avec le catalogue et les prix.
4. **Invitations d'équipe** — ajouter un vendeur avec un rôle limité aux ventes.
5. **Abonnements** — offrir un plan gratuit limité, puis un plan payant.
