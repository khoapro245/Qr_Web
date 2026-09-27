import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMeasurement, formatPhone } from '../src/lib/format';

describe('formatting', () => {
  it('formats dates of birth without time-zone shifts', () => {
    expect(formatDate('2006-03-19')).toBe('19/03/2006');
  });

  it('formats timestamps in Vietnam time with a four-digit year', () => {
    expect(formatDateTime('2026-09-27T07:05:00.000Z')).toBe('27/09/2026 14:05');
    // Late UTC evening is already the next day in Vietnam.
    expect(formatDateTime('2025-12-31T20:00:00.000Z')).toBe('01/01/2026 03:00');
  });

  it('formats phones and measurements for display', () => {
    expect(formatPhone('+84912345678')).toBe('0912 345 678');
    expect(formatPhone('+842838234567')).toBe('028 3823 4567');
    expect(formatPhone(null)).toBe('');
    expect(formatMeasurement(60.5, 'kg')).toBe('60,5 kg');
    expect(formatMeasurement(null, 'kg')).toBeNull();
  });
});
