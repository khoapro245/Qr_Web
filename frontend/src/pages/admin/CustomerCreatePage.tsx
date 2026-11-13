import { createCustomerSchema, PASSWORD_MIN_LENGTH, type CreateCustomer } from '@qrcare/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { createCustomer, uploadCustomerAvatar } from '../../api/customers';
import { Alert } from '../../components/ui/Alert';
import { BackLink } from '../../components/ui/BackLink';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/button-classes';
import { Card } from '../../components/ui/Card';
import { CheckboxField } from '../../components/ui/CheckboxField';
import { PasswordField } from '../../components/ui/TextField';
import { AvatarPicker } from '../../features/customers/AvatarPicker';
import {
  EMPTY_PROFILE,
  PROFILE_FIELD_NAMES,
  type LoginFormValues,
  type ProfileFormValues,
} from '../../features/customers/form-values';
import { LoginIdentifierFields, ProfileFields } from '../../features/customers/ProfileFields';
import { customerKeys } from '../../features/customers/query-keys';
import { MedicalConditionSelect } from '../../features/medical-content/MedicalConditionSelect';
import { setUserCondition } from '../../features/medical-content/medical-content.storage';
import { applyServerFieldErrors, errorMessage } from '../../lib/errors';
import { formResolver } from '../../lib/form';
import { usePageTitle } from '../../lib/use-page-title';

interface CreateFormValues extends ProfileFormValues, LoginFormValues {
  password: string;
  publicConsent: boolean;
}

/** Navigation state handed to the detail page right after creation. */
export interface CreatedCustomerState {
  created: true;
  temporaryPassword: string | null;
  avatarFailed: boolean;
}

export function CustomerCreatePage() {
  usePageTitle('Thêm khách hàng');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [selectedConditionId, setSelectedConditionId] = useState<string>('trauma');

  const form = useForm<CreateFormValues, unknown, CreateCustomer>({
    resolver: formResolver<CreateFormValues, typeof createCustomerSchema>(createCustomerSchema),
    defaultValues: { ...EMPTY_PROFILE, email: '', phone: '', password: '', publicConsent: false },
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;
  const fullName = useWatch({ control: form.control, name: 'fullName' });

  // Receives the schema's parsed output (normalised phone numbers, numeric measurements).
  const onSubmit = async (values: CreateCustomer) => {
    setFormError(null);
    try {
      const { customer, temporaryPassword } = await createCustomer(values);
      // Save customer's medical condition
      setUserCondition(values.familyPhone, selectedConditionId);
      setUserCondition(values.fullName, selectedConditionId);
      setUserCondition(customer.id, selectedConditionId);

      // The customer exists now; an avatar failure must not hide the temporary password.
      let avatarFailed = false;
      if (avatar) {
        try {
          await uploadCustomerAvatar(customer.id, avatar);
        } catch {
          avatarFailed = true;
        }
      }
      await queryClient.invalidateQueries({ queryKey: customerKeys.all });
      const state: CreatedCustomerState = { created: true, temporaryPassword, avatarFailed };
      void navigate(`/admin/users/${customer.id}`, { state });
    } catch (err) {
      const applied = applyServerFieldErrors(err, setError, [
        ...PROFILE_FIELD_NAMES,
        'email',
        'phone',
        'password',
        'publicConsent',
      ] as const);
      setFormError(applied ? 'Vui lòng kiểm tra lại các trường được đánh dấu.' : errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <BackLink to="/admin/users">Danh sách khách hàng</BackLink>
        <h1 className="text-2xl font-semibold">Thêm khách hàng</h1>
      </div>

      <FormProvider {...form}>
        <form noValidate className="space-y-6" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
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

          <Card>
            <h2 className="mb-4 text-lg font-semibold">Ảnh đại diện</h2>
            <AvatarPicker file={avatar} onChange={setAvatar} name={fullName} />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Thông tin đăng nhập</h2>
            <LoginIdentifierFields />
            <PasswordField
              label="Mật khẩu ban đầu"
              autoComplete="new-password"
              hint={`Để trống để hệ thống tự tạo mật khẩu tạm an toàn (khuyến nghị). Nếu tự đặt: ít nhất ${PASSWORD_MIN_LENGTH} ký tự, gồm chữ và số.`}
              error={errors.password?.message}
              {...register('password')}
            />
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold">Đồng ý công khai thông tin</h2>
            <p className="text-sm text-fg-muted">
              Khi quét mã QR trên áo, bất kỳ ai cũng xem được: ảnh, họ tên, ngày sinh, tuổi, giới
              tính, địa chỉ, SĐT gia đình, nhóm máu, cân nặng và chiều cao. Email, số điện thoại
              đăng nhập và mật khẩu không bao giờ được hiển thị.
            </p>
            <CheckboxField
              label="Khách hàng (hoặc người giám hộ) đã được giải thích và đồng ý công khai các thông tin trên."
              error={errors.publicConsent?.message}
              {...register('publicConsent')}
            />
          </Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to="/admin/users" className={buttonClasses('secondary')}>
              Hủy
            </Link>
            <Button type="submit" loading={isSubmitting}>
              Tạo khách hàng
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
