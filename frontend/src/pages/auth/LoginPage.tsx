import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type AuthUser } from '@qrcare/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router';
import type { z } from 'zod';
import { login } from '../../api/auth';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField, TextField } from '../../components/ui/TextField';
import { homePathFor, useAuth, useSetAuthUser } from '../../features/auth/use-auth';
import { errorMessage } from '../../lib/errors';
import { usePageTitle } from '../../lib/use-page-title';
import type { LoginNoticeState } from './ResetPasswordPage';

type FormInput = z.input<typeof loginSchema>;
type FormOutput = z.output<typeof loginSchema>;

/** Where to go after login: back to the requested page if this role may see it. */
function destinationFor(user: AuthUser, from: string | undefined): string {
  if (user.mustChangePassword) return '/change-password';
  const area = user.role === 'ADMIN' ? '/admin' : '/profile';
  if (from && (from === area || from.startsWith(`${area}/`))) return from;
  return homePathFor(user.role);
}

export function LoginPage() {
  usePageTitle('Đăng nhập');
  const { user, isLoading } = useAuth();
  const setAuthUser = useSetAuthUser();
  const location = useLocation();
  const state = location.state as ({ from?: string } & Partial<LoginNoticeState>) | null;
  const from = state?.from;
  const passwordReset = state?.passwordReset === true;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  // Once signed in (now or earlier), the guard below performs the redirect.
  if (!isLoading && user) return <Navigate to={destinationFor(user, from)} replace />;

  const onSubmit = async (values: FormOutput) => {
    setFormError(null);
    try {
      setAuthUser(await login(values.identifier.value, values.password));
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <AuthLayout title="Đăng nhập" description="Dùng email hoặc số điện thoại đã đăng ký.">
      <form noValidate className="space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        {passwordReset && !formError && (
          <Alert tone="success">Đã đặt mật khẩu mới. Vui lòng đăng nhập bằng mật khẩu mới.</Alert>
        )}
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Email hoặc số điện thoại"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          error={errors.identifier?.message}
          {...register('identifier')}
        />
        <PasswordField
          label="Mật khẩu"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Đăng nhập
        </Button>
      </form>
    </AuthLayout>
  );
}
