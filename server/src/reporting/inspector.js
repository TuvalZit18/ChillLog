// The inspector report: "when did this fridge go above five degrees, and for how long?" for
// one fridge, one branch or all of them, over a range. The screen and the CSV export are built
// from the same report, so they can never disagree.

import { DateTime } from 'luxon';
import { THRESHOLDS, TIME_ZONE, formatDurationLong } from '@chilllog/shared';
import { fridgeReadings } from '../detection/store.js';
import { toCsv } from './csv.js';
import { missingInRange } from './gaps.js';
import { LOOKBACK_MS } from './overview.js';

export const DEFAULT_RANGE_DAYS = 30;

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ branchId?: number, fridgeId?: number, range: { fromUtc: string, toUtc: string },
 *   now: Date }} options branch and fridge already checked to exist and match
 */
export function buildInspectorReport(db, { branchId = null, fridgeId = null, range, now }) {
  const { fromUtc, toUtc } = range;
  const fridges = db
    .prepare(
      `SELECT f.id, f.name, b.name AS branch_name, s.first_utc
       FROM fridges f
       JOIN branches b ON b.id = f.branch_id
       LEFT JOIN fridge_status s ON s.fridge_id = f.id
       WHERE (? IS NULL OR f.branch_id = ?) AND (? IS NULL OR f.id = ?)
       ORDER BY b.name, f.name`,
    )
    .all(branchId, branchId, fridgeId, fridgeId);

  // Whole excursions that overlap the range, oldest first: the inspector gets real start and
  // end times even when an excursion began before the range.
  const excursionsOf = db.prepare(
    `SELECT start_utc, end_utc, duration_minutes, peak_c, end_reason FROM excursions
     WHERE fridge_id = ? AND start_utc < ? AND end_utc > ?`,
  );
  const nowUtc = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const edgeEndUtc = nowUtc < toUtc ? nowUtc : toUtc;

  const excursions = [];
  const gaps = [];
  const fridgesWithoutData = [];
  for (const fridge of fridges) {
    const where = { fridgeId: fridge.id, branchName: fridge.branch_name, fridgeName: fridge.name };
    for (const e of excursionsOf.all(fridge.id, toUtc, fromUtc)) {
      excursions.push({
        ...where,
        startUtc: e.start_utc,
        endUtc: e.end_utc,
        durationMinutes: e.duration_minutes,
        peakC: e.peak_c,
        endReason: e.end_reason,
      });
    }

    const loaded = fridgeReadings(db, fridge.id, {
      fromUtc: new Date(Date.parse(fromUtc) - LOOKBACK_MS).toISOString(),
      toUtc,
    });
    if (!loaded.some((r) => r.tsUtc >= fromUtc)) {
      fridgesWithoutData.push(where);
      continue;
    }
    const hadDataBefore = fridge.first_utc !== null && fridge.first_utc < fromUtc;
    for (const g of missingInRange(loaded, { startUtc: fromUtc, edgeEndUtc, hadDataBefore })) {
      gaps.push({ ...where, ...g });
    }
  }
  excursions.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  return {
    range,
    limitC: THRESHOLDS.limitC,
    summary: {
      count: excursions.length,
      totalMinutes: excursions.reduce((sum, e) => sum + e.durationMinutes, 0),
    },
    excursions,
    gaps,
    fridgesWithoutData,
  };
}

const END_REASON_TEXT = {
  back_in_range: `Back at or below ${THRESHOLDS.limitC}°C`,
  gap: 'Readings stop (gap in the data)',
  data_ends: `Still above ${THRESHOLDS.limitC}°C at the last reading`,
};

const localTime = (iso) => DateTime.fromISO(iso, { zone: TIME_ZONE }).toFormat('yyyy-MM-dd HH:mm');

/**
 * The report's excursions as a CSV for Excel, times in Israel time.
 * @param {ReturnType<typeof buildInspectorReport>} report
 */
export function inspectorCsv(report) {
  return toCsv(
    [
      'Branch',
      'Fridge',
      'Started (Israel time)',
      'Ended (Israel time)',
      'Duration (minutes)',
      'Duration',
      'Peak °C',
      'How the end is known',
    ],
    report.excursions.map((e) => [
      e.branchName,
      e.fridgeName,
      localTime(e.startUtc),
      localTime(e.endUtc),
      e.durationMinutes,
      formatDurationLong(e.durationMinutes),
      e.peakC,
      END_REASON_TEXT[e.endReason],
    ]),
  );
}

/** "chilllog-above-5C_2026-09-01_to_2026-09-21.csv", dates in Israel time. */
export function inspectorFileName({ fromUtc, toUtc }) {
  const day = (iso) => DateTime.fromISO(iso, { zone: TIME_ZONE }).toISODate();
  const lastDay = DateTime.fromISO(toUtc, { zone: TIME_ZONE }).minus({ milliseconds: 1 });
  return `chilllog-above-${THRESHOLDS.limitC}C_${day(fromUtc)}_to_${lastDay.toISODate()}.csv`;
}
