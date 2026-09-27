import type { CustomerQrInfo } from '@qrcare/shared';
import { api, unwrap } from './client';

const base = (customerId: string) => `/admin/users/${encodeURIComponent(customerId)}/qr`;

export function fetchCustomerQr(customerId: string): Promise<CustomerQrInfo> {
  return unwrap<CustomerQrInfo>(api.get(base(customerId)));
}

export function generateQr(customerId: string): Promise<CustomerQrInfo> {
  return unwrap<CustomerQrInfo>(api.post(base(customerId)));
}

export function regenerateQr(customerId: string): Promise<CustomerQrInfo> {
  return unwrap<CustomerQrInfo>(api.post(`${base(customerId)}/regenerate`));
}

export function revokeQr(customerId: string): Promise<CustomerQrInfo> {
  return unwrap<CustomerQrInfo>(api.post(`${base(customerId)}/revoke`));
}

/**
 * Image of the customer's current QR. `version` (the QR id) changes on regeneration so the
 * browser never shows a stale, revoked code.
 */
export function qrImageUrl(
  customerId: string,
  version: string,
  format: 'png' | 'svg' = 'png',
  download = false,
): string {
  const params = new URLSearchParams({ format, v: version });
  if (download) params.set('download', '1');
  return `/api${base(customerId)}/image?${params.toString()}`;
}
