import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';

// Resolves to backend/migrations from both src/db (tsx) and dist/db (compiled).
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../migrations', import.meta.url));

export async function runMigrations(database: Database): Promise<void> {
  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
}
