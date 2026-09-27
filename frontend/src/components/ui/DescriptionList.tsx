import type { ReactNode } from 'react';

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

/** Label/value grid for read-only record details. Empty values show a muted dash. */
export function DescriptionList({ items }: { items: DescriptionItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(({ label, value, wide }) => (
        <div key={label} className={wide ? 'sm:col-span-2' : undefined}>
          <dt className="text-sm text-fg-muted">{label}</dt>
          <dd className="mt-0.5 font-medium break-words">
            {value === null || value === undefined || value === '' ? (
              <span className="font-normal text-fg-muted">—</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
