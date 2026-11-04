# Prévenir le commerçant par e-mail à chaque commande — gratuit

Objectif : dès qu'un client envoie une commande depuis la boutique publique
(`/b/<adresse>`), le commerçant reçoit un e-mail avec le numéro `CMD-…`, le nom, le
téléphone, les articles et le total. **Coût : 0 F CFA.**

## Comment ça marche (sans jargon)

1. Le client envoie sa commande sur la boutique.
2. La base de données (Supabase) inscrit immédiatement une **alerte en attente** dans une
   file d'attente interne (`notification_outbox`). Rien ne peut être perdu : même si l'envoi
   d'e-mail est en panne, l'alerte reste dans la file.
3. Toutes les minutes, la base envoie les alertes en attente à **Brevo** (service d'e-mail
   gratuit) et lit la réponse : « envoyé » ou « à réessayer » (5 essais maximum).
4. L'écran **Boutique → Alertes e-mail des commandes** montre l'adresse prévenue et
   l'historique : *Envoyé*, *En attente d'envoi*, *Échec* (avec la raison).

Aucune clé secrète ne se trouve dans l'application web : la clé d'envoi est rangée dans le
**coffre-fort du projet Supabase** (Vault).

## Mise en route (5 minutes, une seule fois)

### 1. Créer un compte Brevo gratuit

1. <https://www.brevo.com/fr/> → **Créer un compte gratuit** (plan gratuit : **300 e-mails
   par jour**, aucune carte bancaire demandée).
2. Dans Brevo : **Expéditeurs & IP** → *Ajouter un expéditeur* → mettez l'adresse e-mail du
   commerçant (une adresse Gmail suffit, aucun nom de domaine n'est nécessaire) → validez le
   lien reçu par e-mail.
3. Dans Brevo : **SMTP & API → Clés API** → *Créer une clé* → copiez la clé
   (elle commence par `xkeysib-`).

### 2. Ranger la clé dans Supabase (Vault)

Ouvrez **Supabase → SQL Editor** du projet et exécutez (en remplaçant les deux valeurs) :

```sql
select vault.create_secret('xkeysib-…votre-clé…', 'brevo_api_key');
select vault.create_secret('patron@boutique.com', 'mail_from');
```

- `brevo_api_key` : la clé Brevo (elle ne sort jamais de la base).
- `mail_from` : **l'adresse expéditrice vérifiée dans Brevo** (celle de l'étape 1.2).

Pour changer une valeur plus tard :

```sql
select vault.update_secret((select id from vault.secrets where name = 'brevo_api_key'), 'nouvelle-clé');
```

Pour tout désactiver : supprimez le secret, les alertes resteront « en attente » sans être
envoyées.

```sql
delete from vault.secrets where name = 'brevo_api_key';
```

### 3. Indiquer l'adresse du commerçant dans Stokari

Espace de travail → **Boutique** → carte **« Alertes e-mail des commandes »** :

1. saisissez l'adresse à prévenir (ex. `patron@boutique.com`) ;
2. laissez cochée **« Prévenir à chaque nouvelle commande »** ;
3. **Enregistrer l'alerte**.

Tant que la clé n'est pas installée, une information s'affiche : *« L'envoi automatique n'est
pas encore activé sur le serveur »* — les alertes sont bien enregistrées et partiront dès
l'installation de la clé.

## Vérifier que tout fonctionne

1. Ouvrez la boutique publique dans un autre onglet et envoyez une commande de test.
2. Revenez dans **Boutique → Dernières alertes** : la ligne apparaît en *En attente d'envoi*.
3. Au plus tard une minute après, elle passe en **Envoyé** (l'e-mail arrive chez le
   commerçant). En cas d'erreur (clé fausse, expéditeur non validé), le statut **Échec**
   affiche la raison et l'envoi est retenté 5 fois.

Vérification côté base (facultatif) :

```sql
-- Dans le SQL Editor Supabase (rôle postgres)
select status, subject, attempts, last_error, created_at, sent_at
from public.notification_outbox
order by created_at desc
limit 5;
```

> Si vous préférez une autre passerelle d'e-mail, il suffit d'adapter l'appel HTTP de la
> fonction `dispatch_notifications()` (elle envoie aujourd'hui une requête à l'API Brevo).

## Limites et bon sens

- **300 e-mails par jour** avec le plan gratuit Brevo, largement suffisant pour un commerce.
- Aucune donnée de coût n'est envoyée : l'e-mail contient ce que le client voit déjà.
- L'adresse du commerçant reste dans la base Supabase et n'est transmise qu'à Brevo pour
  l'envoi.
- Ce réglage est **une adresse par entreprise** (une par boutique Stokari).
