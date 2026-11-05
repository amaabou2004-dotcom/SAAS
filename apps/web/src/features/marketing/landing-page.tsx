import {
  ArrowRight,
  BarChart3,
  Check,
  Globe2,
  MessageCircle,
  PackageCheck,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/brand';
import { SiteFooter } from '../../components/site-footer';
import { legalInfo } from '../legal/legal-info';

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

const features: Feature[] = [
  {
    icon: PackageCheck,
    title: 'Stock toujours juste',
    text: 'Produits, catégories, dépôts et mouvements : le stock disponible se recalcule tout seul à chaque réception, vente ou transfert.',
  },
  {
    icon: Receipt,
    title: 'Ventes et caisse rapide',
    text: 'Encaissez en quelques touchers, prix négocié accepté, ticket numéroté, reçu envoyé sur WhatsApp, annulation tracée.',
  },
  {
    icon: Store,
    title: 'Boutique en ligne prête à partager',
    text: 'Un lien à envoyer sur WhatsApp : vos clients voient le catalogue, passent commande, puis suivent leur commande avec son numéro.',
  },
  {
    icon: Wallet,
    title: 'Crédits clients suivis',
    text: 'Reste à payer, règlements partiels en espèces ou Mobile Money : vous savez à tout moment qui doit quoi.',
  },
  {
    icon: BarChart3,
    title: 'Rapports clairs',
    text: 'Chiffre d’affaires, marge, meilleurs produits, produits dormants, export CSV : vos chiffres du jour en un écran.',
  },
  {
    icon: Users,
    title: 'Équipe et rôles',
    text: 'Invitez vos collaborateurs, donnez à chacun le rôle adapté et gardez la main sur ce qui est visible ou modifiable.',
  },
];

const steps = [
  {
    title: 'Créez votre compte',
    text: 'Une adresse e-mail suffit. Vous pouvez aussi vous connecter avec Google.',
  },
  {
    title: 'Décrivez votre entreprise',
    text: 'Nom, adresse de boutique et devise : votre espace est prêt en une minute.',
  },
  {
    title: 'Ajoutez vos produits et vendez',
    text: 'Saisissez vos articles, votre stock, puis encaissez ou partagez votre boutique.',
  },
];

const trustPoints = [
  'Chaque entreprise est isolée : personne ne voit les données d’une autre.',
  'Échanges chiffrés (HTTPS) et mots de passe jamais stockés en clair.',
  'Pas de publicité, pas de revente de données, pas de traceur publicitaire.',
  'Aucune donnée bancaire demandée : Stokari est gratuit, sans commission.',
];

/**
 * Page d'accueil publique.
 *
 * Elle présente le service aux visiteurs non connectés — et sert de « home page »
 * lisible par les robots (Google, moteurs de recherche) : l'ancienne redirection
 * directe vers l'écran de connexion ne décrivait nulle part ce qu'est Stokari.
 */
export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Brand />
          <nav aria-label="Navigation principale" className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#fonctionnalites" className="hover:text-mint-dark">Fonctionnalités</a>
            <a href="#comment-ca-marche" className="hover:text-mint-dark">Comment ça marche</a>
            <a href="#confiance" className="hover:text-mint-dark">Vos données</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth/connexion"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-100"
            >
              Se connecter
            </Link>
            <Link
              to="/auth/inscription"
              className="inline-flex items-center gap-1.5 rounded-xl bg-mint px-3.5 py-2 text-sm font-semibold text-white hover:bg-mint-dark"
            >
              Créer mon espace
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-ink text-white">
          <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-40 top-1/4 size-[480px] rounded-full bg-teal-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-teal-200">
                <Store className="size-4" aria-hidden="true" />
                Gestion de stock, ventes et boutique en ligne
              </p>
              <h1 className="mt-6 max-w-xl text-4xl font-bold leading-[1.1] tracking-[-0.035em] sm:text-5xl">
                Votre commerce,
                <br />
                <span className="text-teal-300">clairement.</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
                {legalInfo.brand} réunit vos produits, votre stock, vos ventes et votre boutique en
                ligne dans un seul espace simple, en français, sur téléphone comme sur ordinateur.
                Gratuit, sans carte bancaire.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth/inscription"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-6 py-3.5 text-sm font-bold text-white hover:bg-mint-dark"
                >
                  Créer mon espace gratuitement
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/auth/connexion"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10"
                >
                  J’ai déjà un compte
                </Link>
              </div>
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-teal-300" aria-hidden="true" />
                  Toutes les fonctions, sans limite
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-teal-300" aria-hidden="true" />
                  Aucune carte bancaire
                </span>
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur sm:p-8">
              <p className="text-xs font-bold tracking-[0.16em] text-teal-200 uppercase">
                Dans votre espace
              </p>
              <ul className="mt-5 space-y-4">
                {[
                  'Un stock unique, traçable mouvement par mouvement',
                  'Des ventes encaissées en espèces, Mobile Money ou à crédit',
                  'Une boutique publique à partager sur WhatsApp',
                  'Les chiffres du jour dès l’ouverture',
                  'Les commandes reçues, prêtes à être confirmées',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal-400/20 text-teal-200">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-400">
                <Smartphone className="size-4 text-teal-300" aria-hidden="true" />
                S’installe sur l’écran d’accueil du téléphone, comme une application.
              </p>
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.16em] text-mint-dark uppercase">Fonctionnalités</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
              Tout ce qu’il faut pour tenir votre commerce
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Pas de tableur à bricoler, pas de logiciel compliqué : les gestes du quotidien d’un
              commerçant, réunis au même endroit.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-mint-dark">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="comment-ca-marche" className="scroll-mt-20 border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-[0.16em] text-mint-dark uppercase">Comment ça marche</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
                Trois étapes, une seule fois
              </h2>
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-slate-200 bg-canvas p-6">
                  <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 flex items-center gap-2 text-sm text-slate-600">
              <Globe2 className="size-4 text-mint-dark" aria-hidden="true" />
              Votre boutique publique s’ouvre à l’adresse{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-ink">/b/votre-boutique</code>
              — sans compte pour vos clients.
            </p>
          </div>
        </section>

        <section id="confiance" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-mint-dark uppercase">Vos données</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
                Un espace sérieux, sans mauvaise surprise
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                Vous nous confiez les informations de votre activité. Elles restent votre propriété
                et servent uniquement à faire fonctionner votre commerce.
              </p>
              <p className="mt-4 text-[15px] leading-7 text-slate-600">
                Les détails complets figurent dans la{' '}
                <Link to="/confidentialite" className="font-semibold text-mint-dark hover:underline">
                  politique de confidentialité
                </Link>{' '}
                et les{' '}
                <Link to="/conditions" className="font-semibold text-mint-dark hover:underline">
                  conditions générales
                </Link>
                .
              </p>
            </div>
            <ul className="space-y-3">
              {trustPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-[14px] leading-6 text-slate-700"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-teal-50 text-mint-dark">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-ink">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-14 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                Prêt à reprendre la main sur votre stock ?
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Ouvert en quelques secondes, gratuit, sans engagement. Une question ?{' '}
                <a
                  href={legalInfo.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-teal-200 hover:underline"
                >
                  WhatsApp {legalInfo.phone}
                </a>
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth/inscription"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-6 py-3.5 text-sm font-bold text-white hover:bg-mint-dark"
              >
                Créer mon espace
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href={legalInfo.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Poser une question
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
