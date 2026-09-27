import type { ComponentProps, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { controlClasses, Field } from './Field';

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'required'> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({
  label,
  error,
  hint,
  required,
  id,
  className,
  options,
  placeholder,
  ...props
}: SelectFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      {(control) => (
        <div className="relative">
          <select
            {...control}
            className={cn(controlClasses, 'h-11 appearance-none pr-10', className)}
            {...props}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
          />
        </div>
      )}
    </Field>
  );
}
