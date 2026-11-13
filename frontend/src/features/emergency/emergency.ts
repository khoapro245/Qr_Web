/**
 * Emergency SOS and location sharing helpers.
 */

/**
 * Normalises phone numbers (E.164 +84... or 84...) to standard Vietnam local format (0...).
 * Zalo deep-links work reliably with local phone numbers (e.g. https://zalo.me/0912345678).
 */
export function formatZaloPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 10) {
    return '0' + digits.slice(2);
  }
  if (!digits.startsWith('0') && digits.length >= 9) {
    return '0' + digits;
  }
  return digits;
}

/**
 * Builds a standard Google Maps query link from latitude and longitude.
 */
export function createGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/**
 * Composes a standard emergency Vietnamese message including victim name and location link.
 */
export function buildEmergencyMessage(fullName: string, mapsUrl: string): string {
  return `CẢNH BÁO KHẨN CẤP: Tôi vừa quét mã QR của ${fullName}. Người này đang gặp tình huống khẩn cấp cần trợ giúp tại vị trí: ${mapsUrl}`;
}

/**
 * Generates an SMS URI with recipient and pre-filled message body.
 * Handles iOS vs Android URI query delimiter differences (&body vs ?body).
 */
export function createSmsUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const separator = isIOS ? '&' : '?';
  return `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
}
