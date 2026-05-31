import { db } from './db.js';

const getRow = db.prepare<[string], { value: string }>(
  `SELECT value FROM settings WHERE key = ?`
);
const setRow = db.prepare(
  `INSERT INTO settings(key, value, updated_at)
   VALUES(?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   ON CONFLICT(key) DO UPDATE
     SET value = excluded.value,
         updated_at = excluded.updated_at`
);

export function getSetting(key: string): string | null {
  return getRow.get(key)?.value ?? null;
}
export function setSetting(key: string, value: string) {
  setRow.run(key, value);
}
export function getJSON<T>(key: string, fallback: T): T {
  const raw = getSetting(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
export function setJSON<T>(key: string, value: T) {
  setSetting(key, JSON.stringify(value));
}

export const KEYS = {
  pinHash: 'pin_hash',
  parentNames: 'parent_names',
  dispensedByRequired: 'dispensed_by_required',
  webhookUrl: 'webhook_url',
} as const;
