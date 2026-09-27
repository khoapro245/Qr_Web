import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { createRateLimiters } from './middleware/rate-limit.js';
import { createApiRouter } from './routes/index.js';

export interface AppOptions {
  /** Rate limiting is on everywhere except the test suite, which enables it explicitly. */
  rateLimit?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const limiters = createRateLimiters(options.rateLimit ?? env.NODE_ENV !== 'test');

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(httpLogger);
  app.use(
    helmet({
      // The API only serves JSON and images; lock it down completely.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      // QR URLs contain a secret token; never leak it to other sites via the Referer header.
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
  app.use('/api', limiters.api);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', csrfProtection);

  // API responses may contain personal data: never let browsers or proxies cache them.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', createApiRouter(limiters));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
