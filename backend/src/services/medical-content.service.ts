import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

let tableReady: Promise<void> | null = null;

async function ensureTable(): Promise<void> {
  tableReady ??= (async () => {
    try {
      await db.execute(sql`
        CREATE SCHEMA IF NOT EXISTS app_storage;
        CREATE TABLE IF NOT EXISTS app_storage.medical_content (
          key TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    } catch {
      // In test mode or when DB is not ready, fail gracefully
    }
  })();
  await tableReady;
}

export async function getMedicalStore(key: string): Promise<unknown> {
  await ensureTable();
  try {
    const res = await db.execute<{ data: unknown }>(sql`
      SELECT data FROM app_storage.medical_content WHERE key = ${key} LIMIT 1
    `);
    return res.rows[0]?.data ?? null;
  } catch {
    return null;
  }
}

export async function saveMedicalStore(key: string, data: unknown): Promise<void> {
  await ensureTable();
  try {
    await db.execute(sql`
      INSERT INTO app_storage.medical_content (key, data, updated_at)
      VALUES (${key}, ${JSON.stringify(data)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
    `);
  } catch {
    // Fail gracefully
  }
}

export async function getAllMedicalContent(): Promise<{
  conditions: unknown;
  disclaimer: unknown;
  userConditions: unknown;
}> {
  const [conditions, disclaimer, userConditions] = await Promise.all([
    getMedicalStore('conditions'),
    getMedicalStore('disclaimer'),
    getMedicalStore('user_conditions'),
  ]);
  return { conditions, disclaimer, userConditions };
}

export async function updateAllMedicalContent(payload: {
  conditions?: unknown;
  disclaimer?: unknown;
  userConditions?: unknown;
}): Promise<void> {
  if (payload.conditions !== undefined) {
    await saveMedicalStore('conditions', payload.conditions);
  }
  if (payload.disclaimer !== undefined) {
    await saveMedicalStore('disclaimer', payload.disclaimer);
  }
  if (payload.userConditions !== undefined) {
    await saveMedicalStore('user_conditions', payload.userConditions);
  }
}
