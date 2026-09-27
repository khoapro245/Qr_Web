const SEPARATORS = /[\s.\-()]/g;
// National significant numbers (without the leading 0 / +84).
const VN_MOBILE = /^[35789]\d{8}$/;
const VN_LANDLINE = /^2\d{9}$/;

export type PhoneKind = 'mobile' | 'mobile-or-landline';

/**
 * Normalises a Vietnamese phone number to E.164 (`+84912345678`).
 * Accepts `0912 345 678`, `0912.345.678`, `+84 912 345 678` and `0084912345678`.
 * Returns null when the value is not a valid number of the requested kind.
 */
export function normalizeVietnamPhone(value: string, kind: PhoneKind = 'mobile'): string | null {
  const compact = value.replace(SEPARATORS, '');
  let nationalNumber: string;
  if (compact.startsWith('+84')) nationalNumber = compact.slice(3);
  else if (compact.startsWith('0084')) nationalNumber = compact.slice(4);
  else if (compact.startsWith('0')) nationalNumber = compact.slice(1);
  else return null;

  if (VN_MOBILE.test(nationalNumber)) return `+84${nationalNumber}`;
  if (kind === 'mobile-or-landline' && VN_LANDLINE.test(nationalNumber)) {
    return `+84${nationalNumber}`;
  }
  return null;
}

/** Formats a stored E.164 Vietnamese number for display: `+84912345678` → `0912 345 678`. */
export function formatVietnamPhone(e164: string): string {
  if (!e164.startsWith('+84')) return e164;
  const local = `0${e164.slice(3)}`;
  if (local.length === 10) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
}
