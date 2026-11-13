import { describe, expect, it } from 'vitest';
import {
  buildEmergencyMessage,
  createGoogleMapsUrl,
  createSmsUrl,
  formatZaloPhone,
} from '../src/features/emergency/emergency';

describe('emergency utilities', () => {
  it('normalises Vietnamese phone numbers for Zalo deep links', () => {
    expect(formatZaloPhone('+84987654321')).toBe('0987654321');
    expect(formatZaloPhone('84987654321')).toBe('0987654321');
    expect(formatZaloPhone('0987654321')).toBe('0987654321');
    expect(formatZaloPhone('+84 987 654 321')).toBe('0987654321');
  });

  it('builds standard Google Maps URL from latitude and longitude', () => {
    expect(createGoogleMapsUrl(21.028511, 105.854167)).toBe(
      'https://www.google.com/maps?q=21.028511,105.854167',
    );
  });

  it('builds clear emergency message with victim name and map link', () => {
    const msg = buildEmergencyMessage('Khoa Kiều Văn', 'https://www.google.com/maps?q=21,105');
    expect(msg).toContain('Khoa Kiều Văn');
    expect(msg).toContain('https://www.google.com/maps?q=21,105');
    expect(msg).toContain('CẢNH BÁO KHẨN CẤP');
  });

  it('creates SMS uri with pre-filled body', () => {
    const sms = createSmsUrl('+84987654321', 'Cứu hộ khẩn cấp');
    expect(sms).toMatch(/^sms:\+84987654321[?&]body=/);
    expect(sms).toContain(encodeURIComponent('Cứu hộ khẩn cấp'));
  });
});
