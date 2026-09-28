// Numbers and words for the fridge chart (docs/design/ui.md, "Temperature chart"). Pure
// functions of the GET /api/fridges/:id response, so the axis and wording are tested.

import { THRESHOLDS } from '@chilllog/shared';
import { formatDateTime, formatTemp, israelParts } from '../../shared/format/format.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * X axis ticks in Israel time: every 6 hours over a day or two, each midnight over a week or
 * two, Mondays over a month or so, and the first of each month beyond that.
 * @param {string} fromUtc
 * @param {string} toUtc
 * @returns {{ ms: number, label: string }[]}
 */
export function timeTicks(fromUtc, toUtc) {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  const span = to - from;
  const pick =
    span <= 2 * DAY_MS
      ? (p) =>
          p.hour === '00' ? `${p.weekday} ${p.day}` : Number(p.hour) % 6 === 0 && `${p.hour}:00`
      : span <= 14 * DAY_MS
        ? (p) => p.hour === '00' && `${p.weekday} ${p.day}`
        : span <= 93 * DAY_MS
          ? (p) => p.hour === '00' && p.weekday === 'Mon' && `${p.day} ${p.month}`
          : (p) => p.hour === '00' && p.day === '1' && p.month;

  // Israel is always a whole number of hours from UTC, so every local hour starts on a UTC hour.
  const ticks = [];
  for (let t = Math.ceil(from / HOUR_MS) * HOUR_MS; t <= to; t += HOUR_MS) {
    const p = israelParts(t);
    const label = p.minute === '00' && pick(p);
    if (label) ticks.push({ ms: t, label });
  }
  return ticks;
}

/**
 * The temperature scale: all readings and door openings, and always the 5°C line with a
 * degree of room above it.
 * @returns {[number, number]}
 */
export function yDomain(points, doorSpikes) {
  const temps = [
    ...points.flatMap((p) => (p.minC === null ? [] : [p.minC, p.maxC])),
    ...doorSpikes.map((d) => d.tempC),
  ];
  const lo = temps.length ? Math.min(...temps) : 3;
  const hi = temps.length ? Math.max(...temps) : THRESHOLDS.limitC;
  return [Math.floor(Math.min(lo, 3) - 0.5), Math.ceil(Math.max(hi, THRESHOLDS.limitC) + 1)];
}

/** Whole degrees for the Y axis; every second one on a tall scale. */
export function yTicks([lo, hi]) {
  const step = hi - lo > 8 ? 2 : 1;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return ticks;
}

/** The line above the chart for the touched or hovered point: "Thu 17 Sep, 10:45 · 3.8°C". */
export function readout(point) {
  const when = formatDateTime(point.tsUtc);
  if (point.minC === null) return `${when} · no reading`;
  const value =
    point.minC === point.maxC
      ? formatTemp(point.maxC)
      : `${point.minC.toFixed(1)}–${formatTemp(point.maxC)}`;
  const above = point.maxC > THRESHOLDS.limitC ? ` · above ${THRESHOLDS.limitC}°C` : '';
  return `${when} · ${value}${above}`;
}

/** What the chart shows, in words, for screen readers (the chart's aria-label). */
export function chartSummary({ fridge, range, series, excursions }) {
  const what = `Temperature of ${fridge.branchName} · ${fridge.name} from ${formatDateTime(range.fromUtc)} to ${formatDateTime(range.toUtc)}.`;
  const read = series.points.filter((p) => p.minC !== null);
  if (read.length === 0) return `${what} No readings in this range.`;
  const lo = Math.min(...read.map((p) => p.minC));
  const hi = Math.max(...read.map((p) => p.maxC));
  const periods = `${excursions.length} ${excursions.length === 1 ? 'period' : 'periods'}`;
  return `${what} Readings between ${formatTemp(lo)} and ${formatTemp(hi)}. ${periods} above ${THRESHOLDS.limitC}°C.`;
}

/**
 * Until when, within the range, this fridge had no logger in it (so the chart shades that
 * time instead of suggesting missing data). null when a logger was there from the start.
 */
export function noLoggerUntil(placements, range) {
  if (placements.length === 0) return range.toUtc;
  const first = placements.map((p) => p.fromUtc).sort()[0];
  if (first <= range.fromUtc) return null;
  return first < range.toUtc ? first : range.toUtc;
}
