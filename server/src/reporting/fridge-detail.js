// The fridge page: one fridge over a chosen range, with everything the chart and the lists
// under it need: downsampled readings, time above 5°C, door openings, gaps, ERR count, and
// which logger was in the fridge when.

import { DateTime } from 'luxon';
import { TIME_ZONE } from '@chilllog/shared';
import { fridgeReadings } from '../detection/store.js';
import { fridgePlacements, getFridge } from '../registry/registry.js';
import { missingInRange } from './gaps.js';
import { LOOKBACK_MS, buildOverview, filesDueUntilUtc, weekWindow } from './overview.js';
import { bucketize, chooseBucketMinutes } from './series.js';

export const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 7;

const toUtcIso = (dt) => dt.toUTC().toISO({ suppressMilliseconds: true });

/**
 * The requested range in UTC. `from` and `to` are Israel time; a date alone in `to` includes
 * that whole day ("to 20 Sep" ends at midnight going into the 21st). Without `from`, the range
 * starts `defaultDays` before its end; without `to`, it ends now.
 * @param {{ now: Date, from?: string, to?: string, defaultDays?: number }} options
 * @returns {{ fromUtc: string, toUtc: string } | { error: string }}
 */
export function resolveRange({ now, from, to, defaultDays = DEFAULT_RANGE_DAYS }) {
  const local = (text) => DateTime.fromISO(text, { zone: TIME_ZONE });
  const end = to
    ? to.length === 10
      ? local(to).plus({ days: 1 })
      : local(to)
    : DateTime.fromJSDate(now, { zone: TIME_ZONE }).set({ millisecond: 0 });
  if (!end.isValid) return { error: `${to} is not a real date.` };
  const start = from ? local(from) : end.minus({ days: defaultDays });
  if (!start.isValid) return { error: `${from} is not a real date.` };
  if (start >= end) return { error: 'The start of the range must be before its end.' };
  if (end.diff(start, 'days').days > MAX_RANGE_DAYS) {
    return { error: 'Pick a range of a year or less.' };
  }
  return { fromUtc: toUtcIso(start), toUtc: toUtcIso(end) };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ fridgeId: number, range: { fromUtc: string, toUtc: string }, now: Date }} options
 * @returns {object | null} null when the fridge doesn't exist
 */
export function buildFridgeDetail(db, { fridgeId, range, now }) {
  const fridge = getFridge(db, fridgeId);
  if (!fridge) return null;
  const { fromUtc, toUtc } = range;

  const status = db
    .prepare(
      'SELECT first_utc, latest_valid_utc, latest_temp_c FROM fridge_status WHERE fridge_id = ?',
    )
    .get(fridgeId);
  const loaded = fridgeReadings(db, fridgeId, {
    fromUtc: new Date(Date.parse(fromUtc) - LOOKBACK_MS).toISOString(),
    toUtc,
  });
  const inRange = loaded.filter((r) => r.tsUtc >= fromUtc);

  const nowUtc = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const dueUntilUtc = filesDueUntilUtc(now);
  const gaps =
    inRange.length === 0
      ? []
      : missingInRange(loaded, {
          startUtc: fromUtc,
          edgeEndUtc: nowUtc < toUtc ? nowUtc : toUtc,
          hadDataBefore: status !== undefined && status.first_utc < fromUtc,
          dueUntilUtc,
        });

  const placements = fridgePlacements(db, fridgeId);
  const bucketMinutes = chooseBucketMinutes(fromUtc, toUtc);
  const [weekStatus] = buildOverview(db, {
    now,
    week: weekWindow({ now }),
    fridgeId,
  }).fridges;

  return {
    fridge,
    range,
    weekStatus,
    latest: status?.latest_valid_utc
      ? { tsUtc: status.latest_valid_utc, tempC: status.latest_temp_c }
      : null,
    currentLogger: placements.find((p) => p.toUtc === null) ?? null,
    placements,
    series: { bucketMinutes, points: bucketize(inRange, { fromUtc, toUtc, bucketMinutes }) },
    excursions: db
      .prepare(
        `SELECT start_utc AS startUtc, end_utc AS endUtc, duration_minutes AS durationMinutes,
                peak_c AS peakC, readings, end_reason AS endReason
         FROM excursions WHERE fridge_id = ? AND start_utc < ? AND end_utc > ?
         ORDER BY start_utc`,
      )
      .all(fridgeId, toUtc, fromUtc),
    doorSpikes: db
      .prepare(
        `SELECT ts_utc AS tsUtc, temp_c AS tempC FROM door_spikes
         WHERE fridge_id = ? AND ts_utc >= ? AND ts_utc < ? ORDER BY ts_utc`,
      )
      .all(fridgeId, fromUtc, toUtc),
    gaps,
    errCount: inRange.filter((r) => r.isErr).length,
    // Readings after this haven't been sent yet (next Monday's files), so they aren't a gap.
    filesDueUntilUtc: dueUntilUtc,
  };
}
