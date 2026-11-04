# Audit complet de Stokari

**Date :** 4 novembre 2026 · **Version auditée :** commits `c13b2f4` → `c290cd1` (branche `arena/a1588569-saas`)
**Périmètre :** sécurité des accès, base de données, API, code du site, tests automatiques, performance, préparation à la mise en ligne.

Ce document répond à trois questions, dans cet ordre :
1. **Qu'est-ce qui est déjà solide ?**
2. **Qu'est-ce qui a été corrigé aujourd'hui ?**
3. **Que reste-t-il à faire — et par qui ?**

---

## 1. En deux minutes

| Sujet | État |
| --- | --- |
| Cloisonnement entre entreprises (données) | ✅ solide |
| Droits d'accès aux fonctions de la base | ✅ durcis aujourd'hui |
| Mots de passe, sessions, Google | ✅ correct |
| E-mails de compte (mot de passe oublié, invitation) | ❌ pas de serveur SMTP → **le point bloquant** |
| Tests automatiques (code) | ✅ 194 tests verts |
| Test de bout en bout (navigateur) | ✅ réparé aujourd'hui, CI entièrement verte |
| Performance | ✅ bon niveau, index en place |
| Failles connues dans les dépendances | ✅ 0 (`pnpm audit`) |

**Verdict :** l'application est saine techniquement. Ce qui manque pour ouvrir au public n'est pas du code, c'est **un serveur d'e-mail (Brevo, déjà prévu)** et quelques cases à cocher dans Supabase.

---

## 2. Sécurité de la base de données

### Ce qui est déjà solide (vérifié sur la vraie base)

