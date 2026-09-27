import { z } from 'zod';
import { todayInTimeZone } from '../age.js';
import { ACCOUNT_STATUSES, BLOOD_GROUPS, GENDERS } from '../constants.js';
import { normalizeVietnamPhone } from '../phone.js';
import { emailSchema, newPasswordSchema } from './auth.js';

// Inputs arrive from HTML forms (strings, "" for empty) as well as JSON clients, so the
// optional fields accept "", null and undefined as "no value" and output null.

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

function optionalText(max: number, message: string) {
  return z
    .string()
    .nullish()
    .transform((value, ctx) => {
      if (isBlank(value)) return null;
      const trimmed = (value as string).trim();
      if (trimmed.length > max) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return trimmed;
    });
}

function measurement(min: number, max: number, label: string, unit: string) {
  return z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value, ctx) => {
      if (isBlank(value)) return null;
      // Accept the Vietnamese decimal comma: "60,5" → 60.5.
      const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `${label} phải từ ${min} đến ${max} ${unit}` });
        return z.NEVER;
      }
      return Math.round(n * 10) / 10;
    });
}

const optionalEmail = z
  .string()
  .nullish()
  .transform((value, ctx) => {
    if (isBlank(value)) return null;
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'Email không hợp lệ' });
      return z.NEVER;
    }
    return parsed.data;
  });

const optionalMobilePhone = z
  .string()
  .nullish()
  .transform((value, ctx) => {
    if (isBlank(value)) return null;
    const normalized = normalizeVietnamPhone(value as string, 'mobile');
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại di động không hợp lệ' });
      return z.NEVER;
    }
    return normalized;
  });

export const dateOfBirthSchema = z
  .string({ error: 'Vui lòng nhập ngày sinh' })
  .min(1, 'Vui lòng nhập ngày sinh')
  .pipe(z.iso.date({ error: 'Ngày sinh không hợp lệ' }))
  .refine((value) => value >= '1900-01-01', 'Ngày sinh không hợp lệ')
  .refine((value) => value <= todayInTimeZone(), 'Ngày sinh không được ở tương lai');

/** Profile fields shown on the public QR page. Shared by admin and customer edits. */
export const profileFieldsSchema = z.object({
  fullName: z
    .string({ error: 'Vui lòng nhập họ tên' })
    .trim()
    .min(1, 'Vui lòng nhập họ tên')
    .max(100, 'Họ tên tối đa 100 ký tự'),
  dateOfBirth: dateOfBirthSchema,
  gender: z.enum(GENDERS, { error: 'Vui lòng chọn giới tính' }),
  address: optionalText(255, 'Địa chỉ tối đa 255 ký tự'),
  familyPhone: z
    .string({ error: 'Vui lòng nhập số điện thoại gia đình' })
    .transform((value, ctx) => {
      if (isBlank(value)) {
        ctx.addIssue({ code: 'custom', message: 'Vui lòng nhập số điện thoại gia đình' });
        return z.NEVER;
      }
      const normalized = normalizeVietnamPhone(value, 'mobile-or-landline');
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Số điện thoại gia đình không hợp lệ' });
        return z.NEVER;
      }
      return normalized;
    }),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: 'Nhóm máu không hợp lệ' }).default('UNKNOWN'),
  weightKg: measurement(1, 400, 'Cân nặng', 'kg'),
  heightCm: measurement(30, 260, 'Chiều cao', 'cm'),
});
export type ProfileFieldsInput = z.input<typeof profileFieldsSchema>;
export type ProfileFields = z.output<typeof profileFieldsSchema>;

const loginFields = {
  email: optionalEmail,
  phone: optionalMobilePhone,
};

const requireEmailOrPhone = (data: { email: string | null; phone: string | null }) =>
  data.email !== null || data.phone !== null;
const emailOrPhoneIssue = {
  path: ['email'],
  message: 'Cần ít nhất email hoặc số điện thoại để khách hàng đăng nhập',
  // Zod skips object refinements once any field is invalid. Run this one as long as email
  // and phone themselves parsed, so the form reports every problem in one go.
  when: (payload: { issues: readonly { path?: readonly PropertyKey[] | undefined }[] }) =>
    payload.issues.every((issue) => issue.path?.[0] !== 'email' && issue.path?.[0] !== 'phone'),
};

/** Admin: create a customer account together with its profile. */
export const createCustomerSchema = profileFieldsSchema
  .extend({
    ...loginFields,
    // Empty → the server generates a random temporary password.
    password: z
      .string()
      .nullish()
      .transform((value) => (isBlank(value) ? null : (value as string)))
      .pipe(newPasswordSchema.nullable()),
    publicConsent: z.literal(true, {
      error: 'Cần xác nhận khách hàng đã đồng ý công khai thông tin trên mã QR',
    }),
  })
  .refine(requireEmailOrPhone, emailOrPhoneIssue);
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type CreateCustomer = z.output<typeof createCustomerSchema>;

/** Admin: update profile and login identifiers (password changes use a separate endpoint). */
export const updateCustomerSchema = profileFieldsSchema
  .extend(loginFields)
  .refine(requireEmailOrPhone, emailOrPhoneIssue);
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;
export type UpdateCustomer = z.output<typeof updateCustomerSchema>;

/** Customer: edit own profile. Login identifiers, avatar and status are not editable here. */
export const updateOwnProfileSchema = profileFieldsSchema;

export const updateStatusSchema = z.object({
  status: z.enum(ACCOUNT_STATUSES, { error: 'Trạng thái không hợp lệ' }),
});

export const listCustomersQuerySchema = z.object({
  search: z
    .string()
    .optional()
    .transform((value) => value?.trim().slice(0, 100) || undefined),
  status: z
    .enum(ACCOUNT_STATUSES)
    .or(z.literal(''))
    .optional()
    .transform((value) => value || undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListCustomersQuery = z.output<typeof listCustomersQuerySchema>;
