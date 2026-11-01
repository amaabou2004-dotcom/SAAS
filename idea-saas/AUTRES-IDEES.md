# 6 autres idées de SaaS — avec grille de notation

> Complément à `IDEE.md` (Boutiki). Ici : **6 idées nouvelles**, distinctes entre
> elles. Trois jouent le marché local (Niger / UEMOA), trois se vendent à
> l'international en devises — parce que facturer en FCFA et facturer en € ne
> demandent pas le même produit.

---

## Comment lire (et comment choisir)

Notation sur 5 pour 6 critères :

| Critère | Question |
|---|---|
| **Douleur** | Le client perd-il de l'argent *chaque semaine* sans ton produit ? |
| **Vente** | Peux-tu trouver 10 clients sans publicité ? |
| **Fossé** | La donnée s'accumule-t-elle, rendant le départ coûteux ? |
| **Ticket** | Combien par client et par mois ? |
| **Tech** | 5 = simple / 1 = très complexe |
| **Régul** | 5 = aucun risque juridique / 1 = très encadré |

## Le tableau, d'abord

| # | Idée | Douleur | Vente | Fossé | Ticket | Tech | Régul | **Total** |
|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | **Karité** — l'ardoise numérique des boutiques | 5 | 4 | 4 | 3 | 4 | 4 | **24** |
| 2 | **Standard** — réceptionniste IA au téléphone | 4 | 4 | 3 | 5 | 3 | 4 | **23** |
| 3 | **Tender** — veille IA des marchés publics | 4 | 4 | 3 | 4 | 4 | 5 | **24** |
| 4 | **Médic** — stock & péremptions des pharmacies | 4 | 3 | 4 | 3 | 3 | 3 | **20** |
| 5 | **Bulletin** — paie + CNSS/ITS pour PME | 5 | 3 | 4 | 4 | 2 | 2 | **20** |
| 6 | **Vitrine** — Google + avis pour PME | 3 | 3 | 2 | 4 | 5 | 5 | **22** |

**Mon verdict :** n°1 si tu veux bâtir un actif local défendable, n°2 si tu veux
du cash en euros dès le premier mois, n°3 si tu aimes la donnée et les appels
d'offres. Les n°4 et 5 sont de très bons business… mais lents à vendre et lourds
en conformité.

---

# 1. Karité — l'ardoise numérique des boutiques de quartier

**Le problème.** Dans chaque boutique de quartier, il y a un cahier : les dettes
des clientes. « Prends, tu paieras vendredi. » Le cahier se perd, se mouille, et
personne ne sait qui doit quoi. Résultat : **5 à 15 % du chiffre d'affaires part
en créances mortes**, et le boutiquier n'a aucun moyen de vérifier si une nouvelle
cliente est fiable.

**La cible.** Épiceries, boutiques de quartier, quincailleries, revendeuses de
vivres — 2 000 à 20 000 FCFA de ventes/jour, souvent analphabètes en français
mais très à l'aise avec le téléphone.

**Le produit (MVP).**
- **Encaissement ultra-simple** : 3 boutons géants (Espèces / Crédit / Remboursement),
  avec photos des articles et reconnaissance vocale en haoussa/zarma.
