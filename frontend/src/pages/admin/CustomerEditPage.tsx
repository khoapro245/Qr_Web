import { updateCustomerSchema, type CustomerDetail, type UpdateCustomer } from '@qrcare/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { fetchCustomer, updateCustomer } from '../../api/customers';
import { Alert } from '../../components/ui/Alert';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/button-classes';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { MedicalConditionSelect } from '../../features/medical-content/MedicalConditionSelect';
import {
  getUserCondition,
  setUserCondition,
} from '../../features/medical-content/medical-content.storage';
import {
  PROFILE_FIELD_NAMES,
  toProfileFormValues,
  type LoginFormValues,
  type ProfileFormValues,
} from '../../features/customers/form-values';
import { LoginIdentifierFields, ProfileFields } from '../../features/customers/ProfileFields';
import { customerKeys } from '../../features/customers/query-keys';
import { applyServerFieldErrors, errorMessage } from '../../lib/errors';
import { formResolver } from '../../lib/form';
import { formatPhone } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';

type EditFormValues = ProfileFormValues & LoginFormValues;

export function CustomerEditPage() {
  usePageTitle('Chỉnh sửa khách hàng');
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: customerKeys.detail(id), queryFn: () => fetchCustomer(id) });

  if (query.isPending) {
    return (
      <div role="status" className="flex justify-center py-16 text-primary">
        <Spinner size="lg" />
        <span className="sr-only">Đang tải thông tin khách hàng</span>
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="space-y-4">
        <BackLink to="/admin/users">Danh sách khách hàng</BackLink>
        <Alert tone="error">{errorMessage(query.error)}</Alert>
      </div>
    );
  }
  // Mount the form only once data is loaded so default values are correct from the start.
  return <EditForm customer={query.data} />;
}

function EditForm({ customer }: { customer: CustomerDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedConditionId, setSelectedConditionId] = useState<string>(() => {
    return (
      getUserCondition(customer.profile.familyPhone) ||
      getUserCondition(customer.profile.fullName) ||
      getUserCondition(customer.id) ||
      'trauma'
    );
  });
  const [formError, setFormError] = useState<string | null>(null);
  const detailPath = `/admin/users/${customer.id}`;

  const form = useForm<EditFormValues, unknown, UpdateCustomer>({
    resolver: formResolver<EditFormValues, typeof updateCustomerSchema>(updateCustomerSchema),
    defaultValues: {
      ...toProfileFormValues(customer.profile),
      email: customer.account.email ?? '',
      phone: formatPhone(customer.account.phone),
    },
  });

  const onSubmit = async (values: UpdateCustomer) => {
    setFormError(null);
    try {
      const updated = await updateCustomer(customer.id, values);
      setUserCondition(values.familyPhone, selectedConditionId);
      setUserCondition(values.fullName, selectedConditionId);
      setUserCondition(customer.id, selectedConditionId);
      queryClient.setQueryData(customerKeys.detail(customer.id), updated);
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists });
      void navigate(detailPath);
    } catch (err) {
      const applied = applyServerFieldErrors(err, form.setError, [
        ...PROFILE_FIELD_NAMES,
        'email',
        'phone',
      ] as const);
      setFormError(applied ? 'Vui lòng kiểm tra lại các trường được đánh dấu.' : errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <BackLink to={detailPath}>{customer.profile.fullName}</BackLink>
        <h1 className="text-2xl font-semibold">Chỉnh sửa khách hàng</h1>
      </div>

      <FormProvider {...form}>
        <form
          noValidate
          className="space-y-6"
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        >
          {formError && <Alert tone="error">{formError}</Alert>}
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Thông tin cá nhân</h2>
            <ProfileFields />
            <div className="mt-4 border-t border-border pt-4">
              <MedicalConditionSelect
                value={selectedConditionId}
                onChange={setSelectedConditionId}
              />
            </div>
          </Card>
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Thông tin đăng nhập</h2>
            <LoginIdentifierFields />
            <p className="text-sm text-fg-muted">
              Để đổi mật khẩu của khách hàng, dùng nút “Cấp lại mật khẩu” ở trang chi tiết.
            </p>
          </Card>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to={detailPath} className={buttonClasses('secondary')}>
              Hủy
            </Link>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
