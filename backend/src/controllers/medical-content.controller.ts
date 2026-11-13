import type { Request, Response } from 'express';
import {
  getAllMedicalContent,
  updateAllMedicalContent,
} from '../services/medical-content.service.js';

export async function getPublicMedicalContent(_req: Request, res: Response): Promise<void> {
  const content = await getAllMedicalContent();
  res.json({
    success: true,
    data: content,
  });
}

export async function updateAdminMedicalContent(req: Request, res: Response): Promise<void> {
  const { conditions, disclaimer, userConditions } = req.body as {
    conditions?: unknown;
    disclaimer?: unknown;
    userConditions?: unknown;
  };
  await updateAllMedicalContent({ conditions, disclaimer, userConditions });
  const updated = await getAllMedicalContent();
  res.json({
    success: true,
    data: updated,
  });
}
