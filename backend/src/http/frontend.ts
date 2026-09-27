import express, { Router } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Same policy as the <meta> tag in the built index.html, plus frame-ancestors (which only
 * works as a header) to stop the app being embedded by other sites (clickjacking).
 */
const SPA_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Paths that look like files (have an extension) are never answered with index.html. */
const LOOKS_LIKE_FILE = /\/[^/]+\.[a-z0-9]+$/i;

/**
 * Serves the built single-page app from the same origin as the API, so production needs
 * only one process behind the TLS proxy.
 */
export function createFrontendRouter(distDir: string): Router {
  const root = resolve(distDir);
  const indexHtml = join(root, 'index.html');
  if (!existsSync(indexHtml)) {
    throw new Error(`FRONTEND_DIST_DIR has no index.html: ${root}`);
  }

  const router = Router();

  // The whole app (including public QR pages) is personal: keep every page out of search.
  router.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });

  // Vite fingerprints everything under /assets, so it can be cached forever.
  router.use(
    '/assets',
    express.static(join(root, 'assets'), { immutable: true, maxAge: '1y', index: false }),
  );
  // Un-fingerprinted files (favicon, theme script): short cache.
  router.use(express.static(root, { index: false, maxAge: '1h' }));

  // Client-side routes (/login, /admin/..., /qr/<token>) all load index.html.
  router.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/') || LOOKS_LIKE_FILE.test(req.path)) {
      next();
      return;
    }
    res.setHeader('Content-Security-Policy', SPA_CONTENT_SECURITY_POLICY);
    // Always revalidate the entry page so a new release is picked up immediately.
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });

  return router;
}
