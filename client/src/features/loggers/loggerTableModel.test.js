// The Loggers table: one row per logger with filterable, sortable columns (Logger · Branch ·
// Type of fridge · Since). Loggers have the shape GET /api/loggers returns.

import { describe, expect, it } from 'vitest';
import {
  filterRows,
  nextSort,
  readTableState,
  sortRows,
  tableOptions,
  tableSearch,
  toTableRows,
} from './loggerTableModel.js';

const logger = (id, code, place, fromUtc = '2026-08-30T21:00:00Z', extra = {}) => ({
  id,
  code,
  unit: 'C',
  dateFormat: 'DD/MM',
  current: place ? { fridgeId: id, branchName: place[0], fridgeName: place[1], fromUtc } : null,
  ...extra,
});

const loggers = [
  logger(1, 'TL-0417', ['Tel Aviv', 'Display 2'], '2026-09-23T15:00:00Z'),
  logger(2, 'TL-0231', ['Haifa', 'Dairy'], '2026-08-30T21:00:00Z', { unit: 'F' }),
  logger(3, 'TL-0415', ['Tel Aviv', 'Display 1']),
  logger(4, 'TL-0800', null),
  logger(5, 'TL-0419', ['Tel Aviv', 'Walk-in'], '2026-09-23T15:00:00Z'),
];
const codes = (rows) => rows.map((r) => r.code);

describe('toTableRows', () => {
  it('"We moved one of the Tel Aviv loggers into the new display fridge last week": each logger shows its branch, fridge, type and since when', () => {
    expect(toTableRows(loggers)[0]).toEqual({
      id: 1,
      code: 'TL-0417',
      tags: [],
      branch: 'Tel Aviv',
      fridge: 'Display 2',
      type: 'Display',
      sinceUtc: '2026-09-23T15:00:00Z',
    });
  });

  it('"The old logger in Haifa shows the numbers differently": tags °F loggers; a spare logger has no place', () => {
    const rows = toTableRows(loggers);
    expect(rows[1].tags).toEqual(['°F']);
    expect(rows[3]).toMatchObject({ branch: null, fridge: null, type: null, sinceUtc: null });
  });
});

describe('filterRows', () => {
  const rows = toTableRows(loggers);

  it('finds loggers by any part of their ID, in any case', () => {
    expect(codes(filterRows(rows, { q: 'tl-04', branch: null, type: null }))).toEqual([
      'TL-0417',
      'TL-0415',
      'TL-0419',
    ]);
  });

  it('narrows by branch and by type of fridge', () => {
    expect(codes(filterRows(rows, { q: '', branch: 'Tel Aviv', type: 'Display' }))).toEqual([
      'TL-0417',
      'TL-0415',
    ]);
    expect(codes(filterRows(rows, { q: '', branch: 'Haifa', type: null }))).toEqual(['TL-0231']);
  });
});

describe('sortRows', () => {
  const rows = toTableRows(loggers);

  it('sorts by logger ID by default, A–Z', () => {
    expect(codes(sortRows(rows, { sort: 'code', dir: 'asc' }))).toEqual([
      'TL-0231',
      'TL-0415',
      'TL-0417',
      'TL-0419',
      'TL-0800',
    ]);
  });

  it('sorts by since, newest first, with ties by ID and the spare logger last', () => {
    expect(codes(sortRows(rows, { sort: 'since', dir: 'desc' }))).toEqual([
      'TL-0417',
      'TL-0419',
      'TL-0231',
      'TL-0415',
      'TL-0800',
    ]);
  });

  it('keeps a spare logger last whichever way a column is sorted', () => {
    expect(codes(sortRows(rows, { sort: 'branch', dir: 'desc' })).at(-1)).toBe('TL-0800');
    expect(codes(sortRows(rows, { sort: 'branch', dir: 'asc' })).at(-1)).toBe('TL-0800');
  });
});

describe('nextSort', () => {
  it('a new column starts A–Z (Since starts newest first); the same column flips', () => {
    expect(nextSort({ sort: 'code', dir: 'asc' }, 'branch')).toEqual({
      sort: 'branch',
      dir: 'asc',
    });
    expect(nextSort({ sort: 'code', dir: 'asc' }, 'since')).toEqual({ sort: 'since', dir: 'desc' });
    expect(nextSort({ sort: 'branch', dir: 'asc' }, 'branch')).toEqual({
      sort: 'branch',
      dir: 'desc',
    });
  });
});

describe('readTableState and tableSearch', () => {
  it('reads the filters and sort from the URL, with safe defaults', () => {
    expect(readTableState(new URLSearchParams(''))).toEqual({
      q: '',
      branch: null,
      type: null,
      sort: 'code',
      dir: 'asc',
    });
    expect(
      readTableState(new URLSearchParams('q=04&branch=Tel+Aviv&type=Display&sort=since&dir=desc')),
    ).toEqual({ q: '04', branch: 'Tel Aviv', type: 'Display', sort: 'since', dir: 'desc' });
    expect(readTableState(new URLSearchParams('sort=nonsense&dir=up'))).toMatchObject({
      sort: 'code',
      dir: 'asc',
    });
  });

  it('writes only what differs from the defaults, so the plain URL stays clean', () => {
    const state = readTableState(new URLSearchParams(''));
    expect(tableSearch(state)).toBe('');
    expect(tableSearch({ ...state, branch: 'Tel Aviv', sort: 'since', dir: 'desc' })).toBe(
      '?branch=Tel+Aviv&sort=since&dir=desc',
    );
  });
});

describe('tableOptions', () => {
  it('lists each branch and each type of fridge once, A–Z, without the spare loggers', () => {
    expect(tableOptions(toTableRows(loggers))).toEqual({
      branches: ['Haifa', 'Tel Aviv'],
      types: ['Dairy', 'Display', 'Walk-in'],
    });
  });
});
