import { useId, type ReactNode } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  'aria-required': true | undefined;
}

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
  id?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label + hint + error wrapper that wires up the accessibility attributes for any control
 * (input, select, textarea) passed as a render function.
 */
export function Field({ label, error, hint, required, id, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={controlId} className="block text-sm font-medium text-fg">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        )}
      </label>
      {children({
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
        'aria-required': required ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const controlClasses =
  'block w-full rounded-lg border border-border bg-surface px-3 text-base text-fg ' +
  'placeholder:text-fg-muted/70 transition-colors ' +
  'focus-visible:border-primary aria-[invalid=true]:border-danger disabled:opacity-60';
