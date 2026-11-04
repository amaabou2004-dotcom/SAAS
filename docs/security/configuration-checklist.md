# Checklist de configuration sécurisée

> Dernier audit complet : [`docs/AUDIT.md`](../AUDIT.md) (4 novembre 2026) — constats,
> corrections appliquées et points restants côté compte.

## Supabase Auth

- [ ] Confirmation d’e-mail obligatoire et auto-confirmation désactivée.
- [ ] Modèle d’inscription avec `{{ .Token }}` pour le parcours par code.
- [ ] Mot de passe d’au moins 12 caractères.
- [ ] OTP de 8 chiffres avec expiration courte.
- [ ] SMTP personnalisé configuré et délivrabilité testée.
- [ ] CAPTCHA activé sur les parcours publics sensibles.
- [ ] URL du site et liste des redirections limitées aux environnements connus.
- [ ] Rotation des refresh tokens activée.
- [ ] Notifications de sécurité activées.
- [ ] Client Google OAuth limité à `openid`, `email` et `profile`.
- [ ] Secret Google enregistré uniquement dans Supabase Auth.
- [ ] Callback applicatif `/auth/callback` limité aux origines connues.
- [x] Aucun contournement manuel de la confirmation e-mail pour OAuth.

## API et navigateur

- [x] Aucune clé secrète dans les variables `VITE_`.
- [x] Jeton Bearer vérifié par l’API.
- [x] Refus des comptes dont l’e-mail n’est pas confirmé.
- [x] Validation stricte des DTO et rejet des propriétés inconnues.
- [x] Helmet et limitation globale des requêtes.
- [x] URL API relatives dans le navigateur.
- [ ] Limites spécifiques aux endpoints sensibles et protection anti-robots.
- [ ] Journalisation de sécurité centralisée sans jetons ni données secrètes.

## Base de données

- [x] RLS activée sur les tables de la première tranche.
- [x] Privilèges `anon` révoqués sur les données privées.
- [x] Privilèges `anon` révoqués sur **toutes les fonctions**, sauf les 3 RPC de la boutique publique (`storefront_catalog`, `storefront_info`, `place_storefront_order`) — migration `202611020010_security_hardening.sql`.
- [x] Pipeline e-mail (`dispatch_notifications`, `sync_notification_status`, `order_notification_body`) et générateurs de démonstration réservés au service.
- [x] Droits par défaut durcis : toute nouvelle table ou fonction du schéma `public` est fermée à `anon` par défaut.
- [x] `suppliers` et `sales_overview` en lecture seule pour les clients (écriture via RPC contrôlées).
- [x] Écriture directe des tenants et rôles interdite aux utilisateurs.
- [x] Fonctions privilégiées avec `search_path` fixe.
- [x] Tests d’isolation multi-tenants écrits.
- [ ] Tests pgTAP exécutés sur l’environnement Supabase cible.
- [ ] Sauvegarde et restauration testées.

Cette checklist ne constitue pas une attestation de conformité ou de sécurité de production.
