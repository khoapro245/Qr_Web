import { zodResolver } from '@hookform/resolvers/zod';
import {
  forgotPasswordSchema,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  otpCodeSchema,
  type LoginIdentifier,
} from '@qrcare/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { requestPasswordReset, verifyResetOtp } from '../../api/auth';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { errorMessage } from '../../lib/errors';
import { formatPhone } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';

export interface ResetPasswordState {
  resetToken: string;
}

export function ForgotPasswordPage() {
  usePageTitle('Quên mật khẩu');
  const [identifier, setIdentifier] = useState<LoginIdentifier | null>(null);

  return (
    <AuthLayout
      title="Quên mật khẩu"
      description={
        identifier
          ? undefined
          : 'Nhập email hoặc số điện thoại đã đăng ký. Chúng tôi sẽ gửi mã xác nhận để bạn đặt lại mật khẩu.'
      }
    >
      {identifier ? (
        <VerifyStep identifier={identifier} onChangeIdentifier={() => setIdentifier(null)} />
      ) : (
        <RequestStep onSent={setIdentifier} />
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}

type RequestInput = z.input<typeof forgotPasswordSchema>;
type RequestOutput = z.output<typeof forgotPasswordSchema>;

function RequestStep({ onSent }: { onSent: (identifier: LoginIdentifier) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestInput, unknown, RequestOutput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: '' },
  });

  const onSubmit = async ({ identifier }: RequestOutput) => {
    setFormError(null);
    try {
      await requestPasswordReset(identifier.value);
      onSent(identifier);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <form noValidate className="space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
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
      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Gửi mã xác nhận
      </Button>
    </form>
  );
}

const verifySchema = z.object({ otp: otpCodeSchema });
type VerifyValues = z.infer<typeof verifySchema>;

function VerifyStep({
  identifier,
  onChangeIdentifier,
}: {
  identifier: LoginIdentifier;
  onChangeIdentifier: () => void;
}) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OTP_RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyValues>({ resolver: zodResolver(verifySchema), defaultValues: { otp: '' } });

  const destination =
    identifier.type === 'email' ? identifier.value : formatPhone(identifier.value);

  const onSubmit = async ({ otp }: VerifyValues) => {
    setFormError(null);
    try {
      const resetToken = await verifyResetOtp(identifier.value, otp);
      const state: ResetPasswordState = { resetToken };
      void navigate('/reset-password', { replace: true, state });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const resend = async () => {
    setFormError(null);
    setResending(true);
    try {
      await requestPasswordReset(identifier.value);
      setNotice('Đã gửi lại mã xác nhận. Mã cũ không còn dùng được.');
      setSecondsLeft(OTP_RESEND_SECONDS);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <form noValidate className="space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
      {/* Worded conditionally: the server never reveals whether the account exists. */}
      <Alert tone="info">
        Nếu <strong>{destination}</strong> đã được đăng ký, mã xác nhận {OTP_LENGTH} số đã được gửi{' '}
        {identifier.type === 'email' ? 'qua email' : 'qua tin nhắn SMS'}. Mã có hiệu lực trong{' '}
        {OTP_TTL_MINUTES} phút.
      </Alert>
      {notice && <Alert tone="success">{notice}</Alert>}
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField
        label="Mã xác nhận"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        required
        className="text-center font-mono text-xl tracking-[0.5em]"
        error={errors.otp?.message}
        {...register('otp')}
      />
      <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
        Xác nhận
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          disabled={secondsLeft > 0}
          loading={resending}
          onClick={() => void resend()}
        >
          {secondsLeft > 0 ? `Gửi lại mã sau ${secondsLeft} giây` : 'Gửi lại mã'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onChangeIdentifier}>
          Đổi email/số điện thoại
        </Button>
      </div>
    </form>
  );
}
