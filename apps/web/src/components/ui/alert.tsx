import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const styles = {
  info: {
    className: 'border-sky-200 bg-sky-50 text-sky-900',
    Icon: Info,
  },
  success: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    Icon: CheckCircle2,
  },
  warning: {
    className: 'border-amber-200 bg-amber-50 text-amber-950',
    Icon: TriangleAlert,
  },
  error: {
    className: 'border-red-200 bg-red-50 text-red-900',
    Icon: AlertCircle,
  },
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof styles;
}

export function Alert({ tone = 'info', className, children, ...props }: AlertProps) {
  const { className: toneClassName, Icon } = styles[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-3.5 text-sm leading-5', toneClassName, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
