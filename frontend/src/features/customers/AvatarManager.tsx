import type { CustomerDetail } from '@qrcare/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { avatarUrls, deleteCustomerAvatar, uploadCustomerAvatar } from '../../api/customers';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { errorMessage } from '../../lib/errors';
import { AVATAR_ACCEPT, AVATAR_HINT, avatarFileProblem } from './avatar-file';
import { customerKeys } from './query-keys';

/** Admin-only avatar upload / replace / remove for one customer. */
export function AvatarManager({ customer }: { customer: CustomerDetail }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { profile } = customer;

  const onUpdated = (updated: CustomerDetail) => {
    queryClient.setQueryData(customerKeys.detail(customer.id), updated);
    setProblem(null);
  };

  const upload = useMutation({
    mutationFn: (file: File) => uploadCustomerAvatar(customer.id, file),
    onSuccess: onUpdated,
    onError: (err) => setProblem(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => deleteCustomerAvatar(customer.id),
    onSuccess: (updated) => {
      onUpdated(updated);
      setConfirmRemove(false);
    },
    onError: (err) => {
      setConfirmRemove(false);
      setProblem(errorMessage(err));
    },
  });

  const onFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again after an error
    if (!file) return;
    const issue = avatarFileProblem(file);
    if (issue) {
      setProblem(issue);
      return;
    }
    upload.mutate(file);
  };

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">Ảnh đại diện</h2>
      <div className="flex items-center gap-4">
        <Avatar
          size="lg"
          name={profile.fullName}
          src={profile.avatarVersion ? avatarUrls.admin(customer.id, profile.avatarVersion) : null}
        />
        <div className="flex flex-col items-start gap-2">
          {/* Hidden native input; the button below is the accessible control. */}
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
            loading={upload.isPending}
            aria-describedby={hintId}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden="true" className="size-4" />
            {profile.hasAvatar ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </Button>
          {profile.hasAvatar && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Xóa ảnh
            </Button>
          )}
        </div>
      </div>
      <p id={hintId} className="text-sm text-fg-muted">
        {AVATAR_HINT}
      </p>
      {problem && <Alert tone="error">{problem}</Alert>}

      <ConfirmDialog
        open={confirmRemove}
        title="Xóa ảnh đại diện?"
        confirmLabel="Xóa ảnh"
        tone="danger"
        loading={remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
      >
        Trang QR công khai sẽ không còn hiển thị ảnh của khách hàng này.
      </ConfirmDialog>
    </Card>
  );
}
