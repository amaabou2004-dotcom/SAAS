import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Brand({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300',
        inverse && 'bg-white px-4 py-3 shadow-sm',
        className,
      )}
      aria-label="Stokari — Accueil"
    >
      <img
        src="/stokari-logo.png"
        alt="Stokari — Gestion de stock"
        width={964}
        height={252}
        className={cn('block h-auto w-44', inverse && 'w-52')}
      />
    </Link>
  );
}
