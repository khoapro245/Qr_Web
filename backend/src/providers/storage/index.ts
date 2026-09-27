import { env } from '../../config/env.js';
import { LocalDiskStorage } from './local-disk.storage.js';
import type { StorageProvider } from './storage.js';

function createStorage(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case 'local':
      return new LocalDiskStorage(env.STORAGE_LOCAL_DIR);
  }
}

export const storage = createStorage();
export type { StorageProvider, StoredObject } from './storage.js';
