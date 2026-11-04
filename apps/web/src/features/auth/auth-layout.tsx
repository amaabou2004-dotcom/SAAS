import { BarChart3, Check, PackageCheck, ShieldCheck, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/brand';
import { legalInfo, legalLinks } from '../legal/legal-info';

const features = [
  { icon: PackageCheck, label: 'Un stock unique, toujours traçable' },
  { icon: Store, label: 'Vos boutiques physiques et en ligne réunies' },
  { icon: BarChart3, label: 'Vos rapports quotidiens, où que vous soyez' },
];

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ eyebrow, title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(400px,1.02fr)_minmax(520px,1fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col xl:px-20 xl:py-12">
        <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-36 top-1/3 size-[420px] rounded-full bg-teal-400/10 blur-3xl" aria-hidden="true" />
        <Brand inverse className="relative z-10" />

        <div className="relative z-10 my-auto max-w-xl py-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-teal-200">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Votre activité mérite un espace fiable
          </div>
          <h1 className="max-w-lg text-4xl font-bold leading-[1.14] tracking-[-0.035em] xl:text-[46px]">
            Votre commerce,
            <br />
            <span className="text-teal-300">clairement.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
            Pilotez vos produits, vos ventes et vos boutiques depuis un seul espace, sans perdre le fil de votre activité.
          </p>
          <ul className="mt-10 space-y-5">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3.5 text-sm text-slate-200">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-teal-300">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs leading-5 text-slate-400">
          Vos données sont isolées par entreprise et protégées par des règles d’accès strictes.
        </p>
      </section>

      <section className="flex min-h-screen flex-col bg-white px-5 py-6 sm:px-10 lg:px-14 xl:px-24">
        <Brand className="mb-12 lg:hidden" />
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-4">
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">{eyebrow}</p>
            <h2 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[34px]">{title}</h2>
            <p className="mt-3 text-[15px] leading-6 text-slate-600">{description}</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-mint-dark">
              <Check className="size-3.5" aria-hidden="true" />
              Gratuit : toutes les fonctions, sans carte bancaire
            </p>
          </div>
          {children}
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
        <div className="mx-auto mt-8 max-w-[440px] text-center text-[11px] leading-5 text-slate-400">
          <p>En continuant, vous utilisez un espace sécurisé. Ne communiquez jamais votre mot de passe ou votre code de vérification.</p>
          <nav aria-label="Informations légales" className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {legalLinks.map(({ to, label }) => (
              <Link key={to} to={to} className="font-semibold text-slate-500 hover:text-mint-dark hover:underline">
                {label}
              </Link>
            ))}
          </nav>
          <p className="mt-2">
            © {new Date().getFullYear()} {legalInfo.brand} — Édité par {legalInfo.publisher}
          </p>
        </div>
      </section>
    </main>
  );
}
