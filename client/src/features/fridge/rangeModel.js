// The fridge page's range (docs/design/ui.md, "Fridge detail"): Last 24h · 7 days · 30 days ·
// Custom. It lives in the URL (?range=24h, or ?from=2026-09-14&to=2026-09-20) so a view can be
// bookmarked; presets are worked out from "now" when the page asks the server.

import { toIsraelLocal } from '../../shared/format/format.js';

export const RANGE_PRESETS = Object.freeze([
  { key: '24h', label: 'Last 24h', hours: 24 },
  { key: '7d', label: '7 days', hours: 7 * 24 },
  { key: '30d', label: '30 days', hours: 30 * 24 },
]);

const DEFAULT_PRESET = '7d';
const HOUR_MS = 3_600_000;
const isDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text);

/**
 * @typedef {{ kind: 'preset', key: '24h' | '7d' | '30d' }
 *   | { kind: 'custom', from: string, to: string }} Range
 */

/** @param {URLSearchParams} params @returns {Range} */
export function readRange(params) {
  if (params.has('from') || params.has('to')) {
    return { kind: 'custom', from: params.get('from') ?? '', to: params.get('to') ?? '' };
  }
  const key = params.get('range');
  return {
    kind: 'preset',
    key: RANGE_PRESETS.some((p) => p.key === key) ? key : DEFAULT_PRESET,
  };
}

/** The URL search for a range; the default (7 days) is a clean URL. @param {Range} range */
export function rangeSearch(range) {
  if (range.kind === 'custom') {
    return `?${new URLSearchParams({ from: range.from, to: range.to })}`;
  }
  return range.key === DEFAULT_PRESET ? '' : `?range=${range.key}`;
}

/**
 * The query for GET /api/fridges/:id, or the reason not to send one yet.
 * @param {Range} range
 * @param {Date} now
 * @returns {{ query: { from: string, to?: string } } | { error: string }}
 */
export function rangeQuery(range, now) {
  if (range.kind === 'preset') {
    const { hours } = RANGE_PRESETS.find((p) => p.key === range.key);
    return { query: { from: toIsraelLocal(new Date(now.getTime() - hours * HOUR_MS)) } };
  }
  if (!isDate(range.from) || !isDate(range.to)) return { error: 'Pick a start and an end date.' };
  // "to" includes that whole day on the server, so a single day (from === to) is fine.
  if (range.from > range.to) return { error: 'The start date must be on or before the end date.' };
  return { query: { from: range.from, to: range.to } };
}
