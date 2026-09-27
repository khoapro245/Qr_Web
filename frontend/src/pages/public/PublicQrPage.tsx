import { QR_TOKEN_PATTERN, type PublicProfile } from '@qrcare/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Cake,
  Droplet,
  MapPin,
  Phone,
  QrCode,
  Ruler,
  ShieldAlert,
  User,
  Weight,
  WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { getApiError } from '../../api/client';
import { fetchPublicProfile } from '../../api/public';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import {
  BLOOD_GROUP_LABELS,
  formatDate,
  formatMeasurement,
  formatPhone,
  GENDER_LABELS,
} from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';

/**
 * The page a passer-by sees after scanning a shirt. Deliberately minimal: no login link, no
 * navigation, no search — only the owner's permitted information, readable at a glance on a
 * phone.
 */
export function PublicQrPage() {
  // A generic title: the owner's name should not end up in browser history titles.
  usePageTitle('Thông tin hỗ trợ');
  const { token = '' } = useParams();
  const validFormat = QR_TOKEN_PATTERN.test(token);

  const query = useQuery({
    queryKey: ['public-qr', token],
    queryFn: () => fetchPublicProfile(token),
    enabled: validFormat,
    retry: (count, error) => !getApiError(error) && count < 2,
  });

  let content: ReactNode;
  if (!validFormat || getApiError(query.error)?.code === 'QR_NOT_FOUND') {
    content = <Unavailable />;
  } else if (query.error) {
    content = <NetworkProblem onRetry={() => void query.refetch()} />;
  } else if (query.isPending) {
    content = <ProfileSkeleton />;
  } else {
    content = <ProfileCard profile={query.data} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex justify-center px-4 py-4">
        <Logo />
      </header>
      <main className="flex-1 px-4 pb-10">{content}</main>
    </div>
  );
}

function ProfileCard({ profile }: { profile: PublicProfile }) {
  const rows: { label: string; value: ReactNode; Icon: typeof User }[] = [
    { label: 'Ngày sinh', value: formatDate(profile.dateOfBirth), Icon: Cake },
    { label: 'Tuổi', value: `${profile.age} tuổi`, Icon: User },
    { label: 'Giới tính', value: GENDER_LABELS[profile.gender], Icon: User },
    { label: 'Địa chỉ', value: profile.address, Icon: MapPin },
    {
      label: 'SĐT gia đình',
      value: (
        <a
          href={`tel:${profile.familyPhone}`}
          className="font-semibold text-primary underline decoration-2 underline-offset-4"
        >
          {formatPhone(profile.familyPhone)}
        </a>
      ),
      Icon: Phone,
    },
    { label: 'Nhóm máu', value: BLOOD_GROUP_LABELS[profile.bloodGroup], Icon: Droplet },
    { label: 'Cân nặng', value: formatMeasurement(profile.weightKg, 'kg'), Icon: Weight },
    { label: 'Chiều cao', value: formatMeasurement(profile.heightCm, 'cm'), Icon: Ruler },
  ];

  return (
    <div className="mx-auto max-w-md space-y-6">
      <article
        aria-labelledby="owner-name"
        className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm"
      >
        <div className="flex flex-col items-center bg-primary-soft px-6 pb-6 pt-8 text-center">
          <Avatar size="xl" src={profile.avatarUrl} name={profile.fullName} />
          <h1 id="owner-name" className="mt-4 text-2xl font-bold break-words text-fg">
            {profile.fullName}
          </h1>
        </div>
        <dl className="divide-y divide-border px-6">
          {rows
            .filter((row) => row.value !== null && row.value !== '')
            .map(({ label, value, Icon }) => (
              <div key={label} className="flex items-start gap-4 py-4">
                <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <dt className="text-sm text-fg-muted">{label}</dt>
                  <dd className="text-lg font-medium break-words text-fg">{value}</dd>
                </div>
              </div>
            ))}
        </dl>
      </article>
      <p className="px-2 text-center text-sm text-fg-muted">
        Thông tin được chủ sở hữu đồng ý chia sẻ để được hỗ trợ khi cần. Vui lòng chỉ dùng để giúp
        đỡ người mặc áo và không chia sẻ cho mục đích khác.
      </p>
    </div>
  );
}

function Unavailable() {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
        <QrCode aria-hidden="true" className="size-7" />
      </span>
      <h1 className="text-xl font-semibold">Mã QR không hợp lệ hoặc đã bị thu hồi</h1>
      <p className="text-fg-muted">Mã này hiện không hiển thị thông tin.</p>
      <EmergencyNumbers />
    </div>
  );
}

function NetworkProblem({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center"
    >
      <WifiOff aria-hidden="true" className="size-10 text-fg-muted" />
      <h1 className="text-xl font-semibold">Không tải được thông tin</h1>
      <p className="text-fg-muted">Vui lòng kiểm tra kết nối mạng rồi thử lại.</p>
      <Button onClick={onRetry} size="lg">
        Thử lại
      </Button>
      <EmergencyNumbers />
    </div>
  );
}

/** Shown whenever the profile cannot be displayed, so someone trying to help is not stuck. */
function EmergencyNumbers() {
  return (
    <div className="flex w-full items-start gap-3 rounded-2xl bg-warning-soft p-4 text-left text-warning-soft-fg">
      <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="text-sm">
        Nếu người mặc áo đang cần giúp đỡ khẩn cấp, hãy gọi{' '}
        <a href="tel:115" className="font-semibold underline">
          115
        </a>{' '}
        (cấp cứu) hoặc{' '}
        <a href="tel:113" className="font-semibold underline">
          113
        </a>{' '}
        (công an).
      </p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải thông tin"
      className="mx-auto max-w-md overflow-hidden rounded-3xl border border-border bg-surface"
    >
      <div className="flex flex-col items-center gap-4 bg-primary-soft px-6 pb-6 pt-8">
        <div className="size-32 animate-pulse rounded-full bg-surface/60" />
        <div className="h-7 w-48 animate-pulse rounded bg-surface/60" />
      </div>
      <div className="space-y-4 p-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
