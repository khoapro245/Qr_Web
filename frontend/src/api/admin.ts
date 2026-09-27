import type { DashboardStats } from '@qrcare/shared';
import { api, unwrap } from './client';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const data = await unwrap<{ stats: DashboardStats }>(api.get('/admin/dashboard'));
  return data.stats;
}
