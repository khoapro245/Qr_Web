import type { CustomerProfileView } from '@qrcare/shared';
import { formatPhone } from '../../lib/format';

/** Raw string values of the profile inputs, as the HTML controls hold them. */
export interface ProfileFormValues {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  familyPhone: string;
  bloodGroup: string;
  weightKg: string;
  heightCm: string;
}

export interface LoginFormValues {
  email: string;
  phone: string;
}

export const EMPTY_PROFILE: ProfileFormValues = {
  fullName: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  familyPhone: '',
  bloodGroup: 'UNKNOWN',
  weightKg: '',
  heightCm: '',
};

export function toProfileFormValues(profile: CustomerProfileView): ProfileFormValues {
  return {
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    address: profile.address ?? '',
    familyPhone: formatPhone(profile.familyPhone),
    bloodGroup: profile.bloodGroup,
    weightKg: profile.weightKg === null ? '' : String(profile.weightKg),
    heightCm: profile.heightCm === null ? '' : String(profile.heightCm),
  };
}

export const PROFILE_FIELD_NAMES = [
  'fullName',
  'dateOfBirth',
  'gender',
  'address',
  'familyPhone',
  'bloodGroup',
  'weightKg',
  'heightCm',
] as const;
