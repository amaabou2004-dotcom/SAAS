import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { legalInfo, legalLinks } from '../features/legal/legal-info';
import { cn } from '../lib/utils';

interface SiteFooterProps {
  /** Version resserrée, utilisée sous les écrans de l'espace de travail. */
  compact?: boolean;
  className?: string;
}

/**
 * Pied de page commun : il signe le site (éditeur) et donne accès aux
 * documents officiels depuis n'importe quel écran.
 */
export function SiteFooter({ compact = false, className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'border-t border-slate-200 bg-white',
        compact ? 'mt-8 px-5 py-5 text-xs sm:px-8' : 'px-5 py-8 text-sm',
        className,
      )}
    >
      <div className={cn('mx-auto flex flex-col gap-3', compact ? 'max-w-7xl' : 'max-w-5xl')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-bold text-ink">{legalInfo.brand}</span>
          <nav aria-label="Informations légales" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600">
            {legalLinks.map(({ to, label }) => (
              <Link key={to} to={to} className="hover:text-mint-dark hover:underline">
                {label}
              </Link>
            ))}
            <a
              href={legalInfo.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-mint-dark hover:underline"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Nous écrire
            </a>
          </nav>
        </div>
        <p className="leading-6 text-slate-500">
          © {year} {legalInfo.brand} — Édité par{' '}
          <strong className="font-semibold text-slate-700">{legalInfo.publisher}</strong>, {legalInfo.country}.
        </p>
      </div>
    </footer>
  );
}
