# ADR 001 — Fondation identité et tenants

## Statut

Acceptée pour la première itération, après validation de l’architecture par le propriétaire du projet.

## Décisions

1. Le dépôt est un monorepo pnpm avec une application React et un monolithe modulaire NestJS.
2. Supabase Auth est la seule source d’identité et de gestion des mots de passe.
3. Une entreprise est représentée par `tenants`; un utilisateur y accède par `memberships`.
4. Chaque rôle appartient à un tenant. Les clés étrangères composites empêchent d’associer un rôle à une entreprise différente.
5. La création d’une entreprise passe par `create_tenant`, fonction transactionnelle avec contrôle explicite de l’utilisateur et de la confirmation de son e-mail.
6. Les opérations API utilisent le contexte du jeton utilisateur. Aucune clé secrète n’est utilisée pour les opérations métier de cette itération.
7. Les données de démonstration commerciale ne sont pas créées.

## Conséquences

- L’interface peut être développée sans exposer de secret.
- La création d’une entreprise est atomique : entreprise, rôle propriétaire, permissions et adhésion réussissent ou échouent ensemble.
- Les quotas d’abonnement devront être ajoutés dans une évolution ultérieure de `create_tenant`.
- Les invitations et rôles personnalisés ne sont pas encore exposés par l’API.
- Les tests d’isolation doivent rester obligatoires pour chaque nouvelle table tenantée.

## Vérifications attendues

- TypeScript, ESLint, tests unitaires/API et build à chaque changement.
- Tests pgTAP sur une base Supabase réelle.
- Test négatif systématique : un membre du tenant A ne doit ni lire ni modifier le tenant B.
