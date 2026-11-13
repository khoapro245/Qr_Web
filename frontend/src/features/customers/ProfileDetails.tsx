import type { CustomerProfileView } from '@qrcare/shared';
import { Badge } from '../../components/ui/Badge';
import { DescriptionList } from '../../components/ui/DescriptionList';
import {
  BLOOD_GROUP_LABELS,
  formatDate,
  formatMeasurement,
  formatPhone,
  GENDER_LABELS,
} from '../../lib/format';
import { MedicalIcon } from '../medical-content/icon-map';
import { getMedicalCondition, getUserCondition } from '../medical-content/medical-content.storage';

export function ProfileDetails({ profile }: { profile: CustomerProfileView }) {
  const condId =
    getUserCondition(profile.familyPhone) ||
    getUserCondition(profile.fullName) ||
    getUserCondition('current_user') ||
    'trauma';
  const condition = getMedicalCondition(condId);

  const conditionDisplay = condition ? (
    <div className="flex flex-wrap items-center gap-2">
      <MedicalIcon name={condition.icon} className="size-4 shrink-0 text-primary" />
      <span className="font-semibold text-fg">{condition.name}</span>
      <Badge
        tone={
          condition.severity === 'critical' || condition.severity === 'high'
            ? 'danger'
            : condition.severity === 'medium'
              ? 'info'
              : 'neutral'
        }
      >
        {condition.severity === 'critical'
          ? 'Nguy kịch'
          : condition.severity === 'high'
            ? 'Nguy hiểm'
            : condition.severity === 'medium'
              ? 'Cần xử lý ngay'
              : 'Theo dõi'}
      </Badge>
    </div>
  ) : (
    'Chấn thương & Tai nạn thông thường'
  );

  return (
    <DescriptionList
      items={[
        { label: 'Họ và tên', value: profile.fullName, wide: true },
        { label: 'Bệnh lý nền đi kèm', value: conditionDisplay, wide: true },
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
