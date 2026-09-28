import fs from 'node:fs';
import path from 'node:path';
import { transaction } from './transaction.js';

const defaultDir = path.resolve(import.meta.dirname, '..', '..', 'migrations');

/**
 * Applies every numbered .sql file in `dir` that hasn't been applied yet, in name order.
 * Each file runs in its own transaction together with its schema_migrations row,
 * so a failing file leaves no trace and is retried on the next start.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ dir?: string }} [options]
 * @returns {string[]} names of the files applied by this call
 */
export function migrate(db, { dir = defaultDir } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const done = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => row.name),
  );
  const pending = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql') && !done.has(name))
    .sort();

  const record = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  for (const name of pending) {
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    try {
      transaction(db, () => {
        db.exec(sql);
        record.run(name, new Date().toISOString());
      });
    } catch (err) {
      throw new Error(`Migration ${name} failed: ${err.message}`, { cause: err });
    }
  }
  return pending;
}
