import { AVATAR_MIN_DIMENSION } from '@qrcare/shared';
import sharp from 'sharp';
import { AppError } from './app-error.js';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
export const AVATAR_OUTPUT_SIZE = 512;
// Rejects "decompression bomb" images before decoding them fully (~40 megapixels).
const MAX_INPUT_PIXELS = 40_000_000;

const invalidImage = () =>
  new AppError(400, 'INVALID_IMAGE', 'File is not a supported image (JPEG, PNG or WebP)');

/**
 * Validates an uploaded avatar by decoding it (never trusting the declared MIME type or file
 * name) and re-encodes it as a 512×512 WebP. Re-encoding drops all metadata — including EXIF
 * GPS coordinates that phone photos often carry — and neutralises crafted files.
 */
export async function processAvatarImage(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });

  const metadata = await image.metadata().catch(() => {
    throw invalidImage();
  });
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) throw invalidImage();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < AVATAR_MIN_DIMENSION ||
    metadata.height < AVATAR_MIN_DIMENSION
  ) {
    throw new AppError(
      400,
      'IMAGE_TOO_SMALL',
      `Image must be at least ${AVATAR_MIN_DIMENSION}×${AVATAR_MIN_DIMENSION} pixels`,
    );
  }

  try {
    return await image
      .rotate() // apply EXIF orientation before metadata is discarded
      .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw invalidImage();
  }
}
