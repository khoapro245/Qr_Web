import {
  Activity,
  AlertOctagon,
  Bone,
  CheckCircle2,
  Droplet,
  Flame,
  HeartPulse,
  Phone,
  ShieldAlert,
  Wind,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { createElement } from 'react';

export const MEDICAL_ICONS: Record<string, LucideIcon> = {
  Activity,
  HeartPulse,
  ShieldAlert,
  Droplet,
  Bone,
  Wind,
  Flame,
  AlertOctagon,
  Phone,
  CheckCircle2,
  XCircle,
};

export const AVAILABLE_ICON_KEYS = [
  'HeartPulse',
  'Activity',
  'ShieldAlert',
  'Droplet',
  'Bone',
  'Wind',
  'Flame',
  'AlertOctagon',
] as const;

export function getMedicalIcon(name: string): LucideIcon {
  return MEDICAL_ICONS[name] || HeartPulse;
}

export function MedicalIcon({
  name,
  className,
  'aria-hidden': ariaHidden = true,
}: {
  name: string;
  className?: string;
  'aria-hidden'?: boolean;
}) {
  const Icon = MEDICAL_ICONS[name] || HeartPulse;
  return createElement(Icon, { 'aria-hidden': ariaHidden, className });
}