- **Le carnet de dettes automatique** : chaque crédit crée une créance, chaque
  remboursement la solde. **Relance SMS/WhatsApp automatique** à J+7, J+14, J+30
  (le boutiquier n'a plus à réclamer — la honte est déléguée au logiciel).
- **Score de confiance** : l'historique de paiement de chaque cliente, partagé
  entre boutiques du même quartier (opt-in). « Cette dame a remboursé 14 fois sur 14. »

**Prix.** 3 000 FCFA/mois (Starter) · 7 000 FCFA/mois (multi-caisses + relances).
Option : 1 % du crédit recouvré — le boutiquier ne paie que s'il récupère son argent.

**Fossé.** Deux effets cumulés : le carnet de créances devient **indispensable**
(le quitter = perdre son historique), et le score de confiance crée un **effet
réseau de quartier** (chaque boutique enrichit la donnée des autres).

**Go-to-market 30 jours.** Un quartier à la fois. On installe l'app sur le
téléphone, on photographie les 30 articles avec elle, on saisit les 10 créances
en cours. Objectif : **20 boutiques dans 2 quartiers**, puis les grossistes qui
livrent ces boutiques deviennent revendeurs (ils veulent savoir qui paie).

**Vrai risque.** Le crédit est réglementé : **on ne prête pas**, on enregistre et
on relance. La brique crédit (avancer la marchandise) ne vient qu'après, avec un
partenaire agréé.

---

# 2. Standard — le réceptionniste IA qui ne rate plus aucun appel

**Le problème.** Un cabinet dentaire, un garage, un salon de coiffure ou un
plombier perd **20 à 40 % de ses appels** quand il est occupé. Chaque appel raté
= un rendez-vous ou un devis offert au concurrent. Les standards téléphoniques
classiques coûtent une fortune et ne comprennent ni le français local ni les
noms propres.

**La cible (internationale, facturable en €/$).** Artisans, cabinets (dentistes,
kinés, avocats), garages, salons, agences immobilières — **France, Belgique,
Suisse, Canada, et les mêmes métiers en Afrique francophone en deuxième vague**.

**Le produit (MVP).**
- On **détourne l'appel manqué** vers un numéro IA (ou l'appel direct).
- L'IA répond en français, prend le motif, **vérifie les disponibilités** et pose
  le rendez-vous dans l'agenda (Google Calendar / Doctolib-like).
- **Résumé structuré envoyé par SMS/WhatsApp au patron** : « Mme Diallo, nouvelle
  patiente, détartrage, jeudi 14 h — urgence dentaire signalée. »
- Tableau de bord : appels traités, RDV pris, chiffre d'affaires « sauvé ».

**Prix.** 49 €/mois (100 appels) · 99 €/mois (300 appels + multi-langue) · 199 €
(cabinets multi-sites). Setup 150 € une fois.

**Fossé.** Faible au départ → il faut le construire : intégrations verticales
(agenda métier, logiciel de caisse du garage) + **voix et vocabulaire local**
(accents, noms, rues). Un concurrent américain ne fera pas « Allô, cabinet
dentaire de Niamey ».

**Go-to-market 30 jours.** 30 appels sortants par jour vers des cabinets de
villes moyennes, avec **une démo en direct** : tu appelles ton propre numéro IA
pendant la conversation. C'est l'argument le plus fort qui existe dans ce métier.
Puis 1 000 € de Google Ads « standard téléphonique dentiste ».

**Vrai risque.** Qualité audio et latence (une mauvaise voix détruit la
confiance) → tester 3 fournisseurs de voix, viser < 800 ms + intéruption possible.
Et **la transparence** : l'IA doit dire qu'elle est une IA.

---

# 3. Tender — la veille des marchés publics, assistée par IA

**Le problème.** Chaque jour, des dizaines d'appels d'offres publics sortent au
Niger, au Sénégal, en Côte d'Ivoire, au Bénin… Les PME du BTP, de la fourniture
et des services les découvrent **trop tard**, ou jamais : les avis sont éparpillés
sur 20 sites, en PDF scannés, avec des délais de 10 jours.

**La cible.** PME du BTP, importateurs, sociétés de services, cabinets de
conseil — celles qui répondent déjà à 2-3 marchés par an et en ratent 20.

**Le produit (MVP).**
- **Agrégateur** de tous les portails publics UEMOA + journaux + bailleurs (BAD,
  Banque mondiale, PNUD).
- **Filtrage par profil** : secteur, zone, montant, type de marché (travaux /
  fournitures / services).
- **Résumé IA en 10 lignes** : objet, montant estimé, **dates limites**, pièces
  exigées, caution, critères d'attribution — et alerte WhatsApp/SMS J-7 et J-2.
- Plus tard : **assistant de dossier** (checklist des pièces, génération des
  lettres types, rappel des certifications fiscales).

