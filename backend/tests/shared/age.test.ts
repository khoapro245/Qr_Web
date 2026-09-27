import { calculateAge, todayInTimeZone } from '@qrcare/shared';
import { describe, expect, it } from 'vitest';

describe('calculateAge', () => {
  // The example from the specification (§4).
  it('is 20 before the 21st birthday and 21 from the birthday on', () => {
    expect(calculateAge('2006-03-19', '2026-09-27')).toBe(20);
    expect(calculateAge('2006-03-19', '2027-03-18')).toBe(20);
    expect(calculateAge('2006-03-19', '2027-03-19')).toBe(21);
    expect(calculateAge('2006-03-19', '2027-03-20')).toBe(21);
  });

  it('handles 29 February birthdays in non-leap years', () => {
    expect(calculateAge('2004-02-29', '2025-02-28')).toBe(20);
    expect(calculateAge('2004-02-29', '2025-03-01')).toBe(21);
    expect(calculateAge('2004-02-29', '2028-02-29')).toBe(24);
  });

  it('returns 0 for babies and never a negative age', () => {
    expect(calculateAge('2026-09-01', '2026-09-27')).toBe(0);
    expect(calculateAge('2030-01-01', '2026-09-27')).toBe(0);
  });
});

describe('todayInTimeZone', () => {
  it('uses the Vietnam calendar date, not UTC', () => {
    // 20:00 UTC on 31 Dec is already 1 Jan (03:00) in Vietnam.
    const instant = new Date('2025-12-31T20:00:00Z');
    expect(todayInTimeZone('Asia/Ho_Chi_Minh', instant)).toBe('2026-01-01');
    expect(todayInTimeZone('UTC', instant)).toBe('2025-12-31');
  });
});
