import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from '@qrcare/shared';

export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(',');
export const AVATAR_HINT =
  'JPEG, PNG hoặc WebP, tối đa 5 MB. Ảnh được cắt vuông và hiển thị trên trang QR.';

/**
 * Quick client-side check for a better experience. The server re-validates by decoding the
 * image, so this is never the security boundary.
 */
export function avatarFileProblem(file: File): string | null {
  // Some systems report an empty type; let the server decide in that case.
  if (file.type && !(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.';
  }
  if (file.size > AVATAR_MAX_BYTES) return 'Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.';
  return null;
}
