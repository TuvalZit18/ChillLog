// The Loggers table (Logger · Branch · Type of fridge · Since): rows, the filter row, sortable
// headers, and the URL that keeps them (?q=&branch=&type=&sort=&dir=). Pure functions, tested.

import { fridgeType } from '../../shared/fridgeType.js';

export const SORT_KEYS = /** @type {const} */ (['code', 'branch', 'type', 'since']);
const DEFAULTS = { q: '', branch: null, type: null, sort: 'code', dir: 'asc' };

/**
 * @typedef {{ id: number, code: string, tags: string[], branch: string | null,
 *   fridge: string | null, type: string | null, sinceUtc: string | null }} LoggerRow
 */

/** One row per logger; a spare logger (in no fridge) has no branch, fridge, type or date. */
export function toTableRows(loggers) {
  return loggers.map((l) => ({
    id: l.id,
    code: l.code,
    tags: [l.unit === 'F' && '°F', l.dateFormat === 'MM/DD' && 'Dates MM/DD'].filter(Boolean),
    branch: l.current?.branchName ?? null,
    fridge: l.current?.fridgeName ?? null,
    type: l.current ? fridgeType(l.current.fridgeName) : null,
    sinceUtc: l.current?.fromUtc ?? null,
  }));
}

/** The filter row: any part of the logger ID (any case), a branch and a type of fridge. */
export function filterRows(rows, { q, branch, type }) {
  const needle = q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!needle || r.code.toLowerCase().includes(needle)) &&
      (branch === null || r.branch === branch) &&
      (type === null || r.type === type),
  );
}

// What each column sorts by; the Type column shows the fridge ("Display 2"), so it sorts by that.
const SORT_VALUE = {
  code: (r) => r.code,
  branch: (r) => r.branch,
  type: (r) => r.fridge,
  since: (r) => r.sinceUtc,
};
const compareText = (a, b) => a.localeCompare(b, 'en', { numeric: true });

/** Sorted by a column; spare loggers (no value) always last, ties by logger ID. */
export function sortRows(rows, { sort, dir }) {
  const value = SORT_VALUE[sort];
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const [va, vb] = [value(a), value(b)];
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else {
      const byValue = compareText(va, vb) * sign;
      if (byValue) return byValue;
    }
    return compareText(a.code, b.code);
  });
}

/** Clicking a header: a new column starts A–Z (Since: newest first); the same column flips. */
export function nextSort({ sort, dir }, key) {
  if (key === sort) return { sort, dir: dir === 'asc' ? 'desc' : 'asc' };
  return { sort: key, dir: key === 'since' ? 'desc' : 'asc' };
}

/** The table's state from the URL, with safe defaults. */
export function readTableState(params) {
  const sort = params.get('sort');
  const dir = params.get('dir');
  return {
    q: params.get('q') ?? '',
    branch: params.get('branch') || null,
    type: params.get('type') || null,
    sort: SORT_KEYS.includes(sort) ? sort : DEFAULTS.sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULTS.dir,
  };
}

/** The URL search for the table's state; defaults are left out. */
export function tableSearch(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.branch) params.set('branch', state.branch);
  if (state.type) params.set('type', state.type);
  if (state.sort !== DEFAULTS.sort || state.dir !== DEFAULTS.dir) {
    params.set('sort', state.sort);
    params.set('dir', state.dir);
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** The Branch and Type filters' options: each once, A–Z (spare loggers have neither). */
export function tableOptions(rows) {
  const unique = (values) =>
    [...new Set(values.filter((v) => v !== null))].sort((a, b) => a.localeCompare(b));
  return { branches: unique(rows.map((r) => r.branch)), types: unique(rows.map((r) => r.type)) };
}
