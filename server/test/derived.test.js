import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { migrate } from '../src/db/migrate.js';
import {
  createBranch,
  createFridge,
  createLogger,
  assignLogger,
} from '../src/registry/registry.js';
import { ingestFile, rebuildReadings } from '../src/ingest/ingest.js';
import { fridgeReadings, recomputeForLogger } from '../src/detection/store.js';

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name));
const csv = (text) => Buffer.from(text);

let db;
let rawDir;
beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  rawDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chilllog-raw-'));
});
afterEach(() => {
  db.close();
  fs.rmSync(rawDir, { recursive: true, force: true });
});

/** A fridge with a logger placed in it since January. */
function fridgeWithLogger(branchName, fridgeName, code) {
  const branch = createBranch(db, branchName);
  const fridge = createFridge(db, { branchId: branch.id, name: fridgeName });
  const logger = createLogger(db, { code });
  assignLogger(db, { loggerId: logger.id, fridgeId: fridge.id, fromUtc: '2026-01-01T00:00:00Z' });
  return { branch, fridge, logger };
}

const upload = (fileName, content) => ingestFile(db, { rawDir, fileName, content });
const rows = (sql, ...params) => db.prepare(sql).all(...params);

describe('derived tables after an upload', () => {
  it('"when did this fridge go above five degrees, and for how long?" is answered from the excursions table', () => {
    const { fridge } = fridgeWithLogger('Rishon LeZion', 'Cream cakes', 'TL-0388');
    upload('TL-0388_2026-09-15.csv', fixture('rishon-slow-warming.csv'));

    expect(
      rows(
        'SELECT start_utc, end_utc, duration_minutes, peak_c, end_reason FROM excursions WHERE fridge_id = ?',
        fridge.id,
      ),
    ).toEqual([
      {
        start_utc: '2026-09-14T10:45:00Z',
        end_utc: '2026-09-15T20:45:00Z',
        duration_minutes: 2040,
        peak_c: 6.1,
        end_reason: 'data_ends',
      },
    ]);
  });

  it('keeps the latest state of each fridge, warming included', () => {
    const { fridge } = fridgeWithLogger('Rishon LeZion', 'Cream cakes', 'TL-0388');
    upload('TL-0388_2026-09-15.csv', fixture('rishon-slow-warming.csv'));

    const [status] = rows('SELECT * FROM fridge_status WHERE fridge_id = ?', fridge.id);
    expect(status).toMatchObject({
      first_utc: '2026-09-10T21:00:00Z',
      last_utc: '2026-09-15T20:45:00Z',
      latest_valid_utc: '2026-09-15T20:45:00Z',
      latest_temp_c: 6.1,
      is_warming: 1,
    });
    expect(status.warming_rise_c).toBeGreaterThanOrEqual(0.5);
  });

  it('stores door openings and gaps for the fridge', () => {
    const { fridge } = fridgeWithLogger('Tel Aviv', 'Walk-in', 'TL-0417');
    upload('TL-0417_a.csv', fixture('door-spike-single-reading.csv'));
    const { fridge: dairy } = fridgeWithLogger('Jerusalem', 'Dairy', 'TL-0512');
    upload('TL-0512_a.csv', fixture('gap-two-hours.csv'));

    expect(rows('SELECT ts_utc, temp_c FROM door_spikes WHERE fridge_id = ?', fridge.id)).toEqual([
      { ts_utc: '2026-09-14T03:15:00Z', temp_c: 9.4 },
    ]);
    expect(rows('SELECT COUNT(*) AS n FROM excursions')[0].n).toBe(0);
    expect(
      rows(
        'SELECT from_utc, to_utc, minutes, err_readings FROM gaps WHERE fridge_id = ?',
        dairy.id,
      ),
    ).toEqual([
      {
        from_utc: '2026-09-14T03:15:00Z',
        to_utc: '2026-09-14T05:30:00Z',
        minutes: 135,
        err_readings: 1,
      },
    ]);
  });

  it('joins an excursion that runs across two weekly files into one', () => {
    const { fridge } = fridgeWithLogger('Rishon LeZion', 'Cream cakes', 'TL-0388');
    upload(
      'TL-0388_week1.csv',
      csv('20/09/2026 23:15,4.8\n20/09/2026 23:30,5.6\n20/09/2026 23:45,6.2\n'),
    );
    expect(rows('SELECT end_reason FROM excursions')).toEqual([{ end_reason: 'data_ends' }]);

    upload('TL-0388_week2.csv', csv('21/09/2026 00:00,6.0\n21/09/2026 00:15,4.9\n'));
    expect(
      rows(
        'SELECT start_utc, end_utc, readings, end_reason FROM excursions WHERE fridge_id = ?',
        fridge.id,
      ),
    ).toEqual([
      {
        start_utc: '2026-09-20T20:30:00Z',
        end_utc: '2026-09-20T21:15:00Z',
        readings: 3,
        end_reason: 'back_in_range',
      },
    ]);
  });
});

