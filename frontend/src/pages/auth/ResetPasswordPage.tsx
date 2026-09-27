import { zodResolver } from '@hookform/resolvers/zod';
import { newPasswordSchema, PASSWORD_MIN_LENGTH } from '@qrcare/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { resetPassword } from '../../api/auth';
import { getApiError } from '../../api/client';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/TextField';
import { errorMessage } from '../../lib/errors';
import { usePageTitle } from '../../lib/use-page-title';
import type { ResetPasswordState } from './ForgotPasswordPage';

const formSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine((d) => d.confirmPassword === d.newPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  });
type FormValues = z.infer<typeof formSchema>;

export interface LoginNoticeState {
  passwordReset: true;
}

export function ResetPasswordPage() {
  usePageTitle('Đặt lại mật khẩu');
  const location = useLocation();
  const navigate = useNavigate();
  // The token arrives in navigation state only — never in the URL — and is wiped from the
  // history entry right away so a reload or back-navigation cannot reuse it.
  const [resetToken] = useState(() => (location.state as ResetPasswordState | null)?.resetToken);
  useEffect(() => {
    if (location.state) void navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  if (!resetToken) return <Navigate to="/forgot-password" replace />;
  return <ResetForm resetToken={resetToken} />;
}

function ResetForm({ resetToken }: { resetToken: string }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await resetPassword(resetToken, values.newPassword);
      const state: LoginNoticeState = { passwordReset: true };
      void navigate('/login', { replace: true, state });
    } catch (err) {
      setExpired(getApiError(err)?.code === 'RESET_TOKEN_INVALID');
      setFormError(errorMessage(err));
    }
  };

  return (
    <AuthLayout title="Đặt mật khẩu mới">
      <form noValidate className="space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        {formError && (
          <Alert tone="error">
            {formError}{' '}
            {expired && (
              <Link to="/forgot-password" className="font-semibold underline">
                Yêu cầu mã mới
              </Link>
            )}
          </Alert>
        )}
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
          Đặt mật khẩu mới
        </Button>
      </form>
    </AuthLayout>
  );
}
