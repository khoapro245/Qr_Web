import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Resource not found' });
};

function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
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

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ success: false, code: 'INVALID_JSON', message: 'Malformed JSON body' });
      return;
    }
    if (err.type === 'entity.too.large') {
      res
        .status(413)
        .json({ success: false, code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' });
      return;
    }
  }

  // Unexpected: log full detail server-side, return a generic message so stack traces and
  // database errors never reach the client.
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
};
