import type { PublicProfile } from '@qrcare/shared';
import { api, unwrap } from './client';

export async function fetchPublicProfile(token: string): Promise<PublicProfile> {
  const data = await unwrap<{ profile: PublicProfile }>(
    api.get(`/qr/${encodeURIComponent(token)}`, { skipAuthRefresh: true }),
  );
  return data.profile;
}
