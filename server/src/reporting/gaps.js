// Missing data inside a time range, shared by the overview and the fridge detail so both
// screens always agree on what counts as a gap.

import { THRESHOLDS } from '@chilllog/shared';
import { findGaps } from '../detection/detection.js';

const MINUTE = 60_000;
const time = (iso) => Date.parse(iso);
const isValid = (r) => !r.isErr && r.tempC !== null;

/**
 * Gaps between readings that overlap [startUtc, edgeEndUtc), clipped to it, plus missing time
 * at either edge ("the logger died on Thursday"). The start edge only counts when the fridge
 * had data before the range; otherwise the logger simply wasn't there yet. edgeEndUtc is the
 * range end, or now when the range reaches into the future.
 * @param {import('../normalize/normalize.js').Reading[]} loaded readings from somewhat before
 *   the range start to its end, so a gap crossing the start is seen
 * @param {{ startUtc: string, edgeEndUtc: string, hadDataBefore: boolean }} range
 * @returns {{ fromUtc: string, toUtc: string, minutes: number }[]}
 */
export function missingInRange(loaded, { startUtc, edgeEndUtc, hadDataBefore }) {
  const clipped = (fromUtc, toUtc) => {
    const from = Math.max(time(fromUtc), time(startUtc));
    const to = Math.min(time(toUtc), time(edgeEndUtc));
    return { fromUtc, toUtc, minutes: Math.max(0, (to - from) / MINUTE) };
  };

  const gaps = findGaps(loaded)
    .filter((g) => g.toUtc > startUtc && g.fromUtc < edgeEndUtc)
    .map((g) => clipped(g.fromUtc, g.toUtc));

  const valid = loaded.filter(isValid);
  const validInRange = valid.filter((r) => r.tsUtc >= startUtc && r.tsUtc < edgeEndUtc);
  const validBefore = valid.filter((r) => r.tsUtc < startUtc);

  if (validInRange.length === 0) {
    // Readings in the range, but every one of them ERR: all of it is missing.
    return [clipped(startUtc, edgeEndUtc)];
  }
  if (hadDataBefore && validBefore.length === 0) {
    const edge = clipped(startUtc, validInRange[0].tsUtc);
    if (edge.minutes > THRESHOLDS.gapMinutes) gaps.unshift(edge);
  }
  const end = clipped(validInRange.at(-1).tsUtc, edgeEndUtc);
  if (end.minutes > THRESHOLDS.gapMinutes) gaps.push(end);
  return gaps;
}
