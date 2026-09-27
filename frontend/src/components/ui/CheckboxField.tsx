import { useId, type ComponentProps, type ReactNode } from 'react';

interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode;
  error?: string | undefined;
}

export function CheckboxField({ label, error, id, ...props }: CheckboxFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-5 shrink-0 rounded border-border accent-primary"
          {...props}
        />
        <label htmlFor={inputId} className="text-sm text-fg">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
