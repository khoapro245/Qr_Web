import {
  updateOwnProfileSchema,
  type OwnProfile,
  type ProfileFields as ProfileOutput,
} from '@qrcare/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { avatarUrls, fetchOwnProfile, updateOwnProfile } from '../../api/customers';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DescriptionList } from '../../components/ui/DescriptionList';
import { Spinner } from '../../components/ui/Spinner';
import { AUTH_QUERY_KEY } from '../../features/auth/use-auth';
import {
  PROFILE_FIELD_NAMES,
  toProfileFormValues,
  type ProfileFormValues,
} from '../../features/customers/form-values';
import { ProfileDetails } from '../../features/customers/ProfileDetails';
import { ProfileFields } from '../../features/customers/ProfileFields';
import { customerKeys } from '../../features/customers/query-keys';
import { applyServerFieldErrors, errorMessage } from '../../lib/errors';
import { formResolver } from '../../lib/form';
import { formatPhone } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';

export function ProfilePage() {
  usePageTitle('Hồ sơ của tôi');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const query = useQuery({ queryKey: customerKeys.ownProfile, queryFn: fetchOwnProfile });

  if (query.isPending) {
    return (
      <div role="status" className="flex justify-center py-16 text-primary">
        <Spinner size="lg" />
        <span className="sr-only">Đang tải hồ sơ</span>
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="space-y-3">
        <Alert tone="error" title="Không tải được hồ sơ">
          {errorMessage(query.error)}
        </Alert>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  const { profile, account } = query.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Hồ sơ của tôi</h1>
        {!editing && (
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Chỉnh sửa hồ sơ
          </Button>
        )}
      </div>

      {saved && <Alert tone="success">Đã lưu thay đổi hồ sơ.</Alert>}

      <Card className="flex items-center gap-4">
        <Avatar
          size="lg"
          name={profile.fullName}
          src={profile.avatarVersion ? avatarUrls.own(profile.avatarVersion) : null}
        />
        <div className="space-y-1">
          <p className="font-medium">Ảnh đại diện</p>
          <p className="text-sm text-fg-muted">
            Ảnh đại diện do nhà sản xuất quản lý. Vui lòng liên hệ nhà sản xuất nếu cần thay đổi.
          </p>
        </div>
      </Card>

      {editing ? (
        <EditProfileForm
          data={query.data}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
        />
      ) : (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Thông tin hiển thị trên mã QR</h2>
          <ProfileDetails profile={profile} />
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Thông tin đăng nhập</h2>
        <p className="mb-4 text-sm text-fg-muted">
          Không hiển thị công khai. Liên hệ nhà sản xuất nếu cần thay đổi email hoặc số điện thoại.
        </p>
        <DescriptionList
          items={[
            { label: 'Email', value: account.email },
            { label: 'Số điện thoại', value: formatPhone(account.phone) },
          ]}
        />
      </Card>
    </div>
  );
}

function EditProfileForm({
  data,
  onCancel,
  onSaved,
}: {
  data: OwnProfile;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ProfileFormValues, unknown, ProfileOutput>({
    resolver: formResolver<ProfileFormValues, typeof updateOwnProfileSchema>(
      updateOwnProfileSchema,
    ),
    defaultValues: toProfileFormValues(data.profile),
  });

  const onSubmit = async (values: ProfileOutput) => {
    setFormError(null);
    try {
      const updated = await updateOwnProfile(values);
      queryClient.setQueryData(customerKeys.ownProfile, updated);
      // The header shows the customer's name.
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      onSaved();
    } catch (err) {
      const applied = applyServerFieldErrors(err, form.setError, PROFILE_FIELD_NAMES);
      setFormError(applied ? 'Vui lòng kiểm tra lại các trường được đánh dấu.' : errorMessage(err));
    }
  };

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
        <Card className="space-y-6">
          <h2 className="text-lg font-semibold">Chỉnh sửa thông tin</h2>
          {formError && <Alert tone="error">{formError}</Alert>}
          <ProfileFields />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onCancel} disabled={form.formState.isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Lưu thay đổi
            </Button>
          </div>
        </Card>
      </form>
    </FormProvider>
  );
}