**Prix.** 15 000 FCFA/mois (PME) · 40 000 FCFA/mois (veille + assistant dossier)
· 150 000 FCFA/mois ( cabinets et groupes, multi-utilisateurs).

**Fossé.** Le corpus : 3 ans d'avis, de résultats d'attribution et de prix
gagnés → « à quel prix se sont attribués les 40 marchés similaires cette année ? »
C'est une donnée que personne ne structure, et qui vaut très cher.

**Go-to-market 30 jours.** Publier **gratuitement** une newsletter quotidienne
« Les 5 marchés à ne pas rater cette semaine au Niger » sur LinkedIn + WhatsApp.
La liste de diffusion *est* le produit de vente. Puis facturer l'accès complet.

**Vrai risque.** Les portails changent, les PDF sont scannés → prévoir un humain
2 h/jour pour corriger l'IA, et ne jamais promettre l'exhaustivité : promettre
« les 20 marchés qui vous concernent ».

---

# 4. Médic — le stock des pharmacies qui ne dort plus

**Le problème.** Une officine de quartier gère 1 500 références. Ruptures sur les
molécules qui rapportent, **périmés découverts trop tard** (2 à 5 % du stock part
à la poubelle), et ruptures non anticipées chez les grossistes. Aujourd'hui : un
cahier, Excel, ou rien.

**La cible.** Officines privées (300+ au Niger, des milliers dans l'UEMOA),
cliniques et dépôts pharmaceutiques.

**Le produit (MVP).**
- **Inventaire par scan/photo** (code-barres ou nom commercial + dosage).
- **Alertes de péremption** à J-90, avec suggestion de promotion ou de transfert
  vers une officine sœur.
- **Prévision de commande** : « sur la base de vos 12 dernières semaines, commandez
  8 boîtes d'amoxicilline 500 — vous serez en rupture le 14. »
- **Traçabilité des lots** (obligation sanitaire) + registre des stupéfiants.

**Prix.** 15 000 FCFA/mois (mono-officine) · 45 000 FCFA (multi-officines +
traçabilité) · 1 % d'économie sur les périmés évités en option.

**Fossé.** Données de consommation + nomenclature locale des médicaments
(noms commerciaux, dosages, conditionnements) — un travail ingrat qui prend des
mois et que personne ne veut refaire.

**Go-to-market 30 jours.** Vendre **par le calcul** : on prend l'inventaire réel
d'une officine, on chiffre ses périmés de l'année. « Vous avez jeté 480 000 FCFA
cette année. Médic coûte 180 000. » Démonstration irréfutable.
Partenaires : grossistes répartiteurs (ils veulent écouler leurs stocks dormants).

**Vrai risque.** Adoption lente (personnel peu formé) et **réglementation
sanitaire** (données patients). Démarrer sans aucune donnée patient : uniquement
stock et lots.

---

# 5. Bulletin — paie et déclarations sociales pour les PME

**Le problème.** Une PME de 15 salariés à Niamey calcule la paie sur Excel,
imprime des bulletins, puis passe **2 à 5 jours par mois** sur les déclarations
CNSS et l'impôt sur les traitements et salaires. Erreurs = pénalités. Départs et
avances = chaos.

**La cible.** PME de 5 à 80 salariés : cabinets, ONG locales, écoles privées,
cliniques, entreprises de services — celles qui ont un comptable mais pas de SIRH.

**Le produit (MVP).**
- **Fiches salariés + contrats** (CDD/CDI, apprentis), congés et absences.
- **Calcul de paie conforme** (ITS, CNSS part salariale/patronale, primes,
  indemnités) → bulletins PDF envoyés par WhatsApp.
- **Déclarations pré-remplies** exportables + échéancier de paiement ; ordre de
  virement mobile money pour les salariés non bancarisés.

**Prix.** 10 000 FCFA/mois (jusqu'à 10 salariés) · 25 000 FCFA (jusqu'à 40) ·
60 000 FCFA (80 salariés). Setup 25 000 FCFA (reprise des données).

**Fossé.** Très fort : une fois la paie dans l'outil, personne ne déménage en
milieu d'année. Et le **moteur de règles** (barèmes, taux, plafonds) est un actif
par pays — Niger, Sénégal, Côte d'Ivoire, Bénin : 4 pays, 4 moteurs, un seul
produit.

**Go-to-market 30 jours.** **Vendre aux comptables, pas aux patrons** : ils gèrent
10 à 30 PME chacun et détestent la paie manuelle. Un cabinet = 20 clients.
Objectif : 3 cabinets partenaires + 15 PME.

**Vrai risque.** Le seul vrai risque : **se tromper sur un barème** (une erreur
de paie coûte très cher en confiance). Parade : double validation + relecture par
un expert-comptable partenaire, et une mise à jour réglementaire documentée à
chaque loi de finances.

---

# 6. Vitrine — la présence Google et les avis, automatisés

**Le problème.** Un restaurant, un garage, une clinique existe sur Google Maps
avec 3 photos floues, un horaire faux et 4 avis. Résultat : invisible dans les
recherches « près de moi ». Les agences facturent 300 €/mois pour le faire à la
main et le font mal.

**La cible.** **Agences marketing et freelances** (revendeurs) qui gèrent 20 à
200 clients locaux — en France, en Belgique, au Maghreb, en Afrique francophone.

**Le produit (MVP).**
- **Connexion d'une fiche Google Business** en 3 clics (OAuth).
- **Publications programmées** (offres, photos, événements) sur toutes les fiches
  depuis un seul tableau.
- **Collecte d'avis automatisée** : après un rendez-vous/paiement, SMS ou
  WhatsApp avec un lien direct → +40 % d'avis, réponse IA aux avis en 1 clic.
- **Rapport client mensuel** en marque blanche : vues, appels, itinéraires, avis.

**Prix.** 29 €/mois par lot de 10 fiches · 79 € (50 fiches) · white-label 199 €.
**Le prix se vend à l'agence, qui le refacture 3× à ses clients.**

**Fossé.** Faible techniquement → le fossé est **la distribution** : devenir
l'outil par défaut des agences francophones (elles ne changent pas d'outil en
pleine gestion de 80 fiches). C'est le plus « copiable » de la liste : à ne faire
que si tu sais vendre à des agences.

