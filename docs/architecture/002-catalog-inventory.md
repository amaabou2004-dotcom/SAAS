# ADR 002 — Catalogue et registre de stock

## Statut

Acceptée après la validation explicite de l’architecture Catalogue & Stock par le propriétaire du projet.

## Décisions

1. Les catégories, produits, variantes et emplacements appartiennent tous à un tenant. Des clés étrangères composites interdisent les associations entre tenants.
2. Un produit possède au moins une variante initiale créée dans la même transaction. Les variantes permettront d’ajouter SKU, codes-barres et attributs sans reconstruire le stock.
3. `stock_balances` conserve le physique et le réservé. Le disponible est calculé comme `on_hand - reserved`, jamais saisi indépendamment.
4. `stock_operations` et `stock_movements` forment un registre append-only. Une contre-passation crée de nouveaux mouvements inverses et ne supprime jamais l’historique.
5. `post_stock_operation` est l’unique chemin d’écriture du stock. Il vérifie l’utilisateur, la permission, le tenant, les lignes et les fonds disponibles, puis verrouille les soldes dans un ordre déterministe.
6. Une clé d’idempotence et une empreinte du payload empêchent les doublons et détectent la réutilisation d’une clé pour une opération différente.
7. Les vues de lecture sont `security_invoker`; elles ne contournent pas les politiques RLS des tables sous-jacentes.
8. Les rôles `anon` et `authenticated` n’ont aucun privilège direct d’écriture sur les soldes ou mouvements. Les opérations sensibles passent par des RPC `security definer` avec `search_path` fixe.
9. Chaque nouveau tenant reçoit un emplacement principal dans la même transaction de création. Les tenants existants sont migrés avec le même emplacement initial.
10. Aucun chiffre commercial ni produit de démonstration n’est ajouté aux données réelles.

## Conséquences

- Les ventes et réservations devront utiliser le même verrouillage et la même contrainte `reserved <= on_hand`.
- Les annulations de vente seront des contre-opérations liées à l’opération d’origine.
- Les rapports de marge devront distinguer prix de revient, chiffre d’affaires et encaissements; les prix du catalogue ne constituent pas des résultats réalisés.
- La suppression physique des produits et mouvements n’est pas exposée par l’API.

## Vérifications attendues

- Tests pgTAP de structure, RLS, isolation, idempotence, transferts et contre-passations.
- Test de concurrence avec deux connexions PostgreSQL indépendantes.
- Tests API et Web, lint, typecheck et builds avant application distante.

## Implémentation et durcissement

- Les endpoints NestJS sont exposés sous `/tenants/:tenantId/catalog` et `/tenants/:tenantId/inventory`; le navigateur utilise uniquement ces endpoints avec le jeton de l’utilisateur.
- Les pages React `/workspace/produits`, `/workspace/categories`, `/workspace/emplacements`, `/workspace/stock` et `/workspace/mouvements` affichent les états de chargement, d’erreur et de catalogue vide sans créer de fixtures commerciales.
- La migration `202611010003_stock_operation_idempotency.sql` réserve la clé avant le verrouillage de l’opération source d’une contre-passation. Deux requêtes simultanées avec la même clé et le même payload récupèrent donc le même identifiant; une clé différente ne peut pas contre-passer deux fois la même opération.
- `pnpm test:db:concurrency` exécute le scénario avec deux clients PostgreSQL distincts : retraits concurrents, retry identique et retry de contre-passation. La CI l’exécute après les tests pgTAP.
