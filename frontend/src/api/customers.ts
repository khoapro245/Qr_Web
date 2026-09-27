import type {
  AccountStatus,
  CreateCustomerInput,
  CustomerDetail,
  CustomerSummary,
  DashboardData,
  OwnProfile,
  Paginated,
  ProfileFieldsInput,
  UpdateCustomerInput,
} from '@qrcare/shared';
import { api, unwrap } from './client';

export interface CustomerListParams {
  search?: string;
  status?: AccountStatus | '';
  page?: number;
  pageSize?: number;
}

export function fetchDashboard(): Promise<DashboardData> {
  return unwrap<DashboardData>(api.get('/admin/dashboard'));
}

export function fetchCustomers(params: CustomerListParams): Promise<Paginated<CustomerSummary>> {
  return unwrap<Paginated<CustomerSummary>>(api.get('/admin/users', { params }));
}

export async function fetchCustomer(id: string): Promise<CustomerDetail> {
  const data = await unwrap<{ customer: CustomerDetail }>(
    api.get(`/admin/users/${encodeURIComponent(id)}`),
  );
  return data.customer;
}

export function createCustomer(
  input: CreateCustomerInput,
): Promise<{ customer: CustomerDetail; temporaryPassword: string | null }> {
  return unwrap(api.post('/admin/users', input));
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<CustomerDetail> {
  const data = await unwrap<{ customer: CustomerDetail }>(
    api.put(`/admin/users/${encodeURIComponent(id)}`, input),
  );
  return data.customer;
}

export async function setCustomerStatus(
  id: string,
  status: AccountStatus,
): Promise<CustomerDetail> {
  const data = await unwrap<{ customer: CustomerDetail }>(
    api.patch(`/admin/users/${encodeURIComponent(id)}/status`, { status }),
  );
  return data.customer;
}

export async function uploadCustomerAvatar(id: string, file: File): Promise<CustomerDetail> {
  const form = new FormData();
  form.append('avatar', file);
  const data = await unwrap<{ customer: CustomerDetail }>(
    api.put(`/admin/users/${encodeURIComponent(id)}/avatar`, form),
  );
  return data.customer;
}

export async function deleteCustomerAvatar(id: string): Promise<CustomerDetail> {
  const data = await unwrap<{ customer: CustomerDetail }>(
    api.delete(`/admin/users/${encodeURIComponent(id)}/avatar`),
  );
  return data.customer;
}

/** Image URLs are same-origin, so the session cookie authorises them like any API call. */
export const avatarUrls = {
  admin: (id: string, version: string) =>
    `/api/admin/users/${encodeURIComponent(id)}/avatar?v=${version}`,
  own: (version: string) => `/api/me/avatar?v=${version}`,
};

export function resetCustomerPassword(id: string): Promise<{ temporaryPassword: string }> {
  return unwrap(api.post(`/admin/users/${encodeURIComponent(id)}/reset-password`));
}

export function fetchOwnProfile(): Promise<OwnProfile> {
  return unwrap<OwnProfile>(api.get('/me/profile'));
}

export function updateOwnProfile(input: ProfileFieldsInput): Promise<OwnProfile> {
  return unwrap<OwnProfile>(api.put('/me/profile', input));
}
