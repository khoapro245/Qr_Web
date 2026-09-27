import { zodResolver } from '@hookform/resolvers/zod';
import { existingPasswordSchema, newPasswordSchema, PASSWORD_MIN_LENGTH } from '@qrcare/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { changePassword } from '../../api/auth';
import { getApiError } from '../../api/client';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/TextField';
import { homePathFor, useAuth, useSetAuthUser } from '../../features/auth/use-auth';
import { applyServerFieldErrors, errorMessage } from '../../lib/errors';
import { usePageTitle } from '../../lib/use-page-title';

const formSchema = z
  .object({
    currentPassword: existingPasswordSchema,
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  })
  .refine((d) => d.confirmPassword === d.newPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  });

type FormValues = z.infer<typeof formSchema>;

export function ChangePasswordPage() {
  usePageTitle('Đổi mật khẩu');
  const { user } = useAuth();
  const setAuthUser = useSetAuthUser();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const forced = user?.mustChangePassword ?? false;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const updated = await changePassword(values.currentPassword, values.newPassword);
      setAuthUser(updated);
      void navigate(homePathFor(updated.role), { replace: true });
    } catch (err) {
      if (getApiError(err)?.code === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', { message: errorMessage(err) });
      } else if (
        !applyServerFieldErrors(err, setError, ['currentPassword', 'newPassword'] as const)
      ) {
        setFormError(errorMessage(err));
      }
    }
  };

  return (
    <AuthLayout
      title="Đổi mật khẩu"
      description={
        forced ? undefined : 'Sau khi đổi, các thiết bị khác đang đăng nhập sẽ bị đăng xuất.'
      }
    >
      <form noValidate className="space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        {forced && (
          <Alert tone="info" title="Vui lòng đổi mật khẩu mặc định">
            Đây là lần đăng nhập đầu tiên. Hãy đặt mật khẩu riêng của bạn để tiếp tục.
          </Alert>
        )}
        {formError && <Alert tone="error">{formError}</Alert>}
        <PasswordField
          label={forced ? 'Mật khẩu mặc định' : 'Mật khẩu hiện tại'}
          autoComplete="current-password"
          required
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label="Mật khẩu mới"
          autoComplete="new-password"
          required
          hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự, gồm cả chữ và số.`}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          label="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Lưu mật khẩu mới
        </Button>
        {!forced && user && (
          <p className="text-center text-sm">
            <Link to={homePathFor(user.role)} className="font-medium text-primary hover:underline">
              Quay lại
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
