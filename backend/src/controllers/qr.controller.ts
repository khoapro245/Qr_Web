import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAuth } from '../middleware/authenticate.js';
import { parseInput } from '../middleware/validate.js';
import * as qr from '../services/qr.service.js';
import { customerId } from './params.js';

const imageQuerySchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
  download: z
    .enum(['0', '1'])
    .optional()
    .transform((value) => value === '1'),
});

export async function show(req: Request, res: Response) {
  res.json({ success: true, data: await qr.getCustomerQr(customerId(req)) });
}

export async function generate(req: Request, res: Response) {
  const data = await qr.generateQr(getAuth(req).userId, customerId(req));
  res.status(201).json({ success: true, data });
}

export async function regenerate(req: Request, res: Response) {
  const data = await qr.regenerateQr(getAuth(req).userId, customerId(req));
  res.status(201).json({ success: true, data });
}

export async function revoke(req: Request, res: Response) {
  res.json({ success: true, data: await qr.revokeQr(getAuth(req).userId, customerId(req)) });
}

export async function image(req: Request, res: Response) {
  const id = customerId(req);
  const { format, download } = parseInput(imageQuerySchema, req.query);
  const rendered = await qr.renderQrImage(id, format);
  res.type(rendered.contentType);
  if (download) res.attachment(rendered.filename);
  else res.setHeader('Content-Disposition', 'inline');
  res.send(rendered.data);
}
