export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Today's calendar date (YYYY-MM-DD) in the given time zone, independent of the host clock zone. */
export function todayInTimeZone(timeZone: string = APP_TIME_ZONE, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseIsoDate(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year ?? 0, month ?? 0, day ?? 0];
}

/**
 * Whole years between a date of birth and `today` (both YYYY-MM-DD). The birthday counts from
 * the day itself; someone born on 29 Feb turns a year older on 1 Mar in non-leap years.
 * Age is never stored or accepted from clients — always derive it with this function.
 */
export function calculateAge(dateOfBirth: string, today: string = todayInTimeZone()): number {
  const [birthYear, birthMonth, birthDay] = parseIsoDate(dateOfBirth);
  const [year, month, day] = parseIsoDate(today);
  const hadBirthdayThisYear = month > birthMonth || (month === birthMonth && day >= birthDay);
  return Math.max(0, year - birthYear - (hadBirthdayThisYear ? 0 : 1));
}
