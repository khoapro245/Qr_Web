import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { assertValidKey, type StorageProvider, type StoredObject } from './storage.js';

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

/** Stores objects as files under a root directory. Suitable for development and one server. */
export class LocalDiskStorage implements StorageProvider {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    assertValidKey(key);
    const fullPath = resolve(this.root, key);
    // Defence in depth on top of the key pattern.
    if (!fullPath.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return fullPath;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const fullPath = this.pathFor(key);
    await mkdir(dirname(fullPath), { recursive: true });
    // `wx` refuses to overwrite: keys are random, so a collision indicates a bug.
    await writeFile(fullPath, data, { flag: 'wx' });
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const data = await readFile(this.pathFor(key));
      return { data, contentType: CONTENT_TYPES[extname(key)] ?? 'application/octet-stream' };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
