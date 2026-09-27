import { z } from 'zod';
import { normalizeVietnamPhone } from '../phone.js';

export const PASSWORD_MIN_LENGTH = 8;
// Caps hashing cost per request; no real password is longer.
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Email không hợp lệ').max(254, 'Email quá dài'));

/** A Vietnamese mobile number (used for login and SMS OTP), normalised to E.164. */
export const mobilePhoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeVietnamPhone(value, 'mobile');
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Số điện thoại di động không hợp lệ' });
    return z.NEVER;
  }
  return normalized;
});

export type LoginIdentifier = { type: 'email' | 'phone'; value: string };

/** Email OR phone. Anything containing "@" is treated as an email. */
export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email hoặc số điện thoại')
  .max(254, 'Giá trị quá dài')
  .transform((value, ctx): LoginIdentifier => {
    if (value.includes('@')) {
      const email = emailSchema.safeParse(value);
      if (email.success) return { type: 'email', value: email.data };
    } else {
      const phone = normalizeVietnamPhone(value, 'mobile');
      if (phone) return { type: 'phone', value: phone };
    }
    ctx.addIssue({ code: 'custom', message: 'Email hoặc số điện thoại không hợp lệ' });
    return z.NEVER;
  });

/**
 * Rules for a newly chosen password: long enough, with at least one letter and one digit.
 * Deliberately no further composition rules — length matters more than symbols.
 */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`)
  .max(PASSWORD_MAX_LENGTH, `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự`)
  .regex(/\p{L}/u, 'Mật khẩu phải có ít nhất một chữ cái')
  .regex(/\d/, 'Mật khẩu phải có ít nhất một chữ số');

export const existingPasswordSchema = z
  .string()
  .min(1, 'Vui lòng nhập mật khẩu')
  .max(PASSWORD_MAX_LENGTH, 'Mật khẩu không hợp lệ');

export const loginSchema = z.object({
  identifier: loginIdentifierSchema,
  password: existingPasswordSchema,
});
export type LoginInput = z.output<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: existingPasswordSchema,
    newPassword: newPasswordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  });
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
