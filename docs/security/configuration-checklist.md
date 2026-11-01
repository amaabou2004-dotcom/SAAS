# Checklist de configuration sécurisée

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
- [x] Écriture directe des tenants et rôles interdite aux utilisateurs.
- [x] Fonctions privilégiées avec `search_path` fixe.
- [x] Tests d’isolation multi-tenants écrits.
- [ ] Tests pgTAP exécutés sur l’environnement Supabase cible.
- [ ] Sauvegarde et restauration testées.

Cette checklist ne constitue pas une attestation de conformité ou de sécurité de production.