**Go-to-market 30 jours.** 100 messages LinkedIn à des agences + offre « je gère
gratuitement vos 5 fiches pendant 14 jours, je vous montre le rapport ». Le
rapport en marque blanche est l'argument de vente (elles le revendent).

**Vrai risque.** Dépendance à l'API Google (quotas, coûts) et concurrence
nombreuse (BrightLocal, Localo) → il faut un angle : **WhatsApp-first** (les PME
africaines n'ont pas d'email, elles ont WhatsApp).

---

## Si je devais en choisir une, et pourquoi

- **Tu veux un actif local difficile à copier** → **Karité**. La donnée de crédit
  et le réseau de quartier se construisent lentement, donc se défendent longtemps.
- **Tu veux du revenu en euros sans dépendre du marché nigérien** → **Standard**.
  Ticket élevé, douleur mesurable (appel manqué = argent perdu), et une démo qui
  se vend toute seule au téléphone.
- **Tu veux de la marge logicielle pure et de la donnée revendable** → **Tender**.
  Zéro logistique, client qui renouvelle tant qu'il répond à des marchés.

## Trois questions à te poser avant de coder

1. **Puis-je parler à 10 clients cette semaine ?** Si non → l'idée est morte,
   quel que soit le produit.
2. **Le client perd-il de l'argent chaque semaine sans moi ?** Si c'est « ce serait
   bien », le churn te tuera.
3. **Que s'accumule-t-il chez moi que le client ne peut pas emporter ailleurs ?**
   Dettes, historique de paie, corpus d'appels d'offres… sans cela, tu vends un
   logiciel, pas un SaaS.