describe('which readings belong to which fridge', () => {
  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": each fridge gets its own excursions', () => {
    const { branch, fridge: walkIn, logger } = fridgeWithLogger('Tel Aviv', 'Walk-in', 'TL-0417');
    const display = createFridge(db, { branchId: branch.id, name: 'Display 2' });
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: display.id,
      fromUtc: '2026-09-17T07:00:00Z',
    });

    // 09:00–09:30 in the walk-in, then after the 10:00 move 10:30–11:00 in the display fridge.
    upload(
      'TL-0417_2026-09-21.csv',
      csv(
        [
          '17/09/2026 08:45,4.0',
          '17/09/2026 09:00,6.1',
          '17/09/2026 09:15,6.4',
          '17/09/2026 09:30,4.2',
          '17/09/2026 10:15,4.0',
          '17/09/2026 10:30,5.8',
          '17/09/2026 10:45,5.9',
          '17/09/2026 11:00,4.1',
        ].join('\n'),
      ),
    );

    const excursionsOf = (fridge) =>
      rows('SELECT start_utc, end_utc FROM excursions WHERE fridge_id = ?', fridge.id);
    expect(excursionsOf(walkIn)).toEqual([
      { start_utc: '2026-09-17T06:00:00Z', end_utc: '2026-09-17T06:30:00Z' },
    ]);
    expect(excursionsOf(display)).toEqual([
      { start_utc: '2026-09-17T07:30:00Z', end_utc: '2026-09-17T08:00:00Z' },
    ]);
  });

  it('readings from before a logger was placed belong to no fridge', () => {
    const branch = createBranch(db, 'Haifa');
    const fridge = createFridge(db, { branchId: branch.id, name: 'Dairy' });
    const logger = createLogger(db, { code: 'TL-0231' });
    assignLogger(db, { loggerId: logger.id, fridgeId: fridge.id, fromUtc: '2026-09-15T07:30:00Z' });
    upload(
      'TL-0231.csv',
      csv(
        '15/09/2026 10:00,4.1\n15/09/2026 10:15,4.2\n15/09/2026 10:30,4.3\n15/09/2026 10:45,4.4\n',
      ),
    );

    expect(fridgeReadings(db, fridge.id).map((r) => r.tsUtc)).toEqual([
      '2026-09-15T07:30:00Z',
      '2026-09-15T07:45:00Z',
    ]);
  });

  it('recomputes both fridges after a logger is moved', () => {
    const { branch, fridge: walkIn, logger } = fridgeWithLogger('Tel Aviv', 'Walk-in', 'TL-0417');
    const display = createFridge(db, { branchId: branch.id, name: 'Display 2' });
    upload(
      'TL-0417.csv',
      csv(
        '17/09/2026 10:15,4.0\n17/09/2026 10:30,5.8\n17/09/2026 10:45,5.9\n17/09/2026 11:00,4.1\n',
      ),
    );
    expect(rows('SELECT fridge_id FROM excursions')).toEqual([{ fridge_id: walkIn.id }]);

    // Summer records the move after the file came in: the excursion now belongs to the display fridge.
    assignLogger(db, {
      loggerId: logger.id,
      fridgeId: display.id,
      fromUtc: '2026-09-17T07:00:00Z',
    });
    recomputeForLogger(db, logger.id);
    expect(rows('SELECT fridge_id FROM excursions')).toEqual([{ fridge_id: display.id }]);
  });
});

describe('rebuild', () => {
  it('rebuilds the derived tables to exactly what uploading produced', () => {
    fridgeWithLogger('Rishon LeZion', 'Cream cakes', 'TL-0388');
    fridgeWithLogger('Jerusalem', 'Dairy', 'TL-0512');
    upload('TL-0388.csv', fixture('rishon-slow-warming.csv'));
    upload('TL-0512.csv', fixture('gap-two-hours.csv'));

    const snapshot = () => ({
      excursions: rows(
        'SELECT fridge_id, start_utc, end_utc, peak_c, end_reason FROM excursions ORDER BY fridge_id, start_utc',
      ),
      gaps: rows('SELECT * FROM gaps ORDER BY fridge_id, from_utc'),
      spikes: rows('SELECT * FROM door_spikes ORDER BY fridge_id, ts_utc'),
      status: rows('SELECT * FROM fridge_status ORDER BY fridge_id'),
    });
    const before = snapshot();
    db.exec('DELETE FROM excursions'); // derived rows lost or stale: the rebuild must restore them
    rebuildReadings(db, { rawDir });
    expect(snapshot()).toEqual(before);
  });
});
