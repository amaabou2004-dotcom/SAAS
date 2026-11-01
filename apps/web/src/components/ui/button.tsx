import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        default: 'bg-ink text-white shadow-sm hover:bg-[#173f5f] active:bg-[#0b2135]',
        mint: 'bg-mint text-white shadow-sm hover:bg-mint-dark',
        outline: 'border border-slate-300 bg-white text-ink hover:border-slate-400 hover:bg-slate-50',
        ghost: 'text-ink-soft hover:bg-slate-100 hover:text-ink',
        link: 'min-h-0 rounded-none px-0 py-0 text-mint-dark underline-offset-4 hover:underline',
      },
      size: {
        default: '',
        sm: 'min-h-9 rounded-lg px-3 text-xs',
        lg: 'min-h-12 px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Comp>
  );
}
