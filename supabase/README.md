# Base de données Kanti (Supabase)

Le schéma est versionné dans `migrations/` et déjà appliqué au projet
`suuchdahpftxwbvwhbyq` (région `eu-north-1`, PostgreSQL 17).

## Migrations

| Fichier | Contenu |
| --- | --- |
| `20261102120000_kanti_inventory_core.sql` | Fournisseurs, colonnes produit (unité, seuil, réappro, emplacement, fournisseur), types d'opération `issue`/`inventory`, RPC `upsert_product`, `post_stock_operation`, `save_supplier`, `delete_supplier`, `delete_product`, `update_tenant_settings` |
| `20261102121000_kanti_demo_seed.sql` | `seed_demo_data` (33 produits, 5 fournisseurs, stock d'ouverture) et `seed_demo_history` (historique de ventes/réceptions) |

Le socle d'origine (tenants, memberships, rôles, permissions, catégories, produits, variantes,
emplacements, soldes, opérations, mouvements, vues `stock_overview` / `stock_movement_history`,
RLS et RPC `create_tenant`, `upsert_category`, `upsert_stock_location`) est conservé tel quel.

## Sécurité

- RLS activé sur toutes les tables ; policies en lecture par permission
  (`inventory.read`, `catalog.read`), aucune policy d'écriture.
- Toutes les écritures passent par des fonctions `SECURITY DEFINER` qui vérifient
  `auth.uid()` et `has_tenant_permission(...)`.
- Vues en `security_invoker = true` : elles n'exposent que ce que la RLS autorise.
- Clé `publishable` uniquement côté client ; la clé `service_role` n'est jamais exposée.

## Vérifications exécutées

15 contrôles SQL exécutés en impersonnant un utilisateur `authenticated` :

- création d'entreprise + dépôt principal, seed démo (33 produits / 5 fournisseurs / 220+ mouvements) ;
- sortie de stock, refus si stock insuffisant, annulation (stock restauré), inventaire ;
- fournisseur (création/suppression), produit (création/mise à jour/suppression), réglages entreprise ;
- écriture directe en table refusée ;
- isolation : un second compte ne voit **aucune** ligne de l'entreprise (0 produit, 0 mouvement, 0 fournisseur).

## Prérequis Auth

- `mailer_autoconfirm = true` (démo) : inscription immédiatement utilisable, sans e-mail de confirmation.
- `Site URL` : `https://5173-<sandbox>.e2b.app` ; `Redirect URLs` : `/auth/callback`,
  `/auth/reinitialisation` (preview 5173/4173, localhost, domaine de production).
- Mot de passe : 8 caractères minimum (contrôlé côté client).
