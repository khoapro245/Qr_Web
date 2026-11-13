export interface DisclaimerItem {
  id: string;
  title: string;
  content: string;
}

export interface DisclaimerData {
  title: string;
  warningText: string;
  items: DisclaimerItem[];
  checkboxLabel: string;
  confirmButtonText: string;
  cancelButtonText: string;
  updatedAt: string;
}

export interface FirstAidStep {
  title: string;
  detail: string;
}

export interface FirstAidTopic {
  id: string;
  title: string;
  summary: string;
  icon: string;
  priorityBadge?: string;
  steps: FirstAidStep[];
  dos?: string[];
  donts?: string[];
  warning?: string;
  order: number;
}

export type DiseaseSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface MedicalCondition {
  id: string;
  name: string;
  description: string;
  icon: string;
  severity: DiseaseSeverity;
  order: number;
  topics: FirstAidTopic[];
}
