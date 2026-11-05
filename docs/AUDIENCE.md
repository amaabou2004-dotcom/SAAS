# Savoir combien de personnes visitent Stokari

> **Réponse courte** : l'écran **Espace de travail → Plus → Audience** affiche le nombre de
> visiteurs et de pages vues, jour par jour. Le compteur est interne : **aucun outil tiers,
> aucun cookie, aucune adresse IP conservée, 0 F**.

---

## 1. Ce qui est compté

| Compté | Non compté |
| --- | --- |
| Visites de l'accueil public (`/`) | Pages de l'espace de travail (connexion obligatoire) |
| Visites d'une boutique partagée (`/b/<adresse>`) | Formulaires de connexion et d'inscription |
| Visites des pages légales | Vues répétées de la même personne le même jour, sur la même page |
| Visiteurs différents par jour | Identité des visiteurs, parcours, appareil, pays |

Une personne qui revient trois fois dans la journée sur l'accueil compte **une fois**. Le
lendemain, elle est de nouveau comptée **une fois** : c'est ce qui distingue « visiteurs par
jour » de « pages vues ».

## 2. Comment ça marche (sans jargon)

1. À l'ouverture d'une page publique, le navigateur envoie un message minuscule au serveur.
2. Le serveur calcule une **empreinte** à partir de l'adresse de connexion, du navigateur et du
   jour (avec un sel fixe), puis jette l'adresse IP : elle n'est jamais écrite.
3. Une contrainte d'unicité empêche la même empreinte d'enregistrer deux fois la même page le
   même jour.
4. L'empreinte change chaque jour : impossible de suivre une personne d'un jour à l'autre, ou de
   la reconnaître sur un autre site.
5. Un garde-fou limite à **40 pages différentes par visiteur et par jour**, ce qui neutralise un
   script bruyant.

Les chiffres sont des **totaux agrégés** : ni nom, ni e-mail, ni adresse, ni identifiant durable.

## 3. Mise en service (une seule fois)

1. **Appliquer la migration** : `supabase db push` (projet hébergé) ou `supabase db reset` (local).
   Elle crée `page_views`, `platform_admins`, `track_page_view()`, `audience_summary()` et
   `is_platform_admin()`.
2. **Vérifier votre accès administrateur.** L'adresse `amaabou2004@gmail.com` est nommée
   administratrice **automatiquement** (migration `202611050002_platform_admin.sql`). Pour une
   autre personne, dans Supabase → **SQL Editor** :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'votre-adresse@exemple.com'
on conflict (user_id) do nothing;
```

Remplacez l'adresse par celle de votre compte Stokari. Pour ajouter une deuxième personne,
relancez la même requête avec son adresse ; pour retirer un accès :

```sql
delete from public.platform_admins
where user_id = (select id from auth.users where email = 'ancien-admin@exemple.com');
```

3. **Recharger l'application** : l'entrée **Audience** apparaît dans le menu **Plus**. Les autres
   comptes ne la voient pas, et la base refuse de toute façon la lecture.

## 4. Lire les chiffres autrement (SQL)

```sql
-- Les 14 derniers jours
select viewed_on as jour,
       count(distinct visitor_hash) as visiteurs,
       count(*) as pages_vues
from public.page_views
where viewed_on >= current_date - 13
group by viewed_on
order by viewed_on desc;

-- Pages les plus vues sur 30 jours
select path, count(*) as vues
from public.page_views
where viewed_on >= current_date - 29
group by path
order by vues desc;
```

## 5. Purge et conservation

Le compteur ne garde que des totaux : une purge annuelle suffit largement.

```sql
-- Supprimer les lignes de plus de 400 jours
delete from public.page_views where viewed_on < current_date - 400;
```

Pour l'automatiser (offre Supabase avec `pg_cron`) :

```sql
select cron.schedule(
  'purge-page-views',
  '30 3 * * *',
  $$delete from public.page_views where viewed_on < current_date - 400$$
);
```

## 6. Limites à connaître

- **Publiez le compteur avant de communiquer** : il ne peut pas compter le passé.
- Derrière un même réseau d'entreprise (adresse partagée), plusieurs personnes peuvent compter
  pour une seule.
- Une personne qui change de navigateur ou de téléphone est comptée comme une nouvelle personne.
- Les bloqueurs de publicité n'ont aucun effet : il n'y a ni script tiers ni cookie à bloquer.
- Ce compteur ne suit **pas** les conversions (inscription terminée, commande envoyée). Pour cela,
  utilisez les rapports internes : **Rapports** (ventes) et **Équipe** (comptes créés).

## 7. Coût et confidentialité

| Poste | Coût |
| --- | --- |
| Compteur, écran Audience, stockage | 0 F (inclus dans l'offre gratuite) |
| Outil tiers | aucun |

Le paragraphe correspondant figure dans la politique de confidentialité (section 7,
« Cookies et mesure d'audience ») : le comptage y est décrit tel qu'il fonctionne réellement.

Fichiers concernés : `supabase/migrations/202611050001_audience_counter.sql`,
`apps/web/src/features/audience/`, tests `supabase/tests/005_audience_counter_test.sql`.
