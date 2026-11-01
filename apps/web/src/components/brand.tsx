import { Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Brand({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300', className)}
      aria-label="SaaS Commerce — Accueil"
    >
      <span
        className={cn(
          'grid size-10 place-items-center rounded-xl',
          inverse ? 'bg-white text-ink' : 'bg-ink text-white',
        )}
      >
        <Store className="size-5" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className={cn('block text-[15px] font-bold tracking-tight', inverse ? 'text-white' : 'text-ink')}>
          SaaS Commerce
        </span>
        <span className={cn('block text-[11px] font-medium tracking-wide', inverse ? 'text-slate-300' : 'text-slate-500')}>
          GESTION & VENTE EN LIGNE
        </span>
      </span>
    </Link>
  );
}
