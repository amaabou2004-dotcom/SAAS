import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-ink shadow-[0_1px_2px_rgba(16,42,67,0.03)] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-mint focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 aria-invalid:border-red-400 aria-invalid:ring-red-100',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