- **22 tables**, toutes avec la sécurité par ligne (RLS) activée : une entreprise ne peut pas lire les données d'une autre, même en connaissant leur identifiant.
- **21 règles d'accès**, toutes réservées aux utilisateurs connectés et filtrées par entreprise. La table des profils est limitée à sa propre ligne.
- Les fonctions sensibles (`post_sale`, `void_sale`, `report_summary`, gestion d'équipe, boutique) contrôlent **qui** appelle et **avec quel rôle** (`has_tenant_permission`).
- **45 fonctions sensibles examinées** : aucune ne peut être détournée par un changement de schéma (`search_path` épinglé partout).
- **Photos produits** : lecture publique (nécessaire pour la boutique en ligne), écriture réservée aux membres ayant le droit « catalogue ».
- **Aucune clé secrète dans le navigateur** : seule la clé publique `publishable` est utilisée ; la clé `service_role` n'apparaît nulle part dans le code.
- Le stock est calculé par déclencheurs et non recalculé à chaque affichage : pas de risque d'incohérence visible.

### Corrigé aujourd'hui — migration `202611020010_security_hardening.sql`

1. **Le rôle « visiteur non connecté » (`anon`) pouvait tenter d'appeler 27 fonctions internes** : création d'entreprise, produits, stock, fournisseurs, rapports, alertes e-mail, génération de données de démonstration…
   Toutes ces fonctions refusaient déjà de répondre correctement (elles vérifient l'utilisateur et son rôle), donc **aucune fuite n'a été constatée**. Mais c'était une ceinture sans bretelles.
   → Désormais, un visiteur ne peut appeler **que les 3 fonctions de la boutique publique** (`storefront_catalog`, `storefront_info`, `place_storefront_order`).
2. **Envoi d'e-mails et contenu des commandes** (`dispatch_notifications`, `sync_notification_status`, `order_notification_body`) : réservés au service interne. Plus aucun navigateur ne peut lire le détail d'une commande à partir de son identifiant.
3. **Générateurs de données de démonstration** (`seed_demo_data`, `seed_demo_history`) : service uniquement → l'application ne peut plus injecter de **données commerciales factices**, conformément à la règle fixée.
4. **Table `suppliers`** : elle avait gardé un ancien « tous les droits » (14 droits, y compris pour les visiteurs). → lecture seule.
   ⚠️ Cette table (et les fonctions `save_supplier` / `delete_supplier`) **n'est utilisée par aucun écran et ne figure dans aucune migration** : c'est un reste d'une première version. Elle ne gêne pas, mais il faudra décider de la supprimer définitivement (ou de la documenter si un écran « fournisseurs » est prévu).
5. **Vue `sales_overview`** : lecture seule.
6. **Sécurité par défaut** : toute nouvelle table ou fonction créée dans le schéma public sera désormais **fermée au rôle visiteur** ; il faudra l'autoriser explicitement (fini les oublis).
7. **Index ajouté** sur `notification_outbox` : la liste des alertes e-mail reste rapide quand l'historique grossit.

> Ces changements ont été appliqués à la base de production **et** enregistrés dans le dépôt (git), pour que la CI rejoue exactement le même schéma.

---

## 3. Connexion et comptes

### Ce qui est solide

- Sessions à jetons renouvelés (`refresh token rotation`), expiration 1 heure.
- Connexion Google opérationnelle (identifiants présents et activés).
- Mot de passe : **12 caractères minimum imposés par l'application**, avec indicateur visuel.
- Page de vérification qui redirige automatiquement vers l'espace de travail quand le compte est déjà confirmé (pas de blocage).
- Adresses de retour (URL) correctement limitées : `stokari.vercel.app` + aperçus + localhost.

### Points d'attention (à traiter avant l'ouverture au public)

| Constat | Risque | Action |
| --- | --- | --- |
| Aucun serveur SMTP configuré | **Les e-mails de « mot de passe oublié » et d'invitation ne partent pas de façon fiable** (limite intégrée : 2 e-mails/heure). Un utilisateur qui oublie son mot de passe est bloqué. | Brancher Brevo en SMTP dans Supabase (voir §7) |
| Confirmation d'e-mail désactivée (`mailer_autoconfirm`) | Quelqu'un peut créer un compte avec une adresse qui n'est pas la sienne | À réactiver **après** le SMTP |
| Longueur minimale du mot de passe = 6 côté Supabase | Faiblesse si un client appelle l'API directement | Passer à 8 minimum |
| Inscriptions anonymes activées | Inutiles ici, elles créent des comptes fantômes | Désactiver |
| CAPTCHA désactivé | Inscriptions en masse possibles | Optionnel (free tier) |

Ces réglages ne sont pas tous modifiables depuis ici : Supabase → **Authentication → Sign In / Providers** et **Auth → Settings**.

---

## 4. API et code

- **Toutes les routes API sont protégées** par l'authentification, sauf trois exceptions voulues : la page d'accueil du service, `/health` et la boutique publique.
- **Validation stricte des entrées** : champs inconnus refusés, longueurs maximales, quantités positives, e-mail et téléphone contrôlés.
- **Limite de 120 requêtes par minute** par client, en-têtes de sécurité (`helmet`), CORS restreint à l'application.
- **Code propre** : aucun `console.log` oublié, aucun `TODO`/`FIXME`, aucun type `any`.
- **Dépendances** : `pnpm audit` → aucune vulnérabilité connue.
- **Poids du site** : 126 ko compressés pour le premier chargement, pages suivantes chargées à la demande.

> Remarque importante : en production, le site déployé sur Vercel fonctionne en mode **direct** (le navigateur parle directement à Supabase). L'API NestJS existe et est testée, mais n'est pas sollicitée par le site. Le durcissement de la base s'applique donc **dans tous les cas**.

---

## 5. Tests automatiques

| Suite | Résultat |
| --- | --- |
| API (`apps/api`) | 64 tests / 16 fichiers ✅ |
| Site (`apps/web`) | 130 tests / 23 fichiers ✅ |
| Base de données (pgTAP + concurrence du stock) | ✅ |
| Lint, vérification des types, build | ✅ |
| Test navigateur de bout en bout (e2e) | ✅ **réparé aujourd'hui — CI verte** |

### Pourquoi le test navigateur échouait

Depuis plusieurs jours, la CI échouait toujours à la même étape. Cause exacte trouvée aujourd'hui :
le test créait une **deuxième** entreprise et attendait immédiatement le catalogue, alors que l'espace s'ouvre désormais sur **« Accueil du jour »** (changement fait lors de l'ajout du tableau de bord). Le premier compte cliquait bien sur l'onglet « Produits » ; le second, non.

→ Correction : le test clique lui aussi sur « Produits » avant de vérifier le catalogue.

**Deuxième problème trouvé au passage :** la migration de durcissement faisait référence à
`rls_auto_enable`, une fonction qui n'existe **que** sur le projet hébergé, pas dans Supabase local.
Résultat : la CI ne pouvait plus créer sa base de test. La migration passe désormais par une boucle
sur les fonctions réellement présentes (et ignore celles des extensions) : elle fonctionne sur les
deux environnements.

**Résultat :** la CI est **entièrement verte** (contrôles `application` et `database`, dont le test
navigateur complet) sur le commit `c290cd1` — première fois depuis le début de l'itération.

**Troisième amélioration :** les journaux de la CI n'étaient pas téléchargeables (erreur EOF côté
stockage GitHub). La CI publie donc maintenant la fin du journal de démarrage dans les
« annotations » du contrôle, lisibles directement — c'est ce qui a permis de trouver les deux causes
ci-dessus.

---

## 6. Performance

- Index présents sur toutes les colonnes filtrées : ventes par entreprise et date, mouvements, soldes de stock, commandes de boutique, invitations.
- Aucun index manquant important ; un seul ajouté (`notification_outbox`).
- Les écritures passent par des fonctions transactionnelles (`post_sale`, `post_stock_operation`) : une vente = une transaction, pas de double écriture possible (clé d'idempotence).
- Le cron d'e-mails fait **une requête par minute**, coût négligeable.

---

## 7. À faire — côté compte (pas de code)

Par ordre d'importance :

1. **Brancher un serveur SMTP (Brevo)** — Supabase → *Authentication → Emails → SMTP Settings* :
   - hôte `smtp-relay.brevo.com`, port `587`, utilisateur = identifiant SMTP Brevo, mot de passe = clé SMTP ;
   - expéditeur : l'adresse que tu as vérifiée chez Brevo.
   → Débloque « mot de passe oublié » et les e-mails d'invitation.
2. **Vault : `brevo_api_key` + `mail_from`** (alerte e-mail à chaque commande) — voir `docs/EMAIL-COMMANDES.md`. Tant que ces deux secrets manquent, la file d'attente reste vide et aucune alerte ne part.
3. **Réglages Auth à cocher** : confirmation d'e-mail ON (une fois le SMTP en place), mot de passe minimum 8, inscriptions anonymes OFF.
4. **Déploiement Vercel** — reporté à ta demande ; la procédure est prête dans `docs/DEPLOIEMENT-VERCEL.md`.
5. **Sauvegardes** : vérifier que le plan Supabase actif inclut les sauvegardes quotidiennes (ou exporter régulièrement la base).
6. **Objets hérités** : décider du sort de la table `suppliers` et des fonctions `save_supplier` / `delete_supplier` (voir §2, point 4).

---

## 8. Comment vérifier par toi-même

```bash
pnpm lint        # qualité du code
pnpm typecheck   # types
pnpm test        # 194 tests
pnpm build       # build de production
```

Et dans Supabase → **Database → Functions** : le rôle `anon` ne doit apparaître que sur
`storefront_catalog`, `storefront_info` et `place_storefront_order`.

---

*Audit réalisé sur la base de production `suuchdahpftxwbvwhbyq` (22 tables, 45 fonctions sensibles, 21 règles RLS) et sur le dépôt à jour.*
