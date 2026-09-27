import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { controlClasses, Field } from './Field';

interface TextAreaFieldProps extends Omit<ComponentProps<'textarea'>, 'required'> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  id,
  className,
  rows = 3,
  ...props
}: TextAreaFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      {(control) => (
        <textarea
          {...control}
          rows={rows}
          className={cn(controlClasses, 'py-2.5', className)}
          {...props}
        />
      )}
    </Field>
  );
}
