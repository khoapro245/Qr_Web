import { AlertTriangle, Check, ShieldAlert, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useDisclaimerContent } from '../medical-content/medical-content.storage';

interface FirstAidDisclaimerModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function FirstAidDisclaimerModal({ open, onClose, onAccept }: FirstAidDisclaimerModalProps) {
  const { disclaimer } = useDisclaimerContent();
  const [agreed, setAgreed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const checkboxId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setAgreed(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleConfirm = () => {
    if (!agreed) return;
    onAccept();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border bg-surface p-6 text-fg shadow-2xl backdrop:bg-black/60"
    >
      {open && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-warning-soft text-warning-soft-fg">
                <ShieldAlert aria-hidden="true" className="size-5" />
              </span>
              <h2 id={titleId} className="text-lg font-bold text-fg">
                {disclaimer.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
              aria-label="Đóng cửa sổ"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="space-y-3 rounded-2xl bg-surface-muted p-4 text-sm leading-relaxed text-fg">
            {disclaimer.warningText && (
              <div className="flex items-start gap-2 text-danger font-medium">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{disclaimer.warningText}</span>
              </div>
            )}
            <ul className="list-disc space-y-2 pl-5 text-xs text-fg-muted">
              {disclaimer.items.map((item) => (
                <li key={item.id}>
                  <strong className="text-fg">{item.title}:</strong> {item.content}
                </li>
              ))}
            </ul>
          </div>

          <label
            htmlFor={checkboxId}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-surface-muted"
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-4.5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs font-medium text-fg">{disclaimer.checkboxLabel}</span>
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              {disclaimer.cancelButtonText || 'Hủy'}
            </Button>
            <Button variant="primary" disabled={!agreed} onClick={handleConfirm}>
              <Check aria-hidden="true" className="size-4" />
              {disclaimer.confirmButtonText}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
