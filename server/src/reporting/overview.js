// The overview: every fridge's status for one week, worst first. "This week" is the last full
// Monday–Sunday week in Israel time: files arrive on Monday for the week before.
// Depends on "now", so it is worked out on read from the derived tables and a week of readings.

import { DateTime } from 'luxon';
import { STATUS_ORDER, THRESHOLDS, TIME_ZONE } from '@chilllog/shared';
import { warmingAt } from '../detection/detection.js';
import { fridgeReadings } from '../detection/store.js';
import { missingInRange } from './gaps.js';
import { bucketize } from './series.js';

const MINUTE = 60_000;
// Warming compares two windows ending at the last reading, so load that much before the week.
export const LOOKBACK_MS = 2 * THRESHOLDS.warming.windowHours * 60 * MINUTE;
const SPARKLINE_BUCKET_MINUTES = 180;

const toUtcIso = (dt) => dt.toUTC().toISO({ suppressMilliseconds: true });
const time = (iso) => Date.parse(iso);
const isValid = (r) => !r.isErr && r.tempC !== null;

/**
 * The Monday–Sunday week (Israel time) containing `week`, or the last full week before `now`.
 * @param {{ now: Date, week?: string }} options week is a local date, e.g. '2026-09-14'
 * @returns {{ startUtc: string, endUtc: string, firstDay: string, lastDay: string } | null}
 *   null when `week` isn't a real date
 */
export function weekWindow({ now, week }) {
  const anchor = week
    ? DateTime.fromISO(week, { zone: TIME_ZONE })
    : DateTime.fromJSDate(now, { zone: TIME_ZONE }).minus({ weeks: 1 });
  if (!anchor.isValid) return null;
  const start = anchor.startOf('week'); // Luxon weeks start on Monday
  const end = start.plus({ weeks: 1 });
  return {
    startUtc: toUtcIso(start),
    endUtc: toUtcIso(end),
    firstDay: start.toISODate(),
    lastDay: end.minus({ days: 1 }).toISODate(),
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ now: Date, week: NonNullable<ReturnType<typeof weekWindow>>, fridgeId?: number }} options
 *   fridgeId limits it to one fridge (the fridge page's status pill)
 */
export function buildOverview(db, { now, week, fridgeId = null }) {
  const { startUtc, endUtc } = week;
  // For the current week, missing data can only run until now, not until Sunday night.
  const nowUtc = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const edgeEndUtc = nowUtc < endUtc ? nowUtc : endUtc;

  const fridges = db
    .prepare(
      `SELECT f.id, f.name, b.id AS branch_id, b.name AS branch_name, s.first_utc,
              EXISTS (SELECT 1 FROM logger_assignments a
                      WHERE a.fridge_id = f.id AND a.from_utc < ?) AS has_logger
       FROM fridges f
       JOIN branches b ON b.id = f.branch_id
       LEFT JOIN fridge_status s ON s.fridge_id = f.id
       WHERE ? IS NULL OR f.id = ?`,
    )
    .all(endUtc, fridgeId, fridgeId);
  const excursionsInWeek = db.prepare(
    `SELECT peak_c, duration_minutes FROM excursions
     WHERE fridge_id = ? AND start_utc < ? AND end_utc > ?`,
  );

  const rows = fridges.map((fridge) => {
    const base = {
      fridgeId: fridge.id,
      fridgeName: fridge.name,
      branchId: fridge.branch_id,
      branchName: fridge.branch_name,
      noLogger: fridge.has_logger === 0,
      latest: null,
      alert: null,
      warming: null,
      gap: null,
      sparkline: [],
    };
    const loaded = fridgeReadings(db, fridge.id, {
      fromUtc: new Date(time(startUtc) - LOOKBACK_MS).toISOString(),
      toUtc: endUtc,
    });
    const inWeek = loaded.filter((r) => r.tsUtc >= startUtc);
    if (inWeek.length === 0) return { ...base, status: 'no_file' };

    const validInWeek = inWeek.filter(isValid);
    const last = validInWeek.at(-1);
    if (last) base.latest = { tsUtc: last.tsUtc, tempC: last.tempC };
    // The card's 7-day sparkline: 56 min/max points, so a spike still shows.
    base.sparkline = bucketize(inWeek, {
      fromUtc: startUtc,
      toUtc: endUtc,
      bucketMinutes: SPARKLINE_BUCKET_MINUTES,
    });

    const excursions = excursionsInWeek.all(fridge.id, endUtc, startUtc);
    if (excursions.length > 0) {
      base.alert = {
        count: excursions.length,
        peakC: Math.max(...excursions.map((e) => e.peak_c)),
        totalMinutes: excursions.reduce((sum, e) => sum + e.duration_minutes, 0),
      };
    }

    const warming = last ? warmingAt(loaded, last.tsUtc) : null;
    if (warming?.isWarming) {
      base.warming = { latestC: last.tempC, medianC: warming.medianC, riseC: warming.riseC };
    }

    const hadDataBefore = fridge.first_utc !== null && fridge.first_utc < startUtc;
    const gaps = missingInRange(loaded, { startUtc, edgeEndUtc, hadDataBefore });
    if (gaps.length > 0) {
      base.gap = { count: gaps.length, totalMinutes: gaps.reduce((sum, g) => sum + g.minutes, 0) };
    }

    const status = base.alert ? 'alert' : base.warming ? 'warming' : base.gap ? 'gap' : 'ok';
    return { ...base, status };
  });

  rows.sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.branchName.localeCompare(b.branchName) ||
      a.fridgeName.localeCompare(b.fridgeName),
  );
  const counts = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, rows.filter((r) => r.status === status).length]),
  );
  const { last } = db.prepare('SELECT MAX(uploaded_at) AS last FROM uploads').get();
  return { week, lastUploadUtc: last, counts, fridges: rows };
}
