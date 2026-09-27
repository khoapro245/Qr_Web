import type { CustomerProfileView } from '@qrcare/shared';
import { DescriptionList } from '../../components/ui/DescriptionList';
import {
  BLOOD_GROUP_LABELS,
  formatDate,
  formatMeasurement,
  formatPhone,
  GENDER_LABELS,
} from '../../lib/format';

export function ProfileDetails({ profile }: { profile: CustomerProfileView }) {
  return (
    <DescriptionList
      items={[
        { label: 'Họ và tên', value: profile.fullName, wide: true },
        { label: 'Ngày sinh', value: formatDate(profile.dateOfBirth) },
        { label: 'Tuổi', value: profile.age },
        { label: 'Giới tính', value: GENDER_LABELS[profile.gender] },
        { label: 'Nhóm máu', value: BLOOD_GROUP_LABELS[profile.bloodGroup] },
        { label: 'Địa chỉ', value: profile.address, wide: true },
        { label: 'SĐT gia đình', value: formatPhone(profile.familyPhone) },
        { label: 'Cân nặng', value: formatMeasurement(profile.weightKg, 'kg') },
        { label: 'Chiều cao', value: formatMeasurement(profile.heightCm, 'cm') },
      ]}
    />
  );
}
