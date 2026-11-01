import type { InputHTMLAttributes, ReactNode } from 'react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  trailing?: ReactNode;
}

export function FormField({ label, id, error, trailing, className, ...props }: FormFieldProps) {
  const fieldId = id ?? props.name;
  const errorId = `${fieldId}-error`;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label htmlFor={fieldId}>{label}</Label>
        {trailing}
      </div>
      <Input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
