import { DatabaseSync } from 'node:sqlite';

/**
 * Opens the SQLite database. Pass ':memory:' for a fresh, throwaway database (tests).
 * @param {string} filename
 * @returns {DatabaseSync}
 */
export function openDatabase(filename) {
  const db = new DatabaseSync(filename);
  // SQLite leaves foreign keys off unless asked, per connection.
  db.exec('PRAGMA foreign_keys = ON');
  if (filename !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  return db;
}
