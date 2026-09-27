const UNIQUE_VIOLATION = '23505';

/**
 * If `err` (raw pg error or Drizzle-wrapped) is a unique-constraint violation, returns the
 * constraint name; otherwise undefined.
 */
export function uniqueViolationConstraint(err: unknown): string | undefined {
  let current: unknown = err;
  while (current && typeof current === 'object') {
    if ('code' in current && current.code === UNIQUE_VIOLATION && 'constraint' in current) {
      return typeof current.constraint === 'string' ? current.constraint : undefined;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}
