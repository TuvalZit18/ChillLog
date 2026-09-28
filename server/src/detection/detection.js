// Detection rules: plain, deterministic functions over one fridge's readings, sorted by time.
// Same readings in, same answer out, which is what Summer repeats to the inspector.
// Every number comes from THRESHOLDS in shared/; the reasons are in NOTES.md.

import { THRESHOLDS } from '@chilllog/shared';

/** @typedef {import('../normalize/normalize.js').Reading} Reading */

/**
 * @typedef {object} Excursion
 * @property {string} startUtc first reading above the limit
 * @property {string} endUtc first reading back at or below the limit; or, when the data stops
 *   first, the last reading above it
 * @property {number} durationMinutes
 * @property {number} peakC
 * @property {number} readings how many valid readings were above the limit
 * @property {'back_in_range' | 'gap' | 'data_ends'} endReason how the end is known
 */

/** @typedef {{ tsUtc: string, tempC: number }} DoorSpike a single reading above the limit */
/** @typedef {{ fromUtc: string, toUtc: string, minutes: number, errReadings: number }} Gap */

/**
 * @typedef {object} Warming
 * @property {string} atUtc
 * @property {number} medianC median of the window ending at atUtc
 * @property {number} previousMedianC median of the window before it
 * @property {number} riseC
 * @property {boolean} isWarming
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const time = (iso) => Date.parse(iso);
const round2 = (x) => Math.round(x * 100) / 100;
const isValid = (r) => !r.isErr && r.tempC !== null;

/**
 * Time above the limit. Readings in a row above it make an excursion; a single one is a door
 * opening. ERR readings are skipped without ending a run; a gap ends it.
 * @param {Reading[]} readings sorted by time
 * @returns {{ excursions: Excursion[], doorSpikes: DoorSpike[] }}
 */
export function findExcursions(readings, thresholds = THRESHOLDS) {
  const { limitC, minExcursionReadings, gapMinutes } = thresholds;
  const excursions = [];
  const doorSpikes = [];
  let run = null;
  let previous = null;

  const close = (endUtc, endReason) => {
    if (run.count >= minExcursionReadings) {
      excursions.push({
        startUtc: run.startUtc,
        endUtc,
        durationMinutes: (time(endUtc) - time(run.startUtc)) / MINUTE,
        peakC: run.peakC,
        readings: run.count,
        endReason,
      });
    } else {
      doorSpikes.push({ tsUtc: run.startUtc, tempC: run.peakC });
    }
    run = null;
  };

  for (const reading of readings.filter(isValid)) {
    if (run && time(reading.tsUtc) - time(previous.tsUtc) > gapMinutes * MINUTE) {
      close(run.lastUtc, 'gap');
    }
    if (reading.tempC > limitC) {
      run ??= { startUtc: reading.tsUtc, peakC: reading.tempC, count: 0 };
      run.count++;
      run.lastUtc = reading.tsUtc;
      run.peakC = Math.max(run.peakC, reading.tempC);
    } else if (run) {
      close(reading.tsUtc, 'back_in_range');
    }
    previous = reading;
  }
  if (run) close(run.lastUtc, 'data_ends');

  return { excursions, doorSpikes };
}

/**
 * Stretches with no valid reading for longer than the gap threshold. ERR readings count as
 * missing and are counted per gap. Only gaps between readings: before the first or after the
 * last reading is the "no file" status's business.
 * @param {Reading[]} readings sorted by time
 * @returns {Gap[]}
 */
export function findGaps(readings, thresholds = THRESHOLDS) {
  const gaps = [];
  let previous = null;
  let errReadings = 0;
  for (const reading of readings) {
    if (!isValid(reading)) {
      if (previous) errReadings++;
      continue;
    }
    if (previous) {
      const minutes = (time(reading.tsUtc) - time(previous.tsUtc)) / MINUTE;
      if (minutes > thresholds.gapMinutes) {
        gaps.push({ fromUtc: previous.tsUtc, toUtc: reading.tsUtc, minutes, errReadings });
      }
    }
    previous = reading;
    errReadings = 0;
  }
  return gaps;
}

/**
 * Is the fridge slowly warming up at `atUtc`? Compares the median of the last window with the
 * median of the one before. Medians, so a door opening can't move them. Null when either
 * window has too little data to say.
 * @param {Reading[]} readings sorted by time
 * @param {string} atUtc
 * @returns {Warming | null}
 */
export function warmingAt(readings, atUtc, thresholds = THRESHOLDS) {
  const { windowHours, minRiseC, minCoverageHours } = thresholds.warming;
  const end = time(atUtc);
  const span = windowHours * HOUR;
  const valid = readings.filter(isValid);
  const within = (from, to) => valid.filter((r) => time(r.tsUtc) > from && time(r.tsUtc) <= to);

  const recent = within(end - span, end);
  const before = within(end - 2 * span, end - span);
  const covers = (window) =>
    window.length > 1 &&
    time(window.at(-1).tsUtc) - time(window[0].tsUtc) >= minCoverageHours * HOUR;
  if (!covers(recent) || !covers(before)) return null;

  const medianC = median(recent.map((r) => r.tempC));
  const previousMedianC = median(before.map((r) => r.tempC));
  const riseC = round2(medianC - previousMedianC);
  return { atUtc, medianC, previousMedianC, riseC, isWarming: riseC >= minRiseC };
}

function median(values) {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}
