import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';

/** Shows a one-time temporary password so the admin can hand it over with the shirt. */
export function TemporaryPasswordNotice({ password, title }: { password: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the password stays visible for manual copying.
    }
  };

  return (
    <Alert tone="warning" title={title}>
      <p>
        Mật khẩu tạm chỉ hiển thị <strong>một lần</strong>. Hãy ghi lại và giao cho khách hàng cùng
        áo. Khách hàng sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code
          aria-label="Mật khẩu tạm"
          className="rounded-lg bg-surface px-3 py-2 font-mono text-lg tracking-wider text-fg"
        >
          {password}
        </code>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </Button>
      </div>
    </Alert>
  );
}
