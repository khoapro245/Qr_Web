import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import type { StoredObject } from '../providers/storage/index.js';
import * as avatars from '../services/avatar.service.js';
import { AppError } from '../utils/app-error.js';
import { customerId } from './params.js';

export function sendImage(res: Response, image: StoredObject): void {
  res.type(image.contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.send(image.data);
}

export async function upload(req: Request, res: Response) {
  const id = customerId(req);
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'An image file is required');
  const customer = await avatars.setCustomerAvatar(getAuth(req).userId, id, req.file.buffer);
  res.json({ success: true, data: { customer } });
}

export async function remove(req: Request, res: Response) {
  const customer = await avatars.removeCustomerAvatar(getAuth(req).userId, customerId(req));
  res.json({ success: true, data: { customer } });
}

export async function show(req: Request, res: Response) {
  sendImage(res, await avatars.loadCustomerAvatar(customerId(req)));
}

export async function showOwn(req: Request, res: Response) {
  sendImage(res, await avatars.loadCustomerAvatar(getAuth(req).userId));
}
