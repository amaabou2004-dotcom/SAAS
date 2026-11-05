# Administrer Stokari (comptes et entreprises)

> **En une phrase** : le compte **amaabou2004@gmail.com** est administrateur de la plateforme.
> Il voit tous les comptes, toutes les entreprises et leurs chiffres d'ensemble dans
> **Espace de travail → Plus → Administration**, et la fréquentation dans **Plus → Audience**.

---

## 1. Qui est administrateur

| Adresse | Comment elle le devient |
| --- | --- |
| `amaabou2004@gmail.com` | **Automatiquement** : un déclencheur base la nomme administratrice à la création du compte (ou dès l'application de la migration si le compte existe déjà) |

Il n'y a rien à cliquer : si vous vous inscrivez avec cette adresse, l'accès s'ouvre seul. Si le
compte existait avant, la migration `202611050002_platform_admin.sql` le rattrape.

Pour ajouter une deuxième personne (associé, support) — Supabase → **SQL Editor** :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where lower(email) = 'associe@exemple.com'
on conflict (user_id) do nothing;
```

Pour retirer un accès :

```sql
delete from public.platform_admins
where user_id = (select id from auth.users where lower(email) = 'associe@exemple.com');
```

> Les autres comptes ne voient ni le menu ni les données : la base refuse l'appel
> (`platform_overview`, `audience_summary`) avant même d'afficher quoi que ce soit.

## 2. Ce que montre l'écran Administration

| Bloc | Contenu |
| --- | --- |
| **Totaux** | comptes, comptes confirmés, entreprises, ventes enregistrées, administrateurs |
| **Comptes** | e-mail, nom, date d'inscription, adresse vérifiée ou en attente, entreprises et rôle de chacun |
| **Entreprises** | nom, adresse de boutique, date de création, membres actifs, produits actifs, nombre de ventes, chiffre d'affaires (dans la devise de la boutique), premier inscrit |

La recherche filtre les deux tableaux à la fois (adresse, nom, nom de boutique ou adresse de
boutique).

## 3. Ce que l'écran ne fait pas (et pourquoi)

L'écran **n'ouvre pas** le détail commercial des entreprises : clients, lignes de vente, prix
d'achat, mouvements de stock et photos restent isolés par entreprise. C'est volontaire :

- l'isolation entre commerçants est la garantie centrale du produit (RLS PostgreSQL) ;
- un « super-accès » en lecture sur toutes les données transformerait un simple compte
  administrateur en porte d'entrée vers le chiffre d'affaires de chaque client ;
- les chiffres d'ensemble suffisent à suivre l'activité de la plateforme (entreprises actives,
  ventes, volumes).

Si un jour un accès de support ponctuel est nécessaire (dépannage d'une boutique précise), il
faut l'ajouter comme une fonction dédiée, journalisée et limitée dans le temps — dites-le si vous
en avez besoin.

## 4. Gérer un compte au quotidien

L'écran montre l'état ; les actions irréversibles restent dans la console d'authentification,
qui est l'outil prévu pour cela (Supabase → **Authentication → Users**) :

| Action | Où |
| --- | --- |
| Renvoyer un e-mail de confirmation | Console → ligne du compte → *Send confirmation* |
| Réinitialiser un mot de passe | Console → ligne du compte → *Send password recovery* |
| Supprimer définitivement un compte | Console → ligne du compte → *Delete user* |
| Retirer quelqu'un d'une entreprise | Dans l'application, côté commerçant : **Équipe** |

> Un compte supprimé efface ses profils et ses appartenances (clés étrangères `on delete
> cascade`) ; les entreprises dont il était le seul membre restent, avec leurs données.

## 5. Deux écrans réservés à l'administration

| Écran | Adresse | Contenu |
| --- | --- | --- |
| **Administration** | `/workspace/administration` | comptes, entreprises, totaux |
| **Audience** | `/workspace/audience` | visiteurs et pages vues, jour par jour |

Les deux appels sont refusés côté base pour tout compte qui n'est pas dans `platform_admins`
(erreur `42501`), même si quelqu'un connaissait l'adresse de l'écran.

## 6. Fichiers concernés

- migration : `supabase/migrations/202611050002_platform_admin.sql`
  (`grant_platform_admin_to_owner`, `platform_overview`, droits) ;
- interface : `apps/web/src/features/administration/` ;
- tests : `supabase/tests/006_platform_admin_test.sql`,
  `apps/web/src/features/administration/*.test.ts(x)` ;
- compteur de visites : [`AUDIENCE.md`](./AUDIENCE.md).
