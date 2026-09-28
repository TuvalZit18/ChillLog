// Keeps the derived tables (excursions, door_spikes, gaps, fridge_status) in step with the
// readings. Callers own the transaction: ingest recomputes inside the same transaction that
// adds the readings, so the overview never shows a half-updated fridge.

import { findExcursions, findGaps, warmingAt } from './detection.js';

/** @typedef {import('node:sqlite').DatabaseSync} Db */
/** @typedef {import('../normalize/normalize.js').Reading} Reading */

const DERIVED_TABLES = ['excursions', 'door_spikes', 'gaps', 'fridge_status'];

/**
 * A fridge's readings: each logger's readings from the time it was placed in this fridge
 * until it was next moved. Optionally only those in [fromUtc, toUtc).
 * @param {Db} db
 * @param {number} fridgeId
 * @param {{ fromUtc?: string, toUtc?: string }} [range]
 * @returns {Reading[]} sorted by time
 */
export function fridgeReadings(db, fridgeId, { fromUtc = '', toUtc = '9999' } = {}) {
  return db
    .prepare(
      `SELECT r.ts_utc, r.temp_c, r.is_err
       FROM logger_assignments a
       JOIN readings r
         ON r.logger_id = a.logger_id
        AND r.ts_utc >= a.from_utc
        AND r.ts_utc < COALESCE(
              (SELECT MIN(next.from_utc) FROM logger_assignments next
               WHERE next.logger_id = a.logger_id AND next.from_utc > a.from_utc),
              '9999')
       WHERE a.fridge_id = ? AND r.ts_utc >= ? AND r.ts_utc < ?
       ORDER BY r.ts_utc`,
    )
    .all(fridgeId, fromUtc, toUtc)
    .map((row) => ({ tsUtc: row.ts_utc, tempC: row.temp_c, isErr: row.is_err === 1 }));
}

/** Throws away one fridge's derived rows and derives them again from its readings. */
export function recomputeFridge(db, fridgeId) {
  for (const table of DERIVED_TABLES) {
    db.prepare(`DELETE FROM ${table} WHERE fridge_id = ?`).run(fridgeId);
  }
  const readings = fridgeReadings(db, fridgeId);
  if (readings.length === 0) return;

  const { excursions, doorSpikes } = findExcursions(readings);
  const insertExcursion = db.prepare(
    `INSERT INTO excursions
       (fridge_id, start_utc, end_utc, duration_minutes, peak_c, readings, end_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const e of excursions) {
    insertExcursion.run(
      fridgeId,
      e.startUtc,
      e.endUtc,
      e.durationMinutes,
      e.peakC,
      e.readings,
      e.endReason,
    );
  }

  const insertSpike = db.prepare(
    'INSERT INTO door_spikes (fridge_id, ts_utc, temp_c) VALUES (?, ?, ?)',
  );
  for (const s of doorSpikes) insertSpike.run(fridgeId, s.tsUtc, s.tempC);

  const insertGap = db.prepare(
    `INSERT INTO gaps (fridge_id, from_utc, to_utc, minutes, err_readings)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const g of findGaps(readings)) {
    insertGap.run(fridgeId, g.fromUtc, g.toUtc, g.minutes, g.errReadings);
  }

  const latestValid = readings.findLast((r) => !r.isErr);
  const warming = latestValid ? warmingAt(readings, latestValid.tsUtc) : null;
  db.prepare(
    `INSERT INTO fridge_status
       (fridge_id, first_utc, last_utc, latest_valid_utc, latest_temp_c,
        warming_median_c, warming_previous_c, warming_rise_c, is_warming)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    fridgeId,
    readings[0].tsUtc,
    readings.at(-1).tsUtc,
    latestValid?.tsUtc ?? null,
    latestValid?.tempC ?? null,
    warming?.medianC ?? null,
    warming?.previousMedianC ?? null,
    warming?.riseC ?? null,
    warming?.isWarming ? 1 : 0,
  );
}

/**
 * Recomputes every fridge a logger has ever been placed in: after its readings change, or
 * after it is moved (a move changes which readings belong to which fridge).
 */
export function recomputeForLogger(db, loggerId) {
  const fridges = db
    .prepare('SELECT DISTINCT fridge_id FROM logger_assignments WHERE logger_id = ?')
    .all(loggerId);
  for (const { fridge_id } of fridges) recomputeFridge(db, fridge_id);
}

/** Recomputes every fridge from scratch, for the rebuild. */
export function recomputeAll(db) {
  for (const table of DERIVED_TABLES) db.exec(`DELETE FROM ${table}`);
  for (const { id } of db.prepare('SELECT id FROM fridges').all()) recomputeFridge(db, id);
}
