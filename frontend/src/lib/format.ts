import {
  APP_TIME_ZONE,
  formatVietnamPhone,
  type AccountStatus,
  type BloodGroup,
  type Gender,
} from '@qrcare/shared';

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  'A+': 'A+',
  'A-': 'A−',
  'B+': 'B+',
  'B-': 'B−',
  'AB+': 'AB+',
  'AB-': 'AB−',
  'O+': 'O+',
  'O-': 'O−',
  UNKNOWN: 'Chưa rõ',
};

export const STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Đã vô hiệu hóa',
};

export const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const BLOOD_GROUP_OPTIONS = Object.entries(BLOOD_GROUP_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** `2006-03-19` → `19/03/2006` (plain string work: a date of birth has no time zone). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** `2026-09-27T07:00:00Z` → `27/09/2026 14:00` (Vietnam time). */
export function formatDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

export function formatPhone(e164: string | null): string {
  return e164 ? formatVietnamPhone(e164) : '';
}

export function formatMeasurement(value: number | null, unit: string): string | null {
  return value === null ? null : `${value.toLocaleString('vi-VN')} ${unit}`;
}
