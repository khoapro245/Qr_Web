import { ImagePlus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { AVATAR_ACCEPT, AVATAR_HINT, avatarFileProblem } from './avatar-file';

interface AvatarPickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  name: string;
}

/** Chooses an avatar before the customer exists; it is uploaded right after creation. */
export function AvatarPicker({ file, onChange, name }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  // Object URLs hold the file in memory until revoked, so the previous one is released
  // whenever the selection changes and on unmount.
  const previewRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const select = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewRef.current);
    onChange(next);
  };

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    const issue = avatarFileProblem(chosen);
    setProblem(issue);
    if (!issue) select(chosen);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar size="lg" src={previewUrl} name={name || 'Khách hàng'} />
        <div className="flex flex-col items-start gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="avatar-input"
            onChange={onFileChosen}
          />
          <Button
            variant="secondary"
            size="sm"
            aria-describedby={hintId}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            {file ? 'Chọn ảnh khác' : 'Chọn ảnh'}
          </Button>
          {file && (
            <Button variant="ghost" size="sm" onClick={() => select(null)}>
              <X aria-hidden="true" className="size-4" />
              Bỏ ảnh
            </Button>
          )}
        </div>
      </div>
      <p id={hintId} className="text-sm text-fg-muted">
        {AVATAR_HINT} Có thể bỏ qua và thêm sau.
      </p>
      {problem && (
        <p role="alert" className="text-sm font-medium text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
