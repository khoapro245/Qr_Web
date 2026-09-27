import type { ValidationIssue } from '@qrcare/shared';
import { AxiosError } from 'axios';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { getApiError } from '../api/client';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email/số điện thoại hoặc mật khẩu không đúng.',
  ACCOUNT_INACTIVE: 'Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ nhà sản xuất.',
  INVALID_CURRENT_PASSWORD: 'Mật khẩu hiện tại không đúng.',
  RATE_LIMITED: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
  VALIDATION_ERROR: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại các trường được đánh dấu.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  SESSION_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  PASSWORD_CHANGE_REQUIRED: 'Bạn cần đổi mật khẩu trước khi tiếp tục.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  CUSTOMER_NOT_FOUND: 'Không tìm thấy khách hàng.',
  EMAIL_TAKEN: 'Email này đã được dùng cho tài khoản khác.',
  PHONE_TAKEN: 'Số điện thoại này đã được dùng cho tài khoản khác.',
  CSRF_TOKEN_INVALID: 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang.',
  INVALID_IMAGE: 'Tệp không phải ảnh hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.',
  IMAGE_TOO_SMALL: 'Ảnh quá nhỏ. Vui lòng chọn ảnh ít nhất 64×64 điểm ảnh.',
  FILE_TOO_LARGE: 'Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.',
  FILE_REQUIRED: 'Vui lòng chọn một ảnh.',
  INVALID_UPLOAD: 'Tải ảnh lên không thành công. Vui lòng thử lại.',
};

const FALLBACK = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
const NETWORK = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.';

/** A user-facing Vietnamese message for any error thrown by the API client. */
export function errorMessage(error: unknown): string {
  const apiError = getApiError(error);
  if (apiError) {
    if (apiError.code === 'ACCOUNT_LOCKED') {
      const details = apiError.details as { retryAfterSeconds?: number } | undefined;
      const minutes = Math.max(1, Math.ceil((details?.retryAfterSeconds ?? 900) / 60));
      return `Tài khoản tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${minutes} phút.`;
    }
    return MESSAGES[apiError.code] ?? FALLBACK;
  }
  if (error instanceof AxiosError && !error.response) return NETWORK;
  return FALLBACK;
}

/**
 * Copies field-level messages from the server (validation errors, duplicate email/phone)
 * onto the matching form fields. Returns true if at least one field error was applied.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  const apiError = getApiError(error);
  if (!apiError || !Array.isArray(apiError.details)) return false;
  let applied = false;
  for (const issue of apiError.details as ValidationIssue[]) {
    const field = fields.find((f) => f === issue.path);
    if (field) {
      setError(field, { type: 'server', message: issue.message });
      applied = true;
    }
  }
  return applied;
}
