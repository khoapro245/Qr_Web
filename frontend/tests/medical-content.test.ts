import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DISCLAIMER_DATA,
  DEFAULT_FIRST_AID_TOPICS,
  DEFAULT_MEDICAL_CONDITIONS,
  STORAGE_KEY_FIRST_AID,
  deleteMedicalCondition,
  deleteTopicFromCondition,
  getDisclaimerData,
  getFirstAidTopics,
  getMedicalCondition,
  getMedicalConditions,
  getUserCondition,
  resetDisclaimerData,
  resetFirstAidTopics,
  resetMedicalConditions,
  saveDisclaimerData,
  saveFirstAidTopics,
  saveMedicalCondition,
  saveTopicForCondition,
  setUserCondition,
} from '../src/features/medical-content/medical-content.storage';
import type { MedicalCondition } from '../src/features/medical-content/medical-content.types';

describe('medical-content.storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('disclaimer data CRUD', () => {
    it('returns default disclaimer data when storage is empty', () => {
      const data = getDisclaimerData();
      expect(data.title).toBe(DEFAULT_DISCLAIMER_DATA.title);
      expect(data.items.length).toBe(DEFAULT_DISCLAIMER_DATA.items.length);
    });

    it('saves and retrieves modified disclaimer data', () => {
      const custom = {
        ...DEFAULT_DISCLAIMER_DATA,
        title: 'Điều khoản miễn trừ trách nhiệm tùy chỉnh',
        items: [
          ...DEFAULT_DISCLAIMER_DATA.items,
          { id: 'custom-1', title: 'Điều 4', content: 'Nội dung điều 4' },
        ],
      };
      saveDisclaimerData(custom);

      const retrieved = getDisclaimerData();
      expect(retrieved.title).toBe('Điều khoản miễn trừ trách nhiệm tùy chỉnh');
      expect(retrieved.items.length).toBe(DEFAULT_DISCLAIMER_DATA.items.length + 1);
    });

    it('resets disclaimer data back to default', () => {
      saveDisclaimerData({
        ...DEFAULT_DISCLAIMER_DATA,
        title: 'Thử nghiệm',
      });
      expect(getDisclaimerData().title).toBe('Thử nghiệm');

      resetDisclaimerData();
      expect(getDisclaimerData().title).toBe(DEFAULT_DISCLAIMER_DATA.title);
    });
  });

  describe('medical conditions CRUD', () => {
    it('returns default medical conditions when storage is empty', () => {
      const conditions = getMedicalConditions();
      expect(conditions.length).toBe(DEFAULT_MEDICAL_CONDITIONS.length);
      expect(conditions.some((c) => c.id === 'epilepsy')).toBe(true);
      expect(conditions.some((c) => c.id === 'asthma')).toBe(true);
      expect(conditions.some((c) => c.id === 'cardiovascular')).toBe(true);
    });

    it('adds, updates, and deletes a medical condition', () => {
      const newCondition: MedicalCondition = {
        id: 'heatstroke',
        name: 'Say nắng & Sốc nhiệt',
        description: 'Thân nhiệt cao, mất nước cấp',
        icon: 'Flame',
        severity: 'high',
        order: 8,
        topics: [],
      };

      saveMedicalCondition(newCondition);
      expect(getMedicalCondition('heatstroke')).toBeDefined();
      expect(getMedicalCondition('heatstroke')?.name).toBe('Say nắng & Sốc nhiệt');

      // Update
      saveMedicalCondition({
        ...newCondition,
        name: 'Sốc nhiệt nguy kịch',
      });
      expect(getMedicalCondition('heatstroke')?.name).toBe('Sốc nhiệt nguy kịch');

      // Delete
      deleteMedicalCondition('heatstroke');
      expect(getMedicalCondition('heatstroke')).toBeUndefined();
    });

    it('manages topics for a specific condition', () => {
      const topic = {
        id: 'test-topic',
        title: 'Xử lý hạ sốt khẩn cấp',
        summary: 'Chườm mát và bù nước',
        icon: 'Flame',
        order: 1,
        steps: [{ title: 'Chườm khăn ấm', detail: 'Chườm trán, nách, bẹn' }],
      };

      saveTopicForCondition('trauma', topic);
      const trauma = getMedicalCondition('trauma');
      expect(trauma?.topics.some((t) => t.id === 'test-topic')).toBe(true);

      deleteTopicFromCondition('trauma', 'test-topic');
      const traumaAfter = getMedicalCondition('trauma');
      expect(traumaAfter?.topics.some((t) => t.id === 'test-topic')).toBe(false);
    });

    it('resets medical conditions to defaults', () => {
      deleteMedicalCondition('epilepsy');
      expect(getMedicalCondition('epilepsy')).toBeUndefined();

      resetMedicalConditions();
      expect(getMedicalCondition('epilepsy')).toBeDefined();
    });
  });

  describe('user condition mapping', () => {
    it('sets and gets associated condition for user', () => {
      expect(getUserCondition('0987655433')).toBeNull();

      setUserCondition('0987655433', 'asthma');
      expect(getUserCondition('0987655433')).toBe('asthma');

      setUserCondition('0987655433', null);
      expect(getUserCondition('0987655433')).toBeNull();
    });
  });

  describe('first aid topics CRUD (flat / backwards compatibility)', () => {
    it('returns default first aid topics when storage is empty', () => {
      const topics = getFirstAidTopics();
      expect(topics.length).toBe(DEFAULT_FIRST_AID_TOPICS.length);
      expect(topics[0]?.title).toContain('DRCAB');
    });

    it('saves, adds, and removes first aid topics', () => {
      const current = getFirstAidTopics();
      const newTopic = {
        id: 'heatstroke',
        title: '7. Say nắng & Sốc nhiệt',
        summary: 'Hạ thân nhiệt khẩn cấp',
        icon: 'Flame',
        order: 7,
        steps: [{ title: 'Đưa vào bóng râm', detail: 'Quạt mát và cởi bớt áo' }],
      };

      saveFirstAidTopics([...current, newTopic]);
      const updated = getFirstAidTopics();
      expect(updated.length).toBe(current.length + 1);
      expect(updated.find((t) => t.id === 'heatstroke')).toBeDefined();

      // Delete topic
      saveFirstAidTopics(updated.filter((t) => t.id !== 'heatstroke'));
      const afterDelete = getFirstAidTopics();
      expect(afterDelete.length).toBe(current.length);
    });

    it('resets topics back to medical defaults', () => {
      localStorage.setItem(STORAGE_KEY_FIRST_AID, JSON.stringify([]));
      resetFirstAidTopics();
      expect(getFirstAidTopics().length).toBe(DEFAULT_FIRST_AID_TOPICS.length);
    });
  });
});
