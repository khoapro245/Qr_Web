import { AVATAR_MAX_BYTES } from '@qrcare/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../utils/app-error.js';

// Kept in memory: the file is small (size-limited), fully validated and re-encoded before
// anything is written to storage.
const avatarMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0, parts: 1 },
}).single('avatar');

/** Accepts exactly one file in the `avatar` multipart field and nothing else. */
export const avatarUpload: RequestHandler = (req, res, next) => {
  avatarMulter(req, res, (err: unknown) => {
    if (!err) {
      if (!req.file) {
        next(new AppError(400, 'FILE_REQUIRED', 'An image file is required in field "avatar"'));
        return;
      }
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(413, 'FILE_TOO_LARGE', 'Image must be at most 5 MB'));
      return;
    }
    // Everything else here is a malformed request: multer limit errors, or parser errors from
    // busboy ("Unexpected end of form", bad part headers) that are not MulterErrors. Either
    // way it is the client's fault, never a 500.
    next(new AppError(400, 'INVALID_UPLOAD', 'Invalid upload'));
  });
};
