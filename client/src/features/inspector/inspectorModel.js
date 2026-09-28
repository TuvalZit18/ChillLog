// The inspector report's filters (kept in the URL) and its one-sentence answer
// (docs/design/ui.md, "Inspector report"). Pure functions, so the wording is tested.

import { THRESHOLDS } from '@chilllog/shared';
import { formatDate, formatDurationLong } from '../../shared/format/format.js';

const DEFAULT_DAYS = 30;
const DAY_MS = 86_400_000;
const isDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text);
const shiftDate = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const readId = (value) => (/^\d+$/.test(value ?? '') ? Number(value) : null);

/**
 * @typedef {{ branchId: number | null, fridgeId: number | null, from: string, to: string }} Filters
 */

/** Default range: the last 30 days, today included. @param {string} today Israel date */
const defaultFrom = (today) => shiftDate(today, -(DEFAULT_DAYS - 1));

/** @param {URLSearchParams} params @param {string} today Israel date 'YYYY-MM-DD' @returns {Filters} */
export function readFilters(params, today) {
  const hasDates = params.has('from') || params.has('to');
  return {
    branchId: readId(params.get('branchId')),
    fridgeId: readId(params.get('fridgeId')),
    from: hasDates ? (params.get('from') ?? '') : defaultFrom(today),
    to: hasDates ? (params.get('to') ?? '') : today,
  };
}

/** The URL search for the filters; the default dates are left out. */
export function filtersSearch(filters, today) {
  const params = new URLSearchParams();
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.fridgeId) params.set('fridgeId', filters.fridgeId);
  if (filters.from !== defaultFrom(today) || filters.to !== today) {
    params.set('from', filters.from);
    params.set('to', filters.to);
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** The query for GET /api/inspector, or the reason not to send one yet. */
export function filtersQuery({ branchId, fridgeId, from, to }) {
  if (!isDate(from) || !isDate(to)) return { error: 'Pick a start and an end date.' };
  if (from > to) return { error: 'The start date must be on or before the end date.' };
  return {
    query: {
      ...(branchId && { branchId }),
      ...(fridgeId && { fridgeId }),
      from,
      to,
    },
  };
}

/** Who the report is about, with names from GET /api/branches. */
export function scopeOf({ branchId, fridgeId }, branches) {
  if (fridgeId) {
    const branch = branches.find((b) => b.fridges.some((f) => f.id === fridgeId));
    const fridge = branch?.fridges.find((f) => f.id === fridgeId);
    if (fridge) {
      return {
        kind: 'fridge',
        branchId: branch.id,
        branchName: branch.name,
        fridgeName: fridge.name,
      };
    }
  }
  const branch = branchId && branches.find((b) => b.id === branchId);
  if (branch) return { kind: 'branch', branchId: branch.id, branchName: branch.name };
  return { kind: 'all', branchCount: branches.length };
}

/**
 * The answer card's sentence, as text segments; bold ones carry the facts.
 * "Rishon LeZion · Cream cakes was above 5°C 1 time between 1 Sep and 21 Sep, for a total of
 * 2 days 9 h 15 min."
 * @returns {{ text: string, bold?: boolean }[]}
 */
export function answer({ scope, report, filters }) {
  const plain = (text) => ({ text });
  const bold = (text) => ({ text, bold: true });
  const limit = `${THRESHOLDS.limitC}°C`;
  const when =
    filters.from === filters.to
      ? `on ${formatDate(filters.from)}`
      : `between ${formatDate(filters.from)} and ${formatDate(filters.to)}`;

  let who;
  if (scope.kind === 'fridge') {
    const name = `${scope.branchName} · ${scope.fridgeName}`;
    // No readings is not the same as "not above 5°C": never let it read as a clean record.
    if (report.fridgesWithoutData.length > 0) {
      return [plain(`There are no readings for ${name} ${when}, so this report can't say.`)];
    }
    who = [bold(name), plain(' was')];
  } else if (scope.kind === 'branch') {
    who = [plain('Fridges in '), bold(scope.branchName), plain(' were')];
  } else {
    who = [plain(`Fridges across all ${scope.branchCount} branches were`)];
  }

  const { count, totalMinutes } = report.summary;
  if (count === 0) return [...who, plain(` not above ${limit} ${when}.`)];
  return [
    ...who,
    plain(` above ${limit} `),
    bold(`${count} ${count === 1 ? 'time' : 'times'}`),
    plain(` ${when}, for a total of `),
    bold(formatDurationLong(totalMinutes)),
    plain('.'),
  ];
}
