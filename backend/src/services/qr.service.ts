import type { CustomerQrInfo, QrCodeView } from '@qrcare/shared';
import QRCode, { type QRCodeRenderersOptions } from 'qrcode';
import { env } from '../config/env.js';
import { db, type DbExecutor } from '../db/client.js';
import type { QrCode } from '../db/schema.js';
import { findCustomerById } from '../repositories/customer.repository.js';
import {
  findActiveQr,
  insertQr,
  listQrCodes,
  lockCustomerForQrChange,
  revokeQrById,
} from '../repositories/qr.repository.js';
import { AppError } from '../utils/app-error.js';
import { randomToken } from '../utils/crypto.js';
import { uniqueViolationConstraint } from '../utils/pg-errors.js';
import { recordAudit } from './audit.service.js';

/**
 * 128 bits from the OS CSPRNG, base64url-encoded (22 characters). The token is pure
 * randomness: it is not derived from the user id, phone, birth date or anything else, so a
 * code cannot be guessed or enumerated. 128 bits keeps the QR small enough to scan well on
 * fabric while being far beyond brute-force reach.
 */
export function generateQrToken(): string {
  return randomToken(16);
}

export function publicQrUrl(token: string): string {
  return `${env.PUBLIC_QR_BASE_URL}/qr/${token}`;
}

export function toQrView(row: QrCode): QrCodeView {
  const active = row.status === 'ACTIVE';
  return {
    id: row.id,
    status: row.status,
    // Revoked links no longer work, but there is no reason to hand them out either.
    url: active ? publicQrUrl(row.token) : null,
    tokenHint: row.token.slice(-4),
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

const customerNotFound = () => new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
const noActiveQr = () => new AppError(404, 'QR_NOT_FOUND', 'This customer has no active QR code');

async function requireCustomerName(customerId: string): Promise<string> {
  const record = await findCustomerById(customerId);
  if (!record) throw customerNotFound();
  return record.profile.fullName;
}

/**
 * Creates the active QR code for a customer inside an existing transaction. The partial
 * unique index guarantees a second concurrent ACTIVE code fails instead of slipping in.
 */
export async function issueQr(
  customerId: string,
  adminId: string,
  tx: DbExecutor,
  previousQrId: string | null = null,
): Promise<QrCode> {
  const qr = await insertQr(
    { userId: customerId, token: generateQrToken(), createdById: adminId },
    tx,
  );
  await recordAudit(
    {
      actorUserId: adminId,
      action: previousQrId ? 'QR_REGENERATED' : 'QR_GENERATED',
      targetUserId: customerId,
      // Internal ids only — never the token, which is the secret part of the link.
      metadata: previousQrId ? { qrId: qr.id, previousQrId } : { qrId: qr.id },
    },
    tx,
  );
  return qr;
}

export async function getCustomerQr(customerId: string): Promise<CustomerQrInfo> {
  await requireCustomerName(customerId);
  const rows = await listQrCodes(customerId);
  const history = rows.map(toQrView);
  return { current: history.find((qr) => qr.status === 'ACTIVE') ?? null, history };
}

/** Runs a QR change with the customer locked, so concurrent changes happen one at a time. */
async function withCustomerLocked(
  customerId: string,
  change: (tx: DbExecutor) => Promise<void>,
): Promise<CustomerQrInfo> {
  try {
    await db.transaction(async (tx) => {
      if (!(await lockCustomerForQrChange(customerId, tx))) throw customerNotFound();
      await change(tx);
    });
  } catch (err) {
    // Safety net: the database index still forbids two active codes.
    if (uniqueViolationConstraint(err) === 'qr_codes_one_active_per_user') throw qrAlreadyActive();
    throw err;
  }
  return getCustomerQr(customerId);
}

export function generateQr(adminId: string, customerId: string): Promise<CustomerQrInfo> {
  return withCustomerLocked(customerId, async (tx) => {
    if (await findActiveQr(customerId, tx)) throw qrAlreadyActive();
    await issueQr(customerId, adminId, tx);
  });
}

function qrAlreadyActive() {
  return new AppError(
    409,
    'QR_ALREADY_ACTIVE',
    'This customer already has an active QR code; regenerate it instead',
  );
}

/**
 * Revokes the current code (if any) and issues a new one atomically. The old printed QR
 * stops exposing the profile immediately.
 */
export function regenerateQr(adminId: string, customerId: string): Promise<CustomerQrInfo> {
  return withCustomerLocked(customerId, async (tx) => {
    const current = await findActiveQr(customerId, tx);
    if (current) await revokeQrById(current.id, adminId, new Date(), tx);
    await issueQr(customerId, adminId, tx, current?.id ?? null);
  });
}

export function revokeQr(adminId: string, customerId: string): Promise<CustomerQrInfo> {
  return withCustomerLocked(customerId, async (tx) => {
    const current = await findActiveQr(customerId, tx);
    if (!current) throw noActiveQr();
    await revokeQrById(current.id, adminId, new Date(), tx);
    await recordAudit(
      {
        actorUserId: adminId,
        action: 'QR_REVOKED',
        targetUserId: customerId,
        metadata: { qrId: current.id },
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------------------
// Rendering

export type QrImageFormat = 'png' | 'svg';

// Error correction "Q" survives ~25% damage (creases, wear on fabric). A 4-module quiet
// zone is what scanners expect. Pure black on white gives the most reliable scans.
const RENDER_OPTIONS: QRCodeRenderersOptions & { errorCorrectionLevel: 'Q' } = {
  errorCorrectionLevel: 'Q',
  margin: 4,
  color: { dark: '#000000', light: '#ffffff' },
};
const PNG_WIDTH = 1024;

/** ASCII file-name slug from a Vietnamese name: "Nguyễn Văn Đức" → "nguyen-van-duc". */
export function fileSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'khach-hang';
}

export async function renderQrImage(
  customerId: string,
  format: QrImageFormat,
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const name = await requireCustomerName(customerId);
  const qr = await findActiveQr(customerId);
  if (!qr) throw noActiveQr();

  const url = publicQrUrl(qr.token);
  const filename = `qrcare-${fileSlug(name)}.${format}`;
  if (format === 'png') {
    const data = await QRCode.toBuffer(url, { ...RENDER_OPTIONS, type: 'png', width: PNG_WIDTH });
    return { data, contentType: 'image/png', filename };
  }
  const svg = await QRCode.toString(url, { ...RENDER_OPTIONS, type: 'svg' });
  return { data: Buffer.from(svg), contentType: 'image/svg+xml', filename };
}
