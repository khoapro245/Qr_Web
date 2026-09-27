import { useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/cn';
import { controlClasses, Field } from './Field';

interface TextFieldProps extends Omit<ComponentProps<'input'>, 'required'> {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  required?: boolean;
}

export function TextField({
  label,
  error,
  hint,
  required,
  id,
  className,
  ...props
}: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      {(control) => (
        <input {...control} className={cn(controlClasses, 'h-11', className)} {...props} />
      )}
    </Field>
  );
}

/** Password input with an accessible show/hide toggle. */
export function PasswordField({
  label,
  error,
  hint,
  required,
  id,
  className,
  ...props
}: Omit<TextFieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} required={required} id={id}>
      {(control) => (
        <div className="relative">
          <input
            {...control}
            type={visible ? 'text' : 'password'}
            className={cn(controlClasses, 'h-11 pr-12', className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-fg-muted hover:text-fg"
          >
            {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      )}
    </Field>
  );
}
