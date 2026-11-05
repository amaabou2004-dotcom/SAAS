import { ArrowLeft, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/brand';
import { SiteFooter } from '../../components/site-footer';
import { usePageViewTracking } from '../audience/use-page-view';
import { legalInfo } from './legal-info';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-7 text-slate-700">{children}</div>
    </section>
  );
}

function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  // Les documents publics font partie des pages mesurées.
  usePageViewTracking();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4">
          <Brand />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-mint-dark"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-10">
        <p className="text-xs font-bold tracking-wide text-mint-dark uppercase">{legalInfo.brand}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">{intro}</p>
        <p className="mt-2 text-xs text-slate-500">Dernière mise à jour : {legalInfo.updatedAt}</p>

        {children}

        <div className="mt-10 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="font-semibold text-ink">Une question sur ce document ?</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Écrivez-nous : nous répondons du lundi au samedi.
          </p>
          <a
            href={legalInfo.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2.5 text-sm font-semibold text-white hover:bg-mint-dark"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            WhatsApp {legalInfo.phone}
          </a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function LegalNoticePage() {
  return (
    <LegalLayout
      title="Mentions légales"
      intro={`${legalInfo.brand} est un service de gestion de stock, de ventes et de boutique en ligne destiné aux commerçants. Cette page indique qui édite le service et comment le joindre.`}
    >
      <Section title="1. Éditeur du service">
        <p>
          Le service <strong>{legalInfo.brand}</strong> est édité par{' '}
          <strong>{legalInfo.publisher}</strong>, établi au {legalInfo.country}.
        </p>
        <p>
          {legalInfo.publisher} assure également la fonction de{' '}
          {legalInfo.publisherRole.charAt(0).toLowerCase() + legalInfo.publisherRole.slice(1)}.
        </p>
      </Section>

      <Section title="2. Contact">
        <p>
          Pour toute question, réclamation ou demande relative à vos données, contactez-nous par
          WhatsApp au <strong>{legalInfo.phone}</strong>
          {legalInfo.email ? (
            <>
              {' '}
              ou par e-mail à <strong>{legalInfo.email}</strong>.
            </>
          ) : (
            '.'
          )}
        </p>
        <p>Les demandes sont traitées sous 72 heures ouvrées.</p>
      </Section>

      <Section title="3. Objet du service">
        <p>
          {legalInfo.brand} permet à un commerçant de tenir ses produits, son stock, ses ventes et ses
          rapports, et d’ouvrir une boutique en ligne consultable par ses clients. Le service est
          accessible depuis un navigateur, sur ordinateur comme sur téléphone.
        </p>
      </Section>

      <Section title="4. Hébergement et sécurité">
        <p>
          Le service est hébergé sur une infrastructure cloud professionnelle. Les échanges entre
          votre navigateur et {legalInfo.brand} sont chiffrés (HTTPS). Les données de chaque
          entreprise sont isolées des autres par des règles d’accès appliquées côté serveur.
        </p>
      </Section>

      <Section title="5. Propriété intellectuelle">
        <p>
          Le nom {legalInfo.brand}, son logo, ses textes, ses écrans et son code sont la propriété de
          leur éditeur. Toute reproduction ou adaptation sans autorisation écrite est interdite.
        </p>
        <p>
          Les produits, photos, prix et textes saisis par un commerçant restent sa propriété. Il en
          conserve la responsabilité et autorise seulement leur affichage dans son espace et, s’il
          l’active, dans sa boutique en ligne.
        </p>
      </Section>

      <Section title="6. Responsabilité">
        <p>
          L’éditeur met en œuvre les moyens raisonnables pour assurer un service disponible et
          exact. Il ne peut toutefois être tenu responsable des décisions commerciales prises à
          partir des informations saisies par le commerçant, ni d’une interruption due à un
          prestataire technique, à une panne de réseau ou à un cas de force majeure.
        </p>
        <p>
          Le commerçant reste seul responsable des prix, du stock, des descriptions et des
          engagements qu’il publie, ainsi que du respect des règles applicables à son activité.
        </p>
      </Section>

      <Section title="7. Droit applicable">
        <p>
          Les présentes mentions sont soumises au droit nigérien. En cas de difficulté, nous vous
          invitons à nous écrire d’abord : une solution amiable est presque toujours possible. À
          défaut d’accord, les tribunaux compétents du {legalInfo.country} sont seuls saisis.
        </p>
      </Section>
    </LegalLayout>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      intro={`Cette page explique quelles informations ${legalInfo.brand} enregistre, pourquoi, combien de temps, et comment vous pouvez les consulter, les corriger ou les supprimer.`}
    >
      <Section title="1. Qui traite vos données">
        <p>
          Le responsable du traitement est <strong>{legalInfo.publisher}</strong>, éditeur de{' '}
          {legalInfo.brand}, {legalInfo.country}. Chaque entreprise cliente reste
          responsable des données de ses propres clients qu’elle saisit dans le service.
        </p>
      </Section>

      <Section title="2. Les informations que nous enregistrons">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Votre compte</strong> : adresse e-mail, mot de passe (conservé sous forme
            chiffrée, jamais lisible par nous), date de création.
          </li>
          <li>
            <strong>Si vous utilisez Google pour vous connecter</strong> : adresse e-mail, nom,
            photo de profil et identifiant technique du compte Google — voir la section 3.
          </li>
          <li>
            <strong>Votre entreprise</strong> : nom, adresse de boutique, devise, fuseau horaire,
            coordonnées de contact.
          </li>
          <li>
            <strong>Votre activité</strong> : produits, photos, catégories, dépôts, mouvements de
            stock, ventes, dépenses et rapports.
          </li>
          <li>
            <strong>Vos clients</strong> : nom, numéro de téléphone et note que vous saisissez
            vous-même, ainsi que les commandes passées sur votre boutique en ligne.
          </li>
          <li>
            <strong>La consultation de la boutique</strong> : nom de la boutique, produits consultés
            et commande envoyée, sans création de compte client.
          </li>
        </ul>
        <p>
          Nous ne demandons ni ne stockons de données bancaires : {legalInfo.brand} est gratuit et
          n’encaisse aucun paiement.
        </p>
      </Section>

      <Section title="3. Connexion avec un compte Google">
        <p>
          Vous pouvez créer votre compte ou vous connecter avec votre compte Google, sans mot de
          passe à retenir. Dans ce cas, Google nous transmet uniquement votre adresse e-mail, votre
          nom, l’adresse de votre photo de profil et un identifiant technique de votre compte
          Google. Nous n’accédons ni à vos messages Gmail, ni à vos fichiers Drive, ni à vos
          contacts, ni à aucune autre donnée Google.
        </p>
        <p>
          Ces informations servent seulement à créer et sécuriser votre compte : elles ne sont ni
          analysées à des fins publicitaires, ni revendues, ni transmises à d’autres personnes.
          L’identifiant Google et la photo de profil ne sont utilisés que pour vous reconnaître à la
          connexion et afficher vos initiales, et sont conservés tant que votre compte existe. Si
          vous préférez ne pas passer par Google, l’inscription par e-mail et mot de passe donne
          exactement les mêmes fonctions.
        </p>
        <p>
          Vous pouvez retirer l’accès de {legalInfo.brand} à votre compte Google à tout moment
          depuis la page « Applications tierces » de votre compte Google, ou en nous demandant la
          suppression de votre compte : l’accès est alors supprimé et les informations de connexion
          associées sont effacées.
        </p>
      </Section>

      <Section title="4. Pourquoi nous les utilisons">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>créer et sécuriser votre compte, vous connecter et vous reconnaître ;</li>
          <li>faire fonctionner votre stock, vos ventes, vos rapports et votre boutique ;</li>
          <li>vous envoyer les messages indispensables : vérification de l’adresse, réinitialisation du mot de passe, alerte de commande ;</li>
          <li>répondre à vos demandes d’assistance ;</li>
          <li>prévenir la fraude et les usages abusifs.</li>
        </ul>
        <p>
          Nous n’utilisons jamais vos données pour de la publicité et nous ne les vendons à
          personne.
        </p>
      </Section>

      <Section title="5. Qui peut les voir">
        <p>
          Vos données sont visibles par vous et par les personnes que vous invitez dans votre
          entreprise, selon le rôle que vous leur donnez. Chaque entreprise est isolée : aucun
          commerçant ne peut voir les données d’un autre.
        </p>
        <p>
          Les informations que vous publiez dans votre boutique en ligne (nom des produits, prix,
          photos, disponibilité) sont publiques par nature. Votre numéro WhatsApp n’apparaît que si
          vous choisissez de l’afficher.
        </p>
        <p>
          Nos prestataires techniques (hébergement, base de données, envoi des e-mails
          transactionnels) accèdent aux données uniquement pour faire fonctionner le service, dans
          le cadre d’un engagement de confidentialité. Nous ne partageons rien d’autre, sauf
          obligation légale.
        </p>
      </Section>

      <Section title="6. Combien de temps nous les gardons">
        <p>
          Les données de votre entreprise sont conservées tant que votre compte existe. Si vous
          supprimez votre compte, elles sont effacées dans un délai de 30 jours, à l’exception de ce
          que la loi nous oblige à conserver plus longtemps (par exemple les pièces comptables).
        </p>
        <p>
          Les commandes envoyées depuis une boutique sont conservées le temps nécessaire au suivi,
          puis supprimées avec les données de l’entreprise concernée.
        </p>
      </Section>

      <Section title="7. Cookies et mesure d’audience">
        <p>
          {legalInfo.brand} n’utilise que des cookies strictement nécessaires : ils gardent votre
          session ouverte et mémorisent vos préférences d’affichage. Aucun cookie publicitaire,
          aucun traceur de réseau social et aucun outil de mesure d’audience tiers n’est installé.
        </p>
        <p>
          Pour savoir combien de personnes consultent les pages publiques (accueil, boutiques
          partagées, documents légaux), nous tenons un comptage interne, agrégé et anonyme. Il ne
          dépose aucun cookie, ne conserve aucune adresse IP et ne construit aucun profil de
          visiteur : une empreinte technique calculée pour la journée en cours permet simplement de
          ne pas compter deux fois la même personne le même jour, puis elle change le lendemain.
          Seuls des totaux (nombre de visiteurs et de pages vues par jour) sont conservés, et ces
          chiffres ne sont visibles que par l’éditeur du service. Aucune donnée de ce comptage n’est
          vendue ni transmise à un tiers.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Les échanges sont chiffrés (HTTPS). L’accès aux données est contrôlé entreprise par
          entreprise et rôle par rôle, directement côté serveur. Les mots de passe ne sont jamais
          stockés en clair. En cas d’incident de sécurité susceptible d’affecter vos données, nous
          vous informons sans délai injustifié.
        </p>
      </Section>

      <Section title="9. Vos droits">
        <p>
          Vous pouvez à tout moment demander à consulter, corriger, exporter ou supprimer vos
          données, et vous opposer à un traitement. Écrivez-nous au{' '}
          <strong>{legalInfo.phone}</strong>
          {legalInfo.email ? (
            <>
              {' '}
              ou à <strong>{legalInfo.email}</strong>
            </>
          ) : null}
          : nous répondons sous 72 heures ouvrées.
        </p>
        <p>
          La plupart de ces actions sont aussi disponibles directement dans l’application :
          modification de vos informations, export de vos rapports, suppression de vos produits et
          de vos clients.
        </p>
      </Section>

      <Section title="10. Enfants">
        <p>
          Le service est destiné à des personnes majeures exerçant une activité commerciale. Il
          n’est pas conçu pour les enfants et nous ne collectons pas sciemment leurs données.
        </p>
      </Section>

      <Section title="11. Modifications">
        <p>
          Si cette politique évolue, la nouvelle version est publiée sur cette page avec sa date de
          mise à jour. Les changements importants sont signalés dans l’application.
        </p>
      </Section>
    </LegalLayout>
  );
}


export function TermsPage() {
  return (
    <LegalLayout
      title="Conditions générales"
      intro={`Ces conditions encadrent l’utilisation de ${legalInfo.brand}. Elles sont écrites en mots simples : prenez le temps de les lire avant de créer votre espace.`}
    >
      <Section title="1. Accepter ces conditions">
        <p>
          En créant un compte ou en utilisant {legalInfo.brand}, vous acceptez ces conditions. Si
          vous ne les acceptez pas, il ne faut pas utiliser le service.
        </p>
        <p>
          Vous confirmez être majeur et disposer du droit d’agir pour l’entreprise que vous
          enregistrez.
        </p>
      </Section>

      <Section title="2. Un service gratuit">
        <p>
          {legalInfo.brand} est actuellement <strong>entièrement gratuit</strong> : toutes les
          fonctions sont accessibles sans carte bancaire, sans abonnement et sans commission sur vos
          ventes.
        </p>
        <p>
          De nouvelles options payantes pourraient apparaître un jour. Elles resteraient
          facultatives et ne s’appliqueraient jamais rétroactivement à un usage déjà en cours sans
          votre accord.
        </p>
      </Section>

      <Section title="3. Votre compte">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Donnez des informations exactes et tenez-les à jour.</li>
          <li>Choisissez un mot de passe solide et gardez-le secret : vous êtes responsable des actions faites depuis votre compte.</li>
          <li>N’ouvrez un accès à vos collaborateurs qu’avec un rôle adapté, et retirez-le dès que l’accès n’est plus nécessaire.</li>
          <li>Prévenez-nous immédiatement si vous pensez que votre compte a été utilisé sans votre accord.</li>
        </ul>
      </Section>

      <Section title="4. Ce que vous pouvez publier">
        <p>
          Vous restez propriétaire des contenus que vous saisissez. Vous nous autorisez seulement à
          les stocker et à les afficher pour faire fonctionner votre espace et, si vous l’activez,
          votre boutique en ligne.
        </p>
        <p>Il est interdit de publier ou de vendre :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>des produits dont la vente est interdite par la loi ;</li>
          <li>des contenus contrefaits, trompeurs ou dangereux ;</li>
          <li>des textes ou images injurieux, violents ou portant atteinte aux droits d’autrui ;</li>
          <li>des données de tiers sans leur accord.</li>
        </ul>
        <p>
          Vous êtes seul responsable du respect des obligations liées à votre activité : prix
          affichés, informations clients, facturation, taxes et obligations comptables.
        </p>
      </Section>

      <Section title="5. Votre boutique en ligne et les commandes">
        <p>
          Une commande envoyée depuis votre boutique est une demande du client : vous la confirmez,
          vous livrez, vous encaissez. {legalInfo.brand} n’est pas vendeur et n’est pas partie à la
          vente conclue entre vous et votre client.
        </p>
        <p>
          Les prix, la disponibilité et les délais affichés dépendent des informations que vous
          saisissez. Pensez à mettre votre stock à jour : un produit à zéro apparaît en rupture.
        </p>
        <p>
          Le paiement se fait directement entre vous et votre client, en dehors de la plateforme.
          Aucun moyen de paiement n’est demandé au client sur {legalInfo.brand}.
        </p>
      </Section>

      <Section title="6. Disponibilité et évolutions">
        <p>
          Nous améliorons le service en continu : des fonctions peuvent être ajoutées, modifiées ou
          retirées. Une maintenance planifiée peut interrompre l’accès quelques minutes ; nous
          cherchons alors à la placer en dehors de vos heures d’activité.
        </p>
        <p>
          Le service est fourni « en l’état ». Nous ne garantissons pas une disponibilité continue
          ni l’absence d’erreur, mais nous mettons tout en œuvre pour les corriger rapidement.
        </p>
      </Section>

      <Section title="7. Limites de responsabilité">
        <p>
          Nous ne pouvons pas être tenus responsables des pertes indirectes, de la perte de
          bénéfices ou d’une perte de clientèle liées à l’utilisation du service, à une interruption
          ou à un défaut de connexion Internet. Il vous appartient de conserver vos propres
          justificatifs comptables.
        </p>
      </Section>

      <Section title="8. Suspension et fermeture">
        <p>
          Un compte peut être suspendu en cas de fraude, d’usage abusif, de non-respect de ces
          conditions ou d’atteinte à la sécurité du service. Nous vous en informons dans la mesure
          du possible, afin de vous laisser récupérer vos informations.
        </p>
        <p>
          Vous pouvez arrêter à tout moment : demandez la suppression de votre compte par WhatsApp.
          Vos données sont alors effacées dans les conditions décrites dans la politique de
          confidentialité.
        </p>
      </Section>

      <Section title="9. Droit applicable et litiges">
        <p>
          Ces conditions sont soumises au droit nigérien. Avant toute action, écrivez-nous : nous
          cherchons d’abord une solution amiable. À défaut, les tribunaux compétents de{' '}
          {legalInfo.country} sont saisis.
        </p>
      </Section>

      <Section title="10. Nous contacter">
        <p>
          Éditeur : <strong>{legalInfo.publisher}</strong> — {legalInfo.country}.
          WhatsApp : <strong>{legalInfo.phone}</strong>
          {legalInfo.email ? (
            <>
              {' '}
              — e-mail : <strong>{legalInfo.email}</strong>
            </>
          ) : null}
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
