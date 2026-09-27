import { forgotPasswordSchema, resetPasswordSchema, verifyOtpSchema } from '@qrcare/shared';
import type { Request, Response } from 'express';
import { parseInput } from '../middleware/validate.js';
import * as passwordReset from '../services/password-reset.service.js';

export async function forgotPassword(req: Request, res: Response) {
  const { identifier } = parseInput(forgotPasswordSchema, req.body);
  await passwordReset.requestPasswordReset(identifier);
  // Identical answer whether or not an account matched.
  res.json({ success: true, data: { accepted: true } });
}

export async function verifyOtp(req: Request, res: Response) {
  const { identifier, otp } = parseInput(verifyOtpSchema, req.body);
  res.json({ success: true, data: await passwordReset.verifyResetOtp(identifier, otp) });
}

export async function resetPassword(req: Request, res: Response) {
  await passwordReset.resetPassword(parseInput(resetPasswordSchema, req.body));
  res.json({ success: true, data: null });
}
