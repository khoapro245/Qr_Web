import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { createFrontendRouter } from './http/frontend.js';
import { csrfProtection, isAllowedOrigin } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/http-logger.js';
import { createRateLimiters } from './middleware/rate-limit.js';
import { rejectNullBytes } from './middleware/reject-null-bytes.js';
import { createApiRouter } from './routes/index.js';

export interface AppOptions {
  /** Rate limiting is on everywhere except the test suite, which enables it explicitly. */
  rateLimit?: boolean;
  /** Built frontend to serve next to the API (production). Defaults to FRONTEND_DIST_DIR. */
  frontendDir?: string;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const limiters = createRateLimiters(options.rateLimit ?? env.NODE_ENV !== 'test');
  const frontendDir = options.frontendDir ?? env.FRONTEND_DIST_DIR;

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(httpLogger);
  app.use(
    helmet({
      // The API only serves JSON and images; lock it down completely. HTML pages of the
      // frontend replace this with their own policy (see http/frontend.ts).
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      // QR URLs contain a secret token; never leak it to other sites via the Referer header.
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  // Text responses (JS, CSS, HTML, JSON) are compressed; images are left as they are.
  app.use(compression());
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || isAllowedOrigin(requestOrigin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    }),
  );
  app.use('/api', limiters.api);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', csrfProtection);
  app.use('/api', rejectNullBytes);

  // API responses may contain personal data: never let browsers or proxies cache them.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', createApiRouter(limiters));
  if (frontendDir) app.use(createFrontendRouter(frontendDir));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
