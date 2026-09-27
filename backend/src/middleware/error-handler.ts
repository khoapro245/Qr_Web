import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Resource not found' });
};

/** Errors raised by Express/body-parser for bad requests carry a 4xx `status`. */
function clientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null || !('status' in err)) return undefined;
  const { status } = err;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

function errorType(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string'
    ? err.type
    : undefined;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined && { details: err.details }),
    });
    return;
  }

  const status = clientErrorStatus(err);
  if (status !== undefined) {
    const type = errorType(err);
    const [code, message] =
      type === 'entity.parse.failed'
        ? ['INVALID_JSON', 'Malformed JSON body']
        : type === 'entity.too.large'
          ? ['PAYLOAD_TOO_LARGE', 'Request body too large']
          : // e.g. malformed %-encoding in the URL, unsupported charset
            ['BAD_REQUEST', 'The request could not be understood'];
    res.status(status).json({ success: false, code, message });
    return;
  }

  // Unexpected: log server-side (the logger strips values from database errors) and return
  // a generic message so stack traces and database errors never reach the client.
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
};
