import { todayInTimeZone } from '@qrcare/shared';
import { useFormContext } from 'react-hook-form';
import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { BLOOD_GROUP_OPTIONS, GENDER_OPTIONS } from '../../lib/format';
import type { LoginFormValues, ProfileFormValues } from './form-values';

/** The profile inputs; used inside a FormProvider whose values include ProfileFormValues. */
export function ProfileFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField
          label="Họ và tên"
          autoComplete="off"
          required
          error={errors.fullName?.message}
          {...register('fullName')}
        />
      </div>
      <TextField
        label="Ngày sinh"
        type="date"
        min="1900-01-01"
        max={todayInTimeZone()}
        required
        hint="Tuổi được tính tự động từ ngày sinh."
        error={errors.dateOfBirth?.message}
        {...register('dateOfBirth')}
      />
      <SelectField
        label="Giới tính"
        required
        placeholder="Chọn giới tính"
        options={GENDER_OPTIONS}
        error={errors.gender?.message}
        {...register('gender')}
      />
      <div className="sm:col-span-2">
        <TextAreaField
          label="Địa chỉ"
          rows={2}
          error={errors.address?.message}
          {...register('address')}
        />
      </div>
      <TextField
        label="SĐT gia đình"
        type="tel"
        inputMode="tel"
        required
        hint="Số người thân để liên hệ khi cần giúp đỡ."
        error={errors.familyPhone?.message}
        {...register('familyPhone')}
      />
      <SelectField
        label="Nhóm máu"
        options={BLOOD_GROUP_OPTIONS}
        error={errors.bloodGroup?.message}
        {...register('bloodGroup')}
      />
      <TextField
        label="Cân nặng (kg)"
        inputMode="decimal"
        error={errors.weightKg?.message}
        {...register('weightKg')}
      />
      <TextField
        label="Chiều cao (cm)"
        inputMode="decimal"
        error={errors.heightCm?.message}
        {...register('heightCm')}
      />
    </div>
  );
}

/** Email + phone used to log in (admin forms only). */
export function LoginIdentifierFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<LoginFormValues>();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Email"
        type="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Số điện thoại di động"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <p className="text-sm text-fg-muted sm:col-span-2">
        Cần ít nhất một trong hai. Khách hàng dùng email hoặc số điện thoại này để đăng nhập.
      </p>
    </div>
  );
}
