import { stdSerializers } from 'pino';

// PostgreSQL error fields that are safe to log: codes and object names, never row values.
const SAFE_PG_FIELDS = ['code', 'constraint', 'table', 'column', 'schema', 'routine'] as const;

function pickPgFields(cause: unknown): Record<string, unknown> | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const source = cause as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of SAFE_PG_FIELDS) if (source[key] !== undefined) picked[key] = source[key];
  // The message names the constraint/type but not the values (unlike `detail`).
  if (typeof source.message === 'string') picked.message = source.message;
  return picked;
}

function isQueryError(err: unknown): err is Error & { query: string; params: unknown[] } {
  return err instanceof Error && 'query' in err && 'params' in err;
}

/**
 * Stack frames only. The stack starts with the message, which can span several lines
 * (Drizzle appends "params: ..." on its own line), so keep just the "at ..." frames.
 */
function framesOnly(stack: string | undefined): string | undefined {
  return stack
    ?.split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');
}

/**
 * Error serializer for all logs. Database errors otherwise carry the query parameters —
 * emails, phone numbers, names, password hashes — and PostgreSQL's `detail` repeats the
 * offending values ("Key (email)=(a@b.c) already exists"). Only the SQL text (which uses
 * placeholders), error codes and object names are kept.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (isQueryError(err)) {
    return {
      type: err.name,
      message: 'Database query failed',
      query: err.query,
      cause: pickPgFields(err.cause),
      stack: framesOnly(err.stack),
    };
  }
  const serialized = stdSerializers.err(err as Error) as unknown as Record<string, unknown>;
  const { params: _params, detail: _detail, where: _where, ...safe } = serialized;
  return safe;
}
