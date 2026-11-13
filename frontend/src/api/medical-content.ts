import { api, unwrap } from './client';
import type {
  DisclaimerData,
  MedicalCondition,
} from '../features/medical-content/medical-content.types';

export interface MedicalContentPayload {
  conditions: MedicalCondition[] | null;
  disclaimer: DisclaimerData | null;
  userConditions: Record<string, string> | null;
}

export async function fetchMedicalContent(): Promise<MedicalContentPayload> {
  return unwrap<MedicalContentPayload>(api.get('/medical-content', { skipAuthRefresh: true }));
}

export async function updateMedicalContent(
  payload: Partial<MedicalContentPayload>,
): Promise<MedicalContentPayload> {
  return unwrap<MedicalContentPayload>(api.put('/admin/medical-content', payload));
}
