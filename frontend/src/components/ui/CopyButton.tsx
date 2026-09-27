import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from './Button';

export function CopyButton({ value, label = 'Sao chép' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the value stays visible for manual copying.
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={() => void copy()}>
      {copied ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      <span aria-live="polite">{copied ? 'Đã sao chép' : label}</span>
    </Button>
  );
}
