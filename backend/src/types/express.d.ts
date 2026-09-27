import type { UserRole } from '@qrcare/shared';

export interface AuthContext {
  userId: string;
  role: UserRole;
  sessionId: string;
  mustChangePassword: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by the `authenticate` middleware. */
    auth?: AuthContext;
  }
}
