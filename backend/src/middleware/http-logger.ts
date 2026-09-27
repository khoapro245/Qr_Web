import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger, redactUrl } from '../utils/logger.js';
import { serializeError } from '../utils/safe-error.js';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (_req, res) => {
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Only log what is needed to trace a request. Headers are deliberately excluded because
  // they carry session cookies.
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: redactUrl(req.url),
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    err: serializeError,
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: { ignore: (req) => req.url === '/api/health' },
});
