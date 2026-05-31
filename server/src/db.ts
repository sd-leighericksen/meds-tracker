import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS } from './schema.js';

// Anchor the default DB path to <project-root>/data regardless of cwd, so the
// dev seed (run from server/) and a server started from the repo root see the
// same file. MEDS_DB_PATH overrides this (Docker sets it to /data/...).
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(__dirname, '../../data/meds.sqlite');
const DB_PATH = process.env.MEDS_DB_PATH ?? DEFAULT_DB_PATH;

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const getMeta = db.prepare<[string], { value: string }>(
  `SELECT value FROM meta WHERE key = ?`
);
const setMeta = db.prepare(
  `INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
);

if (!getMeta.get('created_at')) {
  setMeta.run('created_at', new Date().toISOString());
}

const currentVersion = Number(getMeta.get('schema_version')?.value ?? 0);

const applyMigrations = db.transaction(() => {
  let version = currentVersion;
  for (const m of MIGRATIONS) {
    if (m.version <= version) continue;
    db.exec(m.sql);
    version = m.version;
  }
  setMeta.run('schema_version', String(version));
});
applyMigrations();
