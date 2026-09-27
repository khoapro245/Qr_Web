import { USER_ROLES, type UserRole } from '@qrcare/shared';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { ACCESS_TOKEN_TTL_SECONDS } from '../config/auth.js';
import { env } from '../config/env.js';

const secretKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = 'qrcare-api';
const AUDIENCE = 'qrcare-web';

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
  /** The refresh-token family this access token belongs to; revoking it ends the session. */
  sessionId: string;
  issuedAt: number;
}

const payloadSchema = z.object({
  sub: z.uuid(),
  role: z.enum(USER_ROLES),
  sid: z.uuid(),
  iat: z.number().int(),
});

export function signAccessToken(claims: Omit<AccessTokenClaims, 'issuedAt'>): Promise<string> {
  return new SignJWT({ role: claims.role, sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey);
}

/** Returns the claims of a valid token, or null for any invalid/expired/forged token. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    return {
      userId: parsed.data.sub,
      role: parsed.data.role,
      sessionId: parsed.data.sid,
      issuedAt: parsed.data.iat,
    };
  } catch {
    return null;
  }
}
