import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';

const coreTables = ['branches', 'fridges', 'loggers', 'logger_assignments', 'uploads', 'readings'];

function tableNames(db) {
  return db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
}

/** One branch, two fridges, one logger and one upload to hang readings and assignments on. */
function seedRegistry(db) {
  db.exec(`
    INSERT INTO branches (id, name) VALUES (1, 'Tel Aviv');
    INSERT INTO fridges (id, branch_id, name) VALUES (1, 1, 'Walk-in'), (2, 1, 'Display 2');
    INSERT INTO loggers (id, code) VALUES (1, 'TL-0417');
    INSERT INTO uploads (id, sha256, original_name, uploaded_at, logger_id, status)
      VALUES (1, 'abc', 'TL-0417_2026-09-21.csv', '2026-09-21T09:12:00Z', 1, 'processed');
  `);
}

describe('migrations', () => {
  let db;
  beforeEach(() => {
    db = openDatabase(':memory:');
  });
  afterEach(() => {
    db.close();
  });

  it('applies the core schema to a fresh database', () => {
    expect(migrate(db)).toEqual(['001_core_tables.sql']);
    expect(tableNames(db)).toEqual(expect.arrayContaining([...coreTables, 'schema_migrations']));
  });

  it('applies nothing when run a second time', () => {
    migrate(db);
    expect(migrate(db)).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n).toBe(1);
  });

  it('rolls back a failing migration and does not record it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-migrations-'));
    try {
      fs.writeFileSync(path.join(dir, '001_ok.sql'), 'CREATE TABLE good (id INTEGER);');
      fs.writeFileSync(
        path.join(dir, '002_broken.sql'),
        'CREATE TABLE half_done (id INTEGER); INSERT INTO missing_table VALUES (1);',
      );

      expect(() => migrate(db, { dir })).toThrow(/002_broken\.sql/);

      const recorded = db
        .prepare('SELECT name FROM schema_migrations')
        .all()
        .map((r) => r.name);
      expect(recorded).toEqual(['001_ok.sql']);
      expect(tableNames(db)).toContain('good');
      expect(tableNames(db)).not.toContain('half_done');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('core schema', () => {
  let db;
  beforeEach(() => {
    db = openDatabase(':memory:');
    migrate(db);
    seedRegistry(db);
  });
  afterEach(() => {
    db.close();
  });

  it('stores one reading per logger per moment, so re-uploads cannot duplicate', () => {
    const insert = db.prepare(
      'INSERT INTO readings (logger_id, ts_utc, temp_c, upload_id) VALUES (?, ?, ?, ?)',
    );
    insert.run(1, '2026-09-21T06:45:00Z', 3.9, 1);
    expect(() => insert.run(1, '2026-09-21T06:45:00Z', 3.9, 1)).toThrow(/UNIQUE constraint/);
  });

  it('keeps an ERR reading as a row with no temperature', () => {
    db.prepare(
      'INSERT INTO readings (logger_id, ts_utc, temp_c, is_err, upload_id) VALUES (?, ?, NULL, 1, ?)',
    ).run(1, '2026-09-14T06:30:00Z', 1);
    const row = db.prepare('SELECT temp_c, is_err FROM readings').get();
    expect(row).toEqual({ temp_c: null, is_err: 1 });
  });

  it('rejects a reading from a logger that is not in the registry', () => {
    expect(() =>
      db
        .prepare('INSERT INTO readings (logger_id, ts_utc, temp_c, upload_id) VALUES (?, ?, ?, ?)')
        .run(99, '2026-09-21T06:45:00Z', 3.9, 1),
    ).toThrow(/FOREIGN KEY constraint/);
  });

  it('rejects a unit other than °C or °F', () => {
    expect(() =>
      db.prepare("INSERT INTO loggers (code, unit) VALUES ('TL-0231', 'K')").run(),
    ).toThrow(/CHECK constraint/);
  });

  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": a logger keeps its history of fridges', () => {
    const assign = db.prepare(
      'INSERT INTO logger_assignments (logger_id, fridge_id, from_utc) VALUES (?, ?, ?)',
    );
    assign.run(1, 1, '2026-01-01T00:00:00Z');
    assign.run(1, 2, '2026-09-17T08:00:00Z');

    const history = db
      .prepare('SELECT fridge_id FROM logger_assignments WHERE logger_id = 1 ORDER BY from_utc')
      .all()
      .map((r) => r.fridge_id);
    expect(history).toEqual([1, 2]);
  });
});
